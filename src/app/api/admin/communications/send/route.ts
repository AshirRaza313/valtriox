// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── POST /api/admin/communications/send ─────────────────────────────────
// Admin (Muhammad Ashir Raza) sends a message to a client organization.
//
// Body shape:
// {
//   organizationId: string,        // required — target client org
//   category: string,              // deadline | subscription_features | document | improvements | invoice | report | general | onboarding | billing
//   subject: string,               // required
//   body: string,                  // required (markdown/plain text)
//   priority?: string,             // low | normal | high | urgent (default: normal)
//   attachments?: Array<{ name, url, size, type }>,
//   deadlineDate?: string,         // ISO date — for category=deadline
//   scheduledFor?: string,         // ISO date — for scheduled sending (future)
//   parentMessageId?: string,      // for threaded replies
//   threadId?: string,             // existing thread ID if replying
//   relatedInvoiceId?: string,
//   relatedReportId?: string,
// }
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json(
        { error: "Only platform administrators can send client communications" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      organizationId,
      category,
      subject,
      body: messageBody,
      priority,
      attachments,
      deadlineDate,
      scheduledFor,
      parentMessageId,
      threadId: providedThreadId,
      relatedInvoiceId,
      relatedReportId,
    } = body;

    // ── Validation ──
    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }
    const validCategories = [
      "deadline", "subscription_features", "document", "improvements",
      "invoice", "report", "general", "onboarding", "billing",
    ];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }
    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return NextResponse.json({ error: "subject is required (min 3 chars)" }, { status: 400 });
    }
    if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length < 1) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const validPriorities = ["low", "normal", "high", "urgent"];
    const resolvedPriority = validPriorities.includes(priority) ? priority : "normal";

    // ── Verify org exists ──
    const { data: org, error: orgErr } = await safeDbQuery(() =>
      db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, email: true, plan: true },
      })
    );
    if (orgErr) {
      return NextResponse.json({ error: "DB error fetching organization" }, { status: 503 });
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // ── Generate thread ID for new conversations ──
    const threadId = providedThreadId || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // ── Build create payload ──
    const createData: any = {
      organizationId,
      threadId,
      parentMessageId: parentMessageId || null,
      direction: "admin_to_client",
      senderUserId: authCtx.userId,
      senderName: authCtx.name || authCtx.email || "Valtriox Admin",
      senderEmail: authCtx.email,
      senderRole: authCtx.role,
      category,
      subject: subject.trim(),
      body: messageBody,
      priority: resolvedPriority,
      attachments: Array.isArray(attachments) && attachments.length > 0 ? attachments : null,
      isReadByAdmin: true, // admin wrote it
      isReadByClient: false,
      isPinned: false,
      isArchived: false,
      sentAt: scheduledFor ? new Date(scheduledFor) : new Date(),
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      deadlineDate: deadlineDate ? new Date(deadlineDate) : null,
      relatedInvoiceId: relatedInvoiceId || null,
      relatedReportId: relatedReportId || null,
    };

    const { data: message, error: createErr } = await safeDbQuery(() =>
      db.clientMessage.create({ data: createData })
    );

    if (createErr) {
      logger.error("[Communication Send] DB error", { error: createErr });
      return NextResponse.json({ error: "Failed to send message" }, { status: 503 });
    }

    // ── Create notification for the client org ──
    const categoryLabels: Record<string, string> = {
      deadline: "Monthly Deadline Reminder",
      subscription_features: "Subscription Plan Update",
      document: "Document Shared",
      improvements: "Improvements & Feedback",
      invoice: "Invoice Notification",
      report: "Report Shared",
      general: "New Message",
      onboarding: "Onboarding Update",
      billing: "Billing Notification",
    };

    await safeDbQuery(() =>
      db.notification.create({
        data: {
          orgId: organizationId,
          title: `${categoryLabels[category] || "New Message"}: ${subject.trim().slice(0, 60)}`,
          message: `You have a new message from Valtriox (${authCtx.name || authCtx.email}). Check your Communication Center inbox.`,
          type: "info",
          actionUrl: `/communications`,
          icon: "MessageSquare",
        },
      })
    );

    logger.info("[Communication Send] Success", {
      messageId: message.id,
      threadId,
      organizationId,
      category,
      userId: authCtx.userId,
    });

    return NextResponse.json({
      message,
      threadId,
      success: true,
    }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Communication Send] Unhandled error", msg);
    return NextResponse.json({ error: "Failed to send communication" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 60, windowSeconds: 60 });

// ── GET /api/admin/communications/send ──
// Returns all client orgs (for the admin's client picker dropdown)
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { data: orgs, error } = await safeDbQuery(() =>
    db.organization.findMany({
      where: { isActive: true, isBanned: false },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, plan: true,
        country: true, currency: true, createdAt: true,
      },
      take: 500,
    })
  );
  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 503 });
  }
  return NextResponse.json({ organizations: orgs || [] });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
