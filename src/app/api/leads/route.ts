import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getLeadCaptureEmailHtml } from "@/lib/email-templates";

/**
 * Fire-and-forget: send a lead capture confirmation email to the new lead.
 * Tries to fetch platform settings from DB for personalized content;
 * falls back to env vars / defaults if DB is unavailable.
 * Wrapped in try-catch so email failures never break the lead submission.
 */
function sendLeadConfirmationEmail(leadEmail: string, leadName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://valtriox.pk';
  // Dynamic PDF - generated on-the-fly from PlatformSettings (logo + contact info)
  const downloadUrl = `${baseUrl}/api/lead-magnet`;

  // Build email data - fetch settings from DB for personalization
  db.platformSettings.findFirst()
    .then((settings) => {
      const platformName = settings?.companyName || 'Valtriox';
      const emailData = {
        leadName,
        leadEmail,
        companyName: settings?.companyName || 'Valtriox',
        platformName,
        platformWebsite: settings?.companyWebsite || baseUrl,
        companyEmail: settings?.companyEmail || process.env.SMTP_FROM || process.env.RESEND_FROM?.split('<')[0]?.trim() || 'support@valtriox.com',
        companyPhone: settings?.companyPhone || null,
        companyAddress: settings?.companyAddress || null,
        whatsappNumber: settings?.whatsappNumber || null,
        instagramUrl: settings?.instagramUrl || null,
        linkedinUrl: settings?.linkedinUrl || null,
        discordUrl: settings?.discordUrl || null,
        redditUrl: settings?.redditUrl || null,
        downloadUrl,
      };

      return sendEmail({
        to: leadEmail,
        subject: `Thank You for Your Interest - ${platformName}`,
        html: getLeadCaptureEmailHtml(emailData),
      });
    })
    .catch(() => {
      // DB fetch failed - send with defaults
      logger.warn('[Leads] Could not fetch platform settings for email, using defaults');
      return sendEmail({
        to: leadEmail,
        subject: 'Thank You for Your Interest - Valtriox',
        html: getLeadCaptureEmailHtml({
          leadName,
          leadEmail,
          companyName: 'Valtriox',
          platformName: 'Valtriox',
          platformWebsite: baseUrl,
          companyEmail: process.env.SMTP_FROM || process.env.RESEND_FROM?.split('<')[0]?.trim() || 'support@valtriox.com',
          companyPhone: null,
          companyAddress: null,
          whatsappNumber: null,
          instagramUrl: null,
          linkedinUrl: null,
          discordUrl: null,
          redditUrl: null,
          downloadUrl,
        }),
      });
    })
    .then((sent) => {
      if (sent) {
        logger.info('[Leads] Confirmation email sent', { to: leadEmail });
      }
    })
    .catch((err) => {
      logger.warn('[Leads] Failed to send confirmation email', { to: leadEmail, error: String(err) });
    });
}

