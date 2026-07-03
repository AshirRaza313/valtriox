// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, RouteContext, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── GET /api/admin/communications/:id ──
// Fetch a single message with its full thread
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const { data: message, error } = await safeDbQuery(() =>
    db.clientMessage.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, email: true, plan: true, country: true },
        },
      },
    })
  );
  if (error) return NextResponse.json({ error: "DB error" }, { status: 503 });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  // Fetch all messages in the same thread
  const { data: threadMessages, error: threadErr } = await safeDbQuery(() =>
    db.clientMessage.findMany({
      where: { threadId: message.threadId },
      orderBy: { sentAt: "asc" },
    })
  );
  if (threadErr) return NextResponse.json({ error: "DB error" }, { status: 503 });

  // Mark all client_to_admin messages in this thread as read by admin
  await safeDbQuery(() =>
    db.clientMessage.updateMany({
      where: {
        threadId: message.threadId,
        direction: "client_to_admin",
        isReadByAdmin: false,
      },
      data: { isReadByAdmin: true, readAt: new Date() },
    })
  );

  return NextResponse.json({
    message,
    thread: threadMessages || [],
  });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 60, windowSeconds: 60 });

// ── PATCH /api/admin/communications/:id ──
// Update message status: pin, archive, mark-read, etc.
// Body: { action: "pin" | "unpin" | "archive" | "unarchive" | "mark_read" | "mark_unread" | "delete" }
//       scope: "message" | "thread" (default: thread)
export const PATCH = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const action = body.action;
  const scope = body.scope || "thread";
  const validActions = ["pin", "unpin", "archive", "unarchive", "mark_read", "mark_unread", "delete"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  // Get the message to find its thread
  const { data: message, error: fetchErr } = await safeDbQuery(() =>
    db.clientMessage.findUnique({ where: { id }, select: { id: true, threadId: true } })
  );
  if (fetchErr) return NextResponse.json({ error: "DB error" }, { status: 503 });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const whereClause = scope === "thread"
    ? { threadId: message.threadId }
    : { id: message.id };

  // Handle delete separately
  if (action === "delete") {
    const { error: delErr } = await safeDbQuery(() =>
      db.clientMessage.deleteMany({ where: whereClause })
    );
    if (delErr) return NextResponse.json({ error: "Failed to delete" }, { status: 503 });
    return NextResponse.json({ success: true, deleted: true });
  }

  // Build update data
  const updateData: any = {};
  if (action === "pin") updateData.isPinned = true;
  if (action === "unpin") updateData.isPinned = false;
  if (action === "archive") updateData.isArchived = true;
  if (action === "unarchive") updateData.isArchived = false;
  if (action === "mark_read") {
    updateData.isReadByAdmin = true;
    updateData.readAt = new Date();
  }
  if (action === "mark_unread") {
    updateData.isReadByAdmin = false;
    updateData.readAt = null;
  }

  const { error: updErr } = await safeDbQuery(() =>
    db.clientMessage.updateMany({ where: whereClause, data: updateData })
  );
  if (updErr) {
    logger.error("[Communication Patch] Update failed", { error: updErr });
    return NextResponse.json({ error: "Failed to update" }, { status: 503 });
  }

  logger.info("[Communication Patch] Success", {
    messageId: id,
    action,
    scope,
    userId: authCtx.userId,
  });

  return NextResponse.json({ success: true, action, scope });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 60, windowSeconds: 60 });
