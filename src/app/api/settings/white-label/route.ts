import { NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

// Inline schema for white-label settings matching the route's allowed fields
const whiteLabelSaveSchema = z.object({
  customDomain: z.string().max(253).optional(),
  sslStatus: z.enum(["inactive", "pending", "active"]).optional(),
  customPortalTitle: z.string().max(200).optional(),
  customFaviconUrl: z.string().max(2048).optional(),
  customLogoUrl: z.string().max(2048).optional(),
  removePoweredByFooter: z.boolean().optional(),
  removeValtrioxLoginLogo: z.boolean().optional(),
  customEmailSenderName: z.boolean().optional(),
  customEmailSenderNameValue: z.string().max(200).optional(),
  customLoginHeading: z.boolean().optional(),
  customLoginHeadingValue: z.string().max(200).optional(),
  customLoginBgImage: z.boolean().optional(),
  customLoginBgImageUrl: z.string().max(2048).optional(),
  supportEmail: z.string().max(254).optional(),
  emailSenderName: z.string().max(200).optional(),
  emailReplyTo: z.string().max(254).optional(),
  emailHeaderColor: z.string().max(7).optional(),
  emailFooterText: z.string().max(1000).optional(),
});

// ============================================================================
// Default white-label settings (used when no settings exist yet)
// ============================================================================

const DEFAULT_SETTINGS = {
  // Section A: Brand Portal Configuration
  customDomain: "",
  sslStatus: "inactive",           // inactive, pending, active
  customPortalTitle: "",
  customFaviconUrl: "",
  customLogoUrl: "",

  // Section B: Brand Removal Settings
  removePoweredByFooter: false,
  removeValtrioxLoginLogo: false,
  customEmailSenderName: false,   // toggle
  customEmailSenderNameValue: "",
  customLoginHeading: false,       // toggle
  customLoginHeadingValue: "",
  customLoginBgImage: false,       // toggle
  customLoginBgImageUrl: "",
  supportEmail: "",

  // Section C: Email Branding
  emailSenderName: "",
  emailReplyTo: "",
  emailHeaderColor: "#059669",
  emailFooterText: "",

  // Section D: Preview (computed on client)
};

// ============================================================================
// GET - Fetch white-label settings for the organization
// ============================================================================

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }
    const result = await withRetry(async () => {
      const setting = await db.systemSetting.findUnique({
        where: { key: `white_label:${orgId}` },
      });

      if (!setting) {
        return { settings: DEFAULT_SETTINGS, isNew: true };
      }

      try {
        const parsed = JSON.parse(setting.value);
        // Merge with defaults so new fields always have a value
        return { settings: { ...DEFAULT_SETTINGS, ...parsed }, isNew: false };
      } catch {
        return { settings: DEFAULT_SETTINGS, isNew: true };
      }
    }, 2, 500);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("WhiteLabel GET error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS, isNew: true, fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch white-label settings" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

// ============================================================================
// PUT - Save white-label settings for the organization
// ============================================================================

export const PUT = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const bodyResult = await validateBody(req, whiteLabelSaveSchema);
    if (!bodyResult.success) return bodyResult.response;
    const sanitized = bodyResult.data;

    // Extract only the known fields
    const allowedFields = [
      "customDomain",
      "sslStatus",
      "customPortalTitle",
      "customFaviconUrl",
      "customLogoUrl",
      "removePoweredByFooter",
      "removeValtrioxLoginLogo",
      "customEmailSenderName",
      "customEmailSenderNameValue",
      "customLoginHeading",
      "customLoginHeadingValue",
      "customLoginBgImage",
      "customLoginBgImageUrl",
      "supportEmail",
      "emailSenderName",
      "emailReplyTo",
      "emailHeaderColor",
      "emailFooterText",
    ];

    const settings: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in sanitized) {
        settings[field] = sanitized[field as keyof typeof sanitized];
      }
    }
    const result = await withRetry(async () => {
      const jsonValue = JSON.stringify(settings);

      // Upsert the setting
      const upserted = await db.systemSetting.upsert({
        where: { key: `white_label:${orgId}` },
        create: {
          key: `white_label:${orgId}`,
          value: jsonValue,
          category: "white_label",
        },
        update: {
          value: jsonValue,
        },
      });

      return { success: true, settings };
    }, 2, 500);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("WhiteLabel PUT error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to save white-label settings" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