// POST /api/leads - Submit contact form (PUBLIC - no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sanitized = sanitizeObject(body);

    const { fullName, email, phone, company, companySize, industry, interest, message, consultationType, calendlyBookingLink } = sanitized;

    // Validation
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json({ error: "Full name is required (min 2 characters)" }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    try {
      // Check for duplicate email within last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLead = await withRetry(async () => {
        return await db.lead.findFirst({
        where: {
          email: email.trim().toLowerCase(),
          createdAt: { gte: oneDayAgo },
        },
      })
      }, 2, 500);

      if (recentLead) {
        return NextResponse.json({
          success: true,
          message: "We already received your inquiry recently. Our team will respond within 24 hours.",
          duplicate: true,
        });
      }

      // Create lead
      const lead = await withRetry(async () => {
        return await db.lead.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          company: company?.trim() || null,
          companySize: companySize || null,
          industry: industry || null,
          interest: interest || null,
          message: message?.trim() || null,
          consultationType: consultationType || null,
          calendlyBookingLink: calendlyBookingLink?.trim() || null,
          status: "new",
          source: sanitized.source || "website",
        },
      })
      }, 2, 500);

      logger.info("[Leads] New lead captured", { leadId: lead.id, email: lead.email, name: lead.fullName });

      // Fire-and-forget: send confirmation email
      sendLeadConfirmationEmail(lead.email, lead.fullName);

      return NextResponse.json({
        success: true,
        message: "Thank you! Your inquiry has been received. We'll respond within 24 hours.",
        leadId: lead.id,
      });
    } catch (dbError: any) {
      // If the Lead table doesn't exist or column is missing, try to fix
      const errMsg = dbError?.message || "";
      if (errMsg.includes("does not exist") || errMsg.includes("relation") || errMsg.includes("table") || errMsg.includes("Unknown field") || errMsg.includes("Unknown argument") || errMsg.includes("column")) {
        logger.warn("[Leads] DB error detected, attempting auto-repair:", errMsg);
        try {
          // Create table with ALL columns (including consultation scheduling fields)
          await db.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Lead" (
              "id" TEXT NOT NULL,
              "fullName" TEXT NOT NULL,
              "email" TEXT NOT NULL,
              "phone" TEXT,
              "company" TEXT,
              "companySize" TEXT,
              "industry" TEXT,
              "interest" TEXT,
              "message" TEXT,
              "consultationType" TEXT,
              "preferredDate" TEXT,
              "preferredTime" TEXT,
              "timezone" TEXT,
              "availabilityNote" TEXT,
              "calendlyBookingLink" TEXT,
              "status" TEXT NOT NULL DEFAULT 'new',
              "source" TEXT NOT NULL DEFAULT 'website',
              "notes" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
            );
          `);
          // Add missing columns individually (safe if they already exist)
          const alterCols = [
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consultationType" TEXT',
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredDate" TEXT',
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT',
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "timezone" TEXT',
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "availabilityNote" TEXT',
            'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "calendlyBookingLink" TEXT',
          ];
          for (const col of alterCols) {
            try { await db.$executeRawUnsafe(col); } catch { /* column may already exist */ }
          }
          logger.info("[Leads] Table repaired successfully, retrying insert...");

          // Retry the lead creation
          const lead = await withRetry(async () => {
            return await db.lead.create({
            data: {
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone?.trim() || null,
              company: company?.trim() || null,
              companySize: companySize || null,
              industry: industry || null,
              interest: interest || null,
              message: message?.trim() || null,
              consultationType: consultationType || null,
              calendlyBookingLink: calendlyBookingLink?.trim() || null,
              status: "new",
              source: sanitized.source || "website",
            },
          })
          }, 2, 500);

          logger.info("[Leads] New lead captured after table creation", { leadId: lead.id, email: lead.email });

          // Fire-and-forget: send confirmation email
          sendLeadConfirmationEmail(lead.email, lead.fullName);

          return NextResponse.json({
            success: true,
            message: "Thank you! Your inquiry has been received. We'll respond within 24 hours.",
            leadId: lead.id,
          });
        } catch (retryErr: any) {
          logger.error("[Leads] Failed to create table or insert lead", retryErr);
          // Still return success so the user gets a good experience
          const fallbackEmail = (email as string).trim().toLowerCase();
          const fallbackName = (fullName as string).trim();
          if (fallbackEmail) {
            sendLeadConfirmationEmail(fallbackEmail, fallbackName);
          }
          return NextResponse.json({
            success: true,
            message: "Thank you! Your inquiry has been received. We'll respond within 24 hours.",
            fallback: true,
          });
        }
      }

      // Database connection error - still return success for UX
      if (errMsg.includes("DATABASE_URL") || errMsg.includes("connection") || errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT") || errMsg.includes("too many connections") || errMsg.includes("pool")) {
        logger.error("[Leads] Database connection failed, logging lead data", { fullName, email });
        // Fire-and-forget: send confirmation email even on DB failure
        const connErrEmail = (email as string).trim().toLowerCase();
        const connErrName = (fullName as string).trim();
        if (connErrEmail) {
          sendLeadConfirmationEmail(connErrEmail, connErrName);
        }
        return NextResponse.json({
          success: true,
          message: "Thank you! Your inquiry has been received. We'll respond within 24 hours.",
          fallback: true,
        });
      }

      throw dbError;
    }
  } catch (error: any) {
    logger.error("[Leads] Submit error", { message: error?.message, stack: error?.stack, name: error?.constructor?.name });
    // Still return success for better UX - log lead data for manual processing
    logger.warn("[Leads] Returning success despite error (UX fallback)", { fullName, email });
 return NextResponse.json({
      success: true,
      message: "Thank you! Your inquiry has been received. We'll respond within 24 hours.",
      fallback: true,
    });
  }
}

// GET /api/leads - List leads (admin only)
export { GET } from "@/app/api/admin/leads/route";
