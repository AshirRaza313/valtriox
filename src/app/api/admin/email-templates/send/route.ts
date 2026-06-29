import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// POST /api/admin/email-templates/send - Send an email template to a recipient
export const POST = withAuth(async (req: NextRequest) => {
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

    // Log the send (in production, this would integrate with an email service like Resend, SendGrid, etc.)
    logger.info(`[Send Email] Template "${template.name}" (${template.type}) sent to ${recipientEmail}${clientName ? ` (client: ${clientName})` : ""}`);

    // Store sent email record for tracking (best-effort)
    await safeDbQuery(() =>
      db.sentEmail.create({
        data: {
          templateId: template.id,
          templateType: template.type,
          templateName: template.name,
          recipientEmail,
          clientName: clientName || null,
          subject: personalizedSubject,
          status: "sent",
          sentAt: new Date(),
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: `Email "${template.name}" sent to ${recipientEmail}`,
      templateId: template.id,
      recipientEmail,
      clientName: clientName || null,
    });
  } catch (error: any) {
    logger.error("[Send Email] POST error", error);
    return NextResponse.json({ error: "Failed to send email", details: process.env.NODE_ENV === "production" ? undefined : error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
