import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// Allow up to 30 seconds for DB operations on Vercel serverless
export const maxDuration = 30;

// ============================================================================
// Types
// ============================================================================

interface ReminderLead {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  industry: string | null;
  interest: string | null;
  status: string;
  source: string;
  message: string | null;
  notes: string | null;
  consultationType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timezone: string | null;
  calendlyBookingLink: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReminderItem extends ReminderLead {
  daysUntil?: number;       // negative = overdue
  daysSinceFollowUp?: number;
  followUpCount?: number;
  lastFollowUpAt?: string | null;
}

// ============================================================================
// GET /api/admin/consultation-reminders
// Platform owner/admin only.
// Returns leads categorized by: upcoming, overdue, followUpDue
// ============================================================================

export const GET = withAuth(async (req: NextRequest) => {
  logger.info("[Consultation Reminders] GET request");

  const { data: result, error } = await safeDbQuery(async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 7-day window for upcoming
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    // 3-day threshold for follow-up
    const followUpThreshold = new Date(today);
    followUpThreshold.setDate(followUpThreshold.getDate() - 3);

    // ── Query 1: Consultation scheduled leads ──
    const scheduledLeads = await db.lead.findMany({
      where: { status: "consultation_scheduled" },
      orderBy: { preferredDate: "asc" },
    });

    // ── Query 2: Contacted leads that may need follow-up ──
    const contactedLeads = await db.lead.findMany({
      where: { status: "contacted" },
      orderBy: { createdAt: "desc" },
    });

    // ── Categorize scheduled leads ──
    const upcoming: ReminderItem[] = [];
    const overdue: ReminderItem[] = [];

    for (const lead of scheduledLeads) {
      const item: ReminderItem = { ...lead as unknown as ReminderItem };

      if (lead.preferredDate) {
        const scheduledDate = new Date(lead.preferredDate);
        const diffMs = scheduledDate.getTime() - today.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        item.daysUntil = daysUntil;

        if (daysUntil < 0) {
          overdue.push(item);
        } else if (daysUntil <= 7) {
          upcoming.push(item);
        }
      }
    }

    // ── Categorize contacted leads for follow-up ──
    const followUpDue: ReminderItem[] = [];

    for (const lead of contactedLeads) {
      const item: ReminderItem = {
        ...lead as unknown as ReminderItem,
        followUpCount: 0,
        lastFollowUpAt: null,
      };

      // If lastFollowUpAt is not tracked, use updatedAt as proxy
      // Check if updatedAt is > 3 days ago
      const lastActivity = new Date(lead.updatedAt);
      const diffMs = today.getTime() - lastActivity.getTime();
      const daysSince = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      item.daysSinceFollowUp = daysSince;
      item.lastFollowUpAt = lead.updatedAt;

      if (daysSince > 3) {
        followUpDue.push(item);
      }
    }

    const total = scheduledLeads.length + contactedLeads.length;

    return {
      upcoming,
      overdue,
      followUpDue,
      stats: {
        total: scheduledLeads.length + contactedLeads.length,
        upcoming: upcoming.length,
        overdue: overdue.length,
        followUpDue: followUpDue.length,
      },
    };
  }, 3, 1000);

  if (error) {
    logger.error("[Consultation Reminders] GET error", { error });
    return NextResponse.json({
      upcoming: [],
      overdue: [],
      followUpDue: [],
      stats: { total: 0, upcoming: 0, overdue: 0, followUpDue: 0 },
      _dbError: true,
      error: error || "Failed to fetch consultation reminders",
    });
  }

  return NextResponse.json(result);
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

// ============================================================================
// POST /api/admin/consultation-reminders/send
// Platform owner/admin only.
// Sends reminder/follow-up/reschedule email to a lead
// ============================================================================

export const POST = withAuth(async (req: NextRequest) => {
  logger.info("[Consultation Reminders] POST request");

  try {
    const body = await req.json();
    const { leadId, templateType } = body;

    if (!leadId) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const validTemplates = ["reminder", "follow_up", "reschedule"];
    if (!templateType || !validTemplates.includes(templateType)) {
      return NextResponse.json(
        { error: `Invalid template type. Must be one of: ${validTemplates.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Step 1: Fetch lead ──
    const { data: lead, error: leadErr } = await safeDbQuery(() =>
      db.lead.findUnique({ where: { id: leadId } })
    );
    if (leadErr) {
      logger.error("[Consultation Reminders] Failed to fetch lead", { error: leadErr });
      return NextResponse.json({ error: "Failed to fetch lead" }, { status: 503 });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // ── Step 2: Generate email content ──
    const { generateConsultationReminderHtml, generateConsultationFollowUpHtml, generateConsultationRescheduleHtml } = await import("@/lib/email-templates");

    const { data: platformSettings } = await safeDbQuery(() =>
      db.platformSettings.findFirst()
    );

    const emailData = {
      clientName: lead.fullName,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      company: lead.company,
      industry: lead.industry,
      interest: lead.interest,
      scheduledDate: lead.preferredDate,
      scheduledTime: lead.preferredTime,
      timezone: lead.timezone,
      consultationType: lead.consultationType,
      message: lead.message,
      platformName: platformSettings?.companyName || "Valtriox",
      platformWebsite: platformSettings?.companyWebsite || "https://valtriox.pk",
      companyEmail: platformSettings?.companyEmail || "support@valtriox.pk",
      companyPhone: platformSettings?.companyPhone || null,
    };

    let html: string;
    let subject: string;

    switch (templateType) {
      case "reminder":
        html = generateConsultationReminderHtml(emailData);
        subject = `Reminder: Your Upcoming Consultation | ${emailData.platformName}`;
        break;
      case "follow_up":
        html = generateConsultationFollowUpHtml(emailData);
        subject = `Following Up | ${emailData.platformName}`;
        break;
      case "reschedule":
        html = generateConsultationRescheduleHtml(emailData);
        subject = `Reschedule Your Consultation | ${emailData.platformName}`;
        break;
    }

    // ── Step 3: Send email ──
    const { sendEmail } = await import("@/lib/email");
    const sent = await sendEmail({
      to: lead.email,
      subject,
      html,
    });

    if (!sent) {
      logger.warn("[Consultation Reminders] Email send failed (no provider configured)");
      // Don't hard-fail — the reminder action is still tracked
    }

    // ── Step 4: Update lead record ──
    const updateData: Record<string, any> = {
      lastFollowUpAt: new Date(),
      followUpCount: { increment: 1 },
    };

    if (templateType === "reschedule") {
      updateData.status = "contacted";
    }

    await safeDbQuery(() =>
      db.lead.update({
        where: { id: leadId },
        data: updateData,
      })
    );

    logger.info("[Consultation Reminders] Email processed", {
      leadId,
      templateType,
      email: lead.email,
      sent,
    });

    return NextResponse.json({
      success: true,
      message: sent
        ? `Email sent successfully to ${lead.email}`
        : `Email queued for ${lead.email} (provider not configured)`,
      emailSent: sent,
      leadId,
      templateType,
    });
  } catch (error: any) {
    logger.error("[Consultation Reminders] POST error", error);
    return NextResponse.json(
      { error: "Failed to send reminder", details: error?.message },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });
