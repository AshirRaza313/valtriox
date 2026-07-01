// ============================================================================
// Enhanced Document Send API — Send text documents OR uploaded files to clients
// ============================================================================
// POST /api/admin/documents/send
//
// Accepts two modes:
//
// Mode 1 — Text Document (existing):
//   { documentKey, clientOrgId, placeholders: { client_name, ... } }
//
// Mode 2 — Uploaded File:
//   { fileId, clientOrgId, message: "optional message" }
//
// For uploaded files, generates a professional email with a download link.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db, withRetry, safeDbQuery } from "@/lib/db";
import { sanitizeObject } from "@/lib/sanitize";
import { sendEmail } from "@/lib/email";
import { withAuth, AuthContext } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════════════════════
// POST - Send document/file to a client via email
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withAuth(async (req: NextRequest, authCtx: AuthContext) => {
  try {
    const body = await req.json();
    const sanitized = sanitizeObject(body);
    const { documentKey, fileId, clientOrgId, placeholders, message } = sanitized;

    if (!clientOrgId) {
      return NextResponse.json({ error: "Client organization ID is required" }, { status: 400 });
    }

    if (!documentKey && !fileId) {
      return NextResponse.json({ error: "Either documentKey or fileId is required" }, { status: 400 });
    }
    // ─── Fetch Client Organization ─────────────────────────────────────────
    const { data: org, error: orgError } = await safeDbQuery(async () => {
      return await db.organization.findUnique({
        where: { id: clientOrgId },
      });
    }, 2, 500);

    if (orgError || !org) {
      return NextResponse.json({ error: "Client organization not found" }, { status: 404 });
    }

    // Build placeholders
    const ph = {
      client_name: placeholders?.client_name || org.name || "Valued Client",
      company_name: org.name || "Company",
      client_email: org.email || "",
      consultant_name: "Valtriox Team",
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      ...placeholders,
    };

    const recipientEmail = ph.client_email;
    if (!recipientEmail) {
      return NextResponse.json({ error: "No email address found for the client" }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODE 1: Text Document (from SystemSetting)
    // ═══════════════════════════════════════════════════════════════════════

    if (documentKey) {
      const { data: result, error } = await safeDbQuery(async () => {
        // Fetch the document
        const doc = await db.systemSetting.findUnique({
          where: { key: documentKey },
        });

        if (!doc || doc.category !== "documents") {
          throw new Error("Document not found");
        }

        const parsed = JSON.parse(doc.value);
        let content = parsed.content || parsed.title || "";

        // Replace placeholders in content
        let processedContent = content;
        for (const [key, value] of Object.entries(ph)) {
          processedContent = processedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
        }

        // Send email
        const emailSent = await sendEmail({
          to: recipientEmail,
          subject: `${parsed.title || "Document"} from Valtriox`,
          html: buildTextDocumentEmail(parsed.title, processedContent, ph),
          text: `Hello ${ph.client_name},\n\nHere is the document "${parsed.title}" for ${ph.company_name}.\n\n${processedContent}\n\nBest regards,\nValtriox Team\nashir@valtriox.com`,
        });

        return {
          success: true,
          emailSent,
          recipient: recipientEmail,
          documentTitle: parsed.title,
          clientName: ph.client_name,
          companyName: ph.company_name,
          mode: "text_document",
        };
      }, 2, 500);

      if (error) {
        logger.error("[Documents/Send] Error", { error });
        if (error.includes("Document not found")) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to send document" }, { status: 503 });
      }

      if (!result?.emailSent) {
        logger.warn("[Documents/Send] Email not sent (no provider configured)", { documentKey, clientOrgId });
        return NextResponse.json({
          ...result,
          warning: "Email provider not configured. Configure RESEND_API_KEY or SMTP_* env vars.",
        });
      }

      logger.info("[Documents/Send] Text document sent successfully", result);
      return NextResponse.json(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODE 2: Uploaded File (from PlatformDocument)
    // ═══════════════════════════════════════════════════════════════════════

    if (fileId) {
      const { data: result, error } = await safeDbQuery(async () => {
        // Fetch the file record
        const file = await db.platformDocument.findUnique({
          where: { id: fileId },
        });

        if (!file || !file.isActive) {
          throw new Error("File not found");
        }

        if (!file.cloudinaryUrl) {
          throw new Error("File URL not available");
        }

        // Send email with download link
        const fileIcon = getFileIconEmoji(file.fileType);
        const fileSize = formatFileSize(file.fileSize);

        const customMessage = message || `Please find attached the document "${file.title}" which we have prepared for ${ph.company_name}.`;

        const emailSent = await sendEmail({
          to: recipientEmail,
          subject: `${file.title} | Document from Valtriox`,
          html: buildFileDocumentEmail(file, customMessage, ph, fileSize, fileIcon),
          text: `Hello ${ph.client_name},\n\n${customMessage}\n\nDocument: ${file.title}\nType: ${file.fileType.toUpperCase()}\nSize: ${fileSize}\nDownload: ${file.cloudinaryUrl}\n\nBest regards,\nValtriox Team\nashir@valtriox.com`,
        });

        return {
          success: true,
          emailSent,
          recipient: recipientEmail,
          documentTitle: file.title,
          fileName: file.fileName,
          clientName: ph.client_name,
          companyName: ph.company_name,
          downloadUrl: file.cloudinaryUrl,
          mode: "uploaded_file",
        };
      }, 2, 500);

      if (error) {
        logger.error("[Documents/Send] File send error", { error });
        if (error.includes("File not found") || error.includes("not available")) {
          return NextResponse.json({ error: error }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to send file" }, { status: 503 });
      }

      if (!result?.emailSent) {
        logger.warn("[Documents/Send] File email not sent (no provider configured)", { fileId, clientOrgId });
        return NextResponse.json({
          ...result,
          warning: "Email provider not configured. Configure RESEND_API_KEY or SMTP_* env vars.",
        });
      }

      logger.info("[Documents/Send] File sent successfully", result);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    logger.error("[Documents/Send] Error", error?.message || error);
    return NextResponse.json({ error: "Failed to send document" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] });

// ─── Email Template Builders ──────────────────────────────────────────────

function buildTextDocumentEmail(title: string, content: string, ph: Record<string, string>): string {
  const escapedContent = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #334155;">
      <div style="border-bottom: 3px solid #D4A73A; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="color: #1a1a2e; margin: 0; font-size: 24px;">Valtriox</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">COMMAND YOUR BRAND UNIVERSE</p>
      </div>
      <p style="color: #334155; font-size: 15px;">Hello <strong>${ph.client_name}</strong>,</p>
      <p style="color: #334155; font-size: 15px;">Please find below the document <strong>"${title}"</strong> prepared for <strong>${ph.company_name}</strong>.</p>
      <div style="background: #fafaf9; border: 1px solid #e8dcc8; border-radius: 10px; padding: 24px; margin: 20px 0; font-size: 14px; color: #1a1a2e; line-height: 1.7; white-space: pre-wrap;">${escapedContent}</div>
      <p style="color: #64748b; font-size: 13px;">If you have any questions, reply to this email or contact <a href="mailto:ashir@valtriox.com" style="color: #D4A73A;">ashir@valtriox.com</a></p>
      <div style="border-top: 1px solid #e8dcc8; padding-top: 16px; margin-top: 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Valtriox Platform &bull; ashir@valtriox.com &bull; valtriox.com</p>
      </div>
    </div>
  `;
}

function buildFileDocumentEmail(
  file: { title: string; fileName: string; fileType: string; cloudinaryUrl: string | null },
  message: string,
  ph: Record<string, string>,
  fileSize: string,
  fileIcon: string
): string {
  const downloadUrl = file.cloudinaryUrl || "#";
  const typeLabel = file.fileType.toUpperCase();
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #334155;">
      <div style="border-bottom: 3px solid #D4A73A; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="color: #1a1a2e; margin: 0; font-size: 24px;">Valtriox</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">COMMAND YOUR BRAND UNIVERSE</p>
      </div>
      <p style="color: #334155; font-size: 15px;">Hello <strong>${ph.client_name}</strong>,</p>
      <p style="color: #334155; font-size: 15px;">${message}</p>
      <div style="background: #fafaf9; border: 1px solid #e8dcc8; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 8px;">${fileIcon}</div>
        <p style="color: #1a1a2e; font-weight: 600; font-size: 16px; margin: 0 0 4px 0;">${file.title}</p>
        <p style="color: #64748b; font-size: 12px; margin: 0 0 16px 0;">${file.fileName} &bull; ${typeLabel} &bull; ${fileSize}</p>
        <a href="${downloadUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D4A73A, #d4a843); color: #000; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Download Document
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">If you have any questions, reply to this email or contact <a href="mailto:ashir@valtriox.com" style="color: #D4A73A;">ashir@valtriox.com</a></p>
      <div style="border-top: 1px solid #e8dcc8; padding-top: 16px; margin-top: 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Valtriox Platform &bull; ashir@valtriox.com &bull; valtriox.com</p>
      </div>
    </div>
  `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getFileIconEmoji(fileType: string): string {
  const icons: Record<string, string> = {
    pdf: "&#128196;",       // 📄
    image: "&#128247;",     // 🖼️
    document: "&#128196;",  // 📄
    spreadsheet: "&#128202;", // 📊
    archive: "&#128230;",   // 📦
  };
  return icons[fileType] || "&#128196;";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
