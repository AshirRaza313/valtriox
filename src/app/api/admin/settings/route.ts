import { NextRequest, NextResponse } from "next/server";
import { db, ensurePlatformSettingsColumns, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
//  Uses Prisma ORM with pgbouncer=true (configured in db.ts).
//  Auto-repairs missing columns via shared ensurePlatformSettingsColumns().
// ═══════════════════════════════════════════════════════════════════════════

// Default settings returned when DB is truly unavailable
const DEFAULT_SETTINGS = {
  id: "default",
  companyName: "Valtriox",
  companyEmail: "ashir@valtriox.com",
  companyPhone: "",
  companyWebsite: "",
  companyAddress: "",
  supportHours: "Mon-Fri: 9AM-6PM PKT",
  whatsappNumber: "",
  instagramUrl: "",
  facebookUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
  discordUrl: "",
  redditUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  socialLinksVisible: "true",
  showInstagram: false,
  showFacebook: false,
  showTwitter: false,
  showLinkedin: false,
  showDiscord: false,
  showReddit: false,
  showYoutube: false,
  showTiktok: false,
  showWhatsApp: false,
  paymentMethods: [],
  currency: "PKR",
  logoUrl: "",
  faviconUrl: "",
  primaryBrandColor: "#D4A73A",
  secondaryBrandColor: "#D4A73A",
  currencySymbol: "Rs.",
  customCss: "",
  tagline: "COMMAND YOUR BRAND UNIVERSE",
  emailFooterText: "",
  invoiceHeaderText: "",
};

/**
 * Convert a Prisma record to the frontend-friendly format.
 */
function formatRow(row: any) {
  return {
    id: row.id || "",
    companyName: row.companyName || "",
    companyEmail: row.companyEmail || "",
    companyPhone: row.companyPhone || "",
    companyWebsite: row.companyWebsite || "",
    companyAddress: row.companyAddress || "",
    supportHours: row.supportHours || "Mon-Fri: 9AM-6PM PKT",
    whatsappNumber: row.whatsappNumber || "",
    instagramUrl: row.instagramUrl || "",
    facebookUrl: row.facebookUrl || "",
    twitterUrl: row.twitterUrl || "",
    linkedinUrl: row.linkedinUrl || "",
    discordUrl: row.discordUrl || "",
    redditUrl: row.redditUrl || "",
    youtubeUrl: row.youtubeUrl || "",
    tiktokUrl: row.tiktokUrl || "",
    socialLinksVisible: row.socialLinksVisible || "true",
    showInstagram: Boolean(row.showInstagram),
    showFacebook: Boolean(row.showFacebook),
    showTwitter: Boolean(row.showTwitter),
    showLinkedin: Boolean(row.showLinkedin),
    showDiscord: Boolean(row.showDiscord),
    showReddit: Boolean(row.showReddit),
    showYoutube: Boolean(row.showYoutube),
    showTiktok: Boolean(row.showTiktok),
    showWhatsApp: Boolean(row.showWhatsApp),
    paymentMethods: row.paymentMethods
      ? typeof row.paymentMethods === "string"
        ? JSON.parse(row.paymentMethods || "[]")
        : row.paymentMethods
      : [],
    currency: row.currency || "PKR",
    logoUrl: row.logoUrl || "",
    faviconUrl: row.faviconUrl || "",
    primaryBrandColor: row.primaryBrandColor || "#D4A73A",
    secondaryBrandColor: row.secondaryBrandColor || "#D4A73A",
    currencySymbol: row.currencySymbol || "Rs.",
    customCss: row.customCss || "",
    leadMagnetTitle: row.leadMagnetTitle || "",
    leadMagnetDescription: row.leadMagnetDescription || "",
    leadMagnetEmailSubject: row.leadMagnetEmailSubject || "",
    leadMagnetEmailBody: row.leadMagnetEmailBody || "",
    leadMagnetPdfUrl: row.leadMagnetPdfUrl || "",
    leadMagnetSentCount: row.leadMagnetSentCount || 0,
    leadMagnetDownloadCount: row.leadMagnetDownloadCount || 0,
    tagline: row.tagline || "COMMAND YOUR BRAND UNIVERSE",
    emailFooterText: row.emailFooterText || "",
    invoiceHeaderText: row.invoiceHeaderText || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET - Fetch Platform Settings
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withRateLimit(withAuth(async (_req: NextRequest, authCtx) => {
  logger.info("[Admin Settings] GET request", { userId: authCtx.userId });

  try {
    // Auto-repair missing columns (shared from db.ts)
    await ensurePlatformSettingsColumns();

    const result = await withRetry(async () => {
      const settings = await db.platformSettings.findFirst({
        orderBy: { createdAt: "desc" },
      });

      if (settings) {
        return { settings: formatRow(settings) };
      }

      // No row exists - create a default one
      const created = await db.platformSettings.create({
        data: {
          companyName: "Valtriox",
          companyEmail: "ashir@valtriox.com",
          currency: "PKR",
        },
      });

      return { settings: formatRow(created) };
    }, 2, 500);
    return NextResponse.json(result);
  } catch (error: any) {
    const msg = error?.message || String(error);
    logger.error("[Admin Settings] GET error:", msg);

    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      fallback: true,
      reason: process.env.NODE_ENV === 'production' ? undefined : msg,
    });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════════
//  PUT - Update Platform Settings
// ═══════════════════════════════════════════════════════════════════════════

export const PUT = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Settings] PUT request", { userId: authCtx.userId });

  try {
    // Auto-repair missing columns (shared from db.ts)
    await ensurePlatformSettingsColumns();

    const body = await req.json();

    // Fields allowed for update
    const textFields = [
      "companyName", "companyEmail", "companyPhone", "companyWebsite",
      "companyAddress", "supportHours", "whatsappNumber", "instagramUrl",
      "facebookUrl", "twitterUrl", "linkedinUrl", "discordUrl", "redditUrl",
      "youtubeUrl", "tiktokUrl", "socialLinksVisible", "currency",
      "logoUrl", "faviconUrl", "primaryBrandColor", "secondaryBrandColor",
      "currencySymbol", "customCss", "tagline", "emailFooterText",
      "invoiceHeaderText", "leadMagnetTitle", "leadMagnetDescription",
      "leadMagnetEmailSubject", "leadMagnetEmailBody", "leadMagnetPdfUrl",
    ];

    const booleanFields = [
      "showInstagram", "showFacebook", "showTwitter", "showLinkedin",
      "showDiscord", "showReddit", "showYoutube", "showTiktok", "showWhatsApp",
    ];

    // Build Prisma update data
    const data: Record<string, any> = { updatedAt: new Date() };

    // Map URL fields to their show* toggles - auto-enable toggle when URL is set
    const urlToShowToggle: Record<string, string> = {
      instagramUrl: "showInstagram",
      facebookUrl: "showFacebook",
      twitterUrl: "showTwitter",
      linkedinUrl: "showLinkedin",
      discordUrl: "showDiscord",
      redditUrl: "showReddit",
      youtubeUrl: "showYoutube",
      tiktokUrl: "showTiktok",
      whatsappNumber: "showWhatsApp",
    };

    for (const field of textFields) {
      if (body[field] !== undefined) {
        data[field] = String(body[field]);
        // Auto-enable the corresponding show* toggle when a URL/number is provided
        const showField = urlToShowToggle[field];
        if (showField && body[showField] === undefined) {
          // Only auto-enable if admin didn't explicitly set the toggle
          const val = String(body[field]).trim();
          if (val) {
            data[showField] = true;
          }
        }
      }
    }

    for (const field of booleanFields) {
      if (body[field] !== undefined) {
        data[field] = Boolean(body[field]);
      }
    }

    if (body.paymentMethods !== undefined) {
      data.paymentMethods = typeof body.paymentMethods === "string"
        ? body.paymentMethods
        : JSON.stringify(body.paymentMethods);
    }

    if (Object.keys(data).length <= 1) {
      return NextResponse.json({
        success: false,
        error: "No fields to update",
      }, { status: 400 });
    }

    const result = await withRetry(async () => {
      // Find existing row
      const existing = await db.platformSettings.findFirst({
        orderBy: { createdAt: "desc" },
      });

      let row;

      if (existing) {
        row = await db.platformSettings.update({
          where: { id: existing.id },
          data,
        });
        logger.info("[Admin Settings] Updated row:", { id: existing.id });
      } else {
        row = await db.platformSettings.create({
          data: {
            companyName: data.companyName || "Valtriox",
            companyEmail: data.companyEmail || "ashir@valtriox.com",
            currency: data.currency || "PKR",
            ...data,
          },
        });
        logger.info("[Admin Settings] Created new row");
      }

      return { success: true, settings: formatRow(row) };
    }, 2, 500);
    return NextResponse.json(result);

  } catch (error: any) {
    const msg = error?.message || String(error);
    logger.error("[Admin Settings] PUT error:", msg);

    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Could not save settings" : `Could not save settings: ${msg}`,
      details: process.env.NODE_ENV === "production" ? undefined : msg,
    }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
