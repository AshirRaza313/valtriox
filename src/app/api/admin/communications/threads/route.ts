// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── GET /api/admin/communications/threads ──────────────────────────────
// Returns all communication threads, grouped by client organization.
// Supports filters: organizationId, category, unreadOnly, archived.
//
// Query params:
//   ?orgId=xxx          — filter by client org
//   ?category=deadline  — filter by category
//   ?unreadOnly=true    — only threads with unread client messages
//   ?archived=false     — exclude archived (default: false)
//   ?limit=50           — max threads to return
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const category = searchParams.get("category");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const includeArchived = searchParams.get("archived") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);

    // Build where clause for messages
    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (category) where.category = category;
    if (!includeArchived) where.isArchived = false;

    // Fetch all matching messages
    const { data: messages, error } = await safeDbQuery(() =>
      db.clientMessage.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { sentAt: "desc" }],
        take: limit * 5, // get more so we can group into threads
        include: {
          organization: {
            select: { id: true, name: true, email: true, plan: true, country: true },
          },
        },
      })
    );

    if (error) {
      logger.error("[Communications Threads] DB error", { error });
      return NextResponse.json({ error: "DB error" }, { status: 503 });
    }

    // Group messages by threadId
    const threadMap = new Map<string, {
      threadId: string;
      organization: any;
      messages: any[];
      lastMessageAt: string;
      unreadClientCount: number;
      unreadAdminCount: number;
      isPinned: boolean;
      categories: string[];
      subject: string;
    }>();

    for (const msg of messages || []) {
      const tid = msg.threadId;
      if (!threadMap.has(tid)) {
        threadMap.set(tid, {
          threadId: tid,
          organization: msg.organization,
          messages: [],
          lastMessageAt: msg.sentAt,
          unreadClientCount: 0,
          unreadAdminCount: 0,
          isPinned: false,
          categories: [],
          subject: msg.subject,
        });
      }
      const t = threadMap.get(tid)!;
      t.messages.push(msg);
      if (new Date(msg.sentAt) > new Date(t.lastMessageAt)) {
        t.lastMessageAt = msg.sentAt;
        t.subject = msg.subject; // latest subject
      }
      if (msg.direction === "client_to_admin" && !msg.isReadByAdmin) {
        t.unreadAdminCount++;
      }
      if (msg.direction === "admin_to_client" && !msg.isReadByClient) {
        t.unreadClientCount++;
      }
      if (msg.isPinned) t.isPinned = true;
      if (!t.categories.includes(msg.category)) t.categories.push(msg.category);
    }

    // Convert to array and apply unread filter
    let threads = Array.from(threadMap.values());
    if (unreadOnly) {
      threads = threads.filter((t) => t.unreadAdminCount > 0);
    }

    // Sort: pinned first, then by lastMessageAt desc
    threads.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    // Truncate messages to last 50 per thread to keep payload reasonable
    threads = threads.map((t) => ({
      ...t,
      messages: t.messages.slice(-50),
    }));

    // Stats summary
    const stats = {
      totalThreads: threads.length,
      totalUnread: threads.reduce((sum, t) => sum + t.unreadAdminCount, 0),
      pinnedThreads: threads.filter((t) => t.isPinned).length,
      byCategory: threads.reduce((acc, t) => {
        for (const c of t.categories) acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({ threads, stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Communications Threads] Unhandled error", msg);
    return NextResponse.json({ error: "Failed to load threads" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 60, windowSeconds: 60 });
