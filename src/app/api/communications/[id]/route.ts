// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── GET /api/communications/:id ────────────────────────────────────────
// Client-facing: fetch a single message thread by message ID.
// Also marks admin_to_client messages in the thread as read by client.
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!authCtx.organizationId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }
  const { id } = await ctx.params;

  const { data: message, error } = await safeDbQuery(() =>
    db.clientMessage.findUnique({ where: { id } })
  );
  if (error) return NextResponse.json({ error: "DB error" }, { status: 503 });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  // Verify ownership — client can only view their own org's messages
  if (message.organizationId !== authCtx.organizationId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Fetch full thread
  const { data: threadMessages, error: threadErr } = await safeDbQuery(() =>
    db.clientMessage.findMany({
      where: { threadId: message.threadId, organizationId: authCtx.organizationId },
      orderBy: { sentAt: "asc" },
    })
  );
  if (threadErr) return NextResponse.json({ error: "DB error" }, { status: 503 });

  // Mark all admin_to_client messages in this thread as read by client
  await safeDbQuery(() =>
    db.clientMessage.updateMany({
      where: {
        threadId: message.threadId,
        organizationId: authCtx.organizationId,
        direction: "admin_to_client",
        isReadByClient: false,
      },
      data: { isReadByClient: true, readAt: new Date() },
    })
  );

  return NextResponse.json({
    message,
    thread: threadMessages || [],
  });
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });

// ── PATCH /api/communications/:id ──
// Client-facing: mark thread as read/unread, archive
export const PATCH = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!authCtx.organizationId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }
  const { id } = await ctx.params;
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const action = body.action;
  const validActions = ["mark_read", "mark_unread", "archive", "unarchive"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const { data: message, error: fetchErr } = await safeDbQuery(() =>
    db.clientMessage.findUnique({ where: { id }, select: { id: true, threadId: true, organizationId: true } })
  );
  if (fetchErr) return NextResponse.json({ error: "DB error" }, { status: 503 });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.organizationId !== authCtx.organizationId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const updateData: any = {};
  if (action === "mark_read") {
    updateData.isReadByClient = true;
    updateData.readAt = new Date();
  }
  if (action === "mark_unread") {
    updateData.isReadByClient = false;
    updateData.readAt = null;
  }
  if (action === "archive") updateData.isArchived = true;
  if (action === "unarchive") updateData.isArchived = false;

  const { error: updErr } = await safeDbQuery(() =>
    db.clientMessage.updateMany({
      where: { threadId: message.threadId, organizationId: authCtx.organizationId },
      data: updateData,
    })
  );
  if (updErr) return NextResponse.json({ error: "Failed to update" }, { status: 503 });

  return NextResponse.json({ success: true, action });
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });
