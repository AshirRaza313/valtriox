// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── POST /api/communications/:id/reply ─────────────────────────────────
// Client-facing: client replies to an admin message in an existing thread.
// Body: { body: string, attachments?: Array }
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  try {
    if (!authCtx.organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }
    const { id } = await ctx.params;
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const { body: messageBody, attachments } = body;
    if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length < 1) {
      return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
    }

    // Fetch parent message
    const { data: parent, error: parentErr } = await safeDbQuery(() =>
      db.clientMessage.findUnique({ where: { id } })
    );
    if (parentErr) return NextResponse.json({ error: "DB error" }, { status: 503 });
    if (!parent) return NextResponse.json({ error: "Parent message not found" }, { status: 404 });

    // Verify ownership
    if (parent.organizationId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create the reply
    const { data: reply, error: createErr } = await safeDbQuery(() =>
      db.clientMessage.create({
        data: {
          organizationId: authCtx.organizationId,
          threadId: parent.threadId,
          parentMessageId: parent.id,
          direction: "client_to_admin",
          senderUserId: authCtx.userId,
          senderName: authCtx.name || authCtx.email || "Client",
          senderEmail: authCtx.email,
          senderRole: authCtx.role,
          category: parent.category, // inherit category from thread
          subject: `Re: ${parent.subject}`,
          body: messageBody,
          attachments: Array.isArray(attachments) && attachments.length > 0 ? attachments : null,
          priority: "normal",
          isReadByAdmin: false,
          isReadByClient: true, // client wrote it
          sentAt: new Date(),
        },
      })
    );

    if (createErr) {
      logger.error("[Client Reply] DB error", { error: createErr });
      return NextResponse.json({ error: "Failed to send reply" }, { status: 503 });
    }

    // Notify platform admins (best-effort)
    await safeDbQuery(() =>
      db.notification.create({
        data: {
          orgId: authCtx.organizationId,
          title: `Client reply from ${authCtx.name || authCtx.email}`,
          message: `New reply on thread "${parent.subject}". Check the Communication Center.`,
          type: "info",
          actionUrl: `/communications`,
          icon: "MessageSquare",
        },
      })
    );

    return NextResponse.json({ reply, success: true }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Client Reply] Unhandled error", msg);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });
