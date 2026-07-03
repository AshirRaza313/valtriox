// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── GET /api/communications/inbox ─────────────────────────────────────
// Client-facing: returns all messages addressed to the client's org.
// Supports filters: category, unreadOnly.
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!authCtx.organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where: any = {
      organizationId: authCtx.organizationId,
      isArchived: false,
    };
    if (category) where.category = category;
    if (unreadOnly) where.isReadByClient = false;

    const { data: messages, error } = await safeDbQuery(() =>
      db.clientMessage.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { sentAt: "desc" }],
        take: 200,
      })
    );

    if (error) {
      logger.error("[Client Inbox] DB error", { error });
      return NextResponse.json({ error: "DB error" }, { status: 503 });
    }

    // Group by thread for UI display
    const threadMap = new Map<string, any>();
    for (const msg of messages || []) {
      const tid = msg.threadId;
      if (!threadMap.has(tid)) {
        threadMap.set(tid, {
          threadId: tid,
          subject: msg.subject,
          category: msg.category,
          priority: msg.priority,
          isPinned: msg.isPinned,
          messages: [],
          lastMessageAt: msg.sentAt,
          unreadCount: 0,
          deadlineDate: msg.deadlineDate,
          attachments: [],
        });
      }
      const t = threadMap.get(tid);
      t.messages.push(msg);
      if (new Date(msg.sentAt) > new Date(t.lastMessageAt)) {
        t.lastMessageAt = msg.sentAt;
        t.subject = msg.subject;
        t.category = msg.category;
        t.priority = msg.priority;
      }
      if (!msg.isReadByClient && msg.direction === "admin_to_client") t.unreadCount++;
      if (msg.isPinned) t.isPinned = true;
      if (msg.deadlineDate) t.deadlineDate = msg.deadlineDate;
      if (Array.isArray(msg.attachments)) {
        t.attachments.push(...msg.attachments);
      }
    }

    const threads = Array.from(threadMap.values());
    threads.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    const stats = {
      total: threads.length,
      unread: threads.reduce((s, t) => s + t.unreadCount, 0),
      pinned: threads.filter((t) => t.isPinned).length,
      deadlines: threads.filter((t) => t.category === "deadline" && t.deadlineDate).length,
    };

    return NextResponse.json({ threads, stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Client Inbox] Unhandled error", msg);
    return NextResponse.json({ error: "Failed to load inbox" }, { status: 500 });
  }
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });
