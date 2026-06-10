import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";

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

export const GET = withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    await ensureDb();

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
  } catch (error: any) {
    logger.error("WhiteLabel GET error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS, isNew: true, fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch white-label settings" }, { status: 500 });
  }
});

// ============================================================================
// PUT - Save white-label settings for the organization
// ============================================================================

export const PUT = withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await req.json();
    const sanitized = sanitizeObject(body);

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
        settings[field] = sanitized[field];
      }
    }

    await ensureDb();

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
  } catch (error: any) {
    logger.error("WhiteLabel PUT error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to save white-label settings" }, { status: 500 });
  }
});

// ============================================================================
// GET /api/settings/white-label/all - Fetch all orgs' white-label settings (Platform Owner only)
// ============================================================================

export async function ALL(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-user-role");
    if (!authHeader || !["platform_owner", "platform_admin", "owner", "admin"].includes(authHeader)) {
      return NextResponse.json({ error: "Access denied. Platform owner only." }, { status: 403 });
    }

    await ensureDb();

    const result = await withRetry(async () => {
      const allSettings = await db.systemSetting.findMany({
        where: { category: "white_label" },
      });

      const orgSettings = allSettings.map((s) => {
        try {
          return { key: s.key, settings: JSON.parse(s.value) };
        } catch {
          return { key: s.key, settings: DEFAULT_SETTINGS };
        }
      });

      return orgSettings;
    }, 2, 500);

    return NextResponse.json({ organizations: result });
  } catch (error: any) {
    logger.error("WhiteLabel ALL error", error);
    return NextResponse.json({ error: "Failed to fetch all white-label settings" }, { status: 500 });
  }
}
