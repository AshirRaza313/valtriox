import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import { sendEmail, SUPPORT_FROM, SUPPORT_REPLY_TO, isEmailConfigured } from "@/lib/email";
import logger from "@/lib/logger";

// POST /api/admin/email-templates/send - Send an email template to a recipient
export const POST = withRateLimit(withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { templateId, recipientEmail, clientName } = body;

    if (!templateId || !recipientEmail) {
      return NextResponse.json({ error: "templateId and recipientEmail are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s]+@[^\s]+\.[^\s]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Fetch the template
    const { data: template, error: fetchErr } = await safeDbQuery(() =>
      db.emailTemplate.findUnique({ where: { id: templateId } })
    );

    if (fetchErr) {
      logger.error("[Send Email] Error fetching template", { error: fetchErr });
      return NextResponse.json({ error: "Failed to fetch email template" }, { status: 503 });
    }

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: "Template is not active" }, { status: 400 });
    }

    // Replace template variables
    let personalizedHtml = template.htmlContent;
    let personalizedSubject = template.subject;

    const replacements = [
      { from: "{{clientName}}", to: clientName || "Valued Client" },
      { from: "{{leadName}}", to: clientName || "Valued Client" },
      { from: "{{leadEmail}}", to: recipientEmail },
    ];

    for (const r of replacements) {
      personalizedHtml = personalizedHtml.split(r.from).join(r.to);
      personalizedSubject = personalizedSubject.split(r.from).join(r.to);
    }

    // ── Actually send the email via sendEmail() (Resend → SMTP fallback) ──
    let emailSent = false;
    let emailError: string | undefined;

    if (!isEmailConfigured()) {
      logger.warn("[Send Email] No email provider configured — skipping actual send. Set RESEND_API_KEY or SMTP_* env vars.");
      emailError = "Email provider not configured";
    } else {
      try {
        emailSent = await sendEmail({
          to: recipientEmail,
          from: SUPPORT_FROM,
          replyTo: SUPPORT_REPLY_TO,
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedHtml.replace(/<[^>]*>/g, ""),
        });

        if (emailSent) {
          logger.info(`[Send Email] Template "${template.name}" (${template.type}) sent to ${recipientEmail}${clientName ? ` (client: ${clientName})` : ""}`);
        } else {
          emailError = "Email provider returned failure";
          logger.error("[Send Email] sendEmail() returned false", { templateId, recipientEmail });
        }
      } catch (sendErr: unknown) {
        emailError = sendErr instanceof Error ? sendErr.message : String(sendErr);
        logger.error("[Send Email] sendEmail() threw", sendErr, { templateId, recipientEmail });
      }
    }

    // Store sent email record for tracking (best-effort)
    await safeDbQuery(() =>
      db.systemSetting.create({
        data: {
          key: `sent_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          value: JSON.stringify({
            templateId: template.id,
            templateType: template.type,
            templateName: template.name,
            recipientEmail,
            clientName: clientName || null,
            subject: personalizedSubject,
            status: emailSent ? "sent" : "failed",
            error: emailError || null,
            sentAt: new Date().toISOString(),
          }),
          category: "sent_email",
        },
      })
    );

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: "Failed to send email. Please check email provider configuration.",
        details: emailError,
        templateId: template.id,
        recipientEmail,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Email "${template.name}" sent to ${recipientEmail}`,
      templateId: template.id,
      recipientEmail,
      clientName: clientName || null,
    });
  } catch (error: unknown) {
    logger.error("[Send Email] POST error", error);
    return NextResponse.json({ error: "Failed to send email", details: undefined }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
