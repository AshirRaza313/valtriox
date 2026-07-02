import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, dbErrorResponse, withRetry, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import logger from "@/lib/logger";

// Inline schema matching the SEO route's actual body fields
const seoSaveSchema = z.object({
  url: z.string().max(2048).optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  orgId: z.string().max(50).optional(),
});

// ── SEO settings storage key helper ──
// Stored in SystemSetting as key-value pairs: `seo:${orgId}` → JSON string
function seoSettingKey(orgId: string): string {
  return `seo:${orgId}`;
}

// GET /api/settings/seo?orgId=... — Retrieve stored SEO meta tags
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Read from database (SystemSetting key-value store)
    const { data: setting, error } = await safeDbQuery(async () => {
      return await db.systemSetting.findUnique({
        where: { key: seoSettingKey(orgId) },
      });
    }, 2, 500);

    if (error) {
      logger.error("[SEO GET] DB error", { error });
      if (isDbUnavailable(error)) return dbErrorResponse(error);
      return NextResponse.json({ seo: null });
    }

    if (setting?.value) {
      try {
        const data = JSON.parse(setting.value);
        return NextResponse.json({ seo: data });
      } catch {
        logger.warn("[SEO GET] Corrupted SEO setting in DB, returning null", { orgId });
        return NextResponse.json({ seo: null });
      }
    }

    return NextResponse.json({ seo: null });
  } catch (error: unknown) {
    logger.error("[SEO GET] Error:", error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ seo: null });
  }
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });

// POST /api/settings/seo — Save SEO meta tags
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const bodyResult = await validateBody(req, seoSaveSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { url, title, description, orgId: bodyOrgId } = bodyResult.data;
    const orgId = bodyOrgId || authCtx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const seoData = {
      url: url || "",
      title: title || "",
      description: description || "",
      updatedAt: new Date().toISOString(),
    };

    // Store in database using SystemSetting upsert (key-value storage)
    // This works on Vercel serverless — no filesystem access needed.
    const { error } = await safeDbQuery(async () => {
      return await db.systemSetting.upsert({
        where: { key: seoSettingKey(orgId) },
        update: {
          value: JSON.stringify(seoData),
          category: "seo",
        },
        create: {
          key: seoSettingKey(orgId),
          value: JSON.stringify(seoData),
          category: "seo",
        },
      });
    }, 2, 500);

    if (error) {
      logger.error("[SEO POST] DB error", { error });
      if (isDbUnavailable(error)) return dbErrorResponse(error);
      return NextResponse.json({ error: "Failed to save SEO settings" }, { status: 503 });
    }

    return NextResponse.json({ seo: seoData, success: true });
  } catch (error: unknown) {
    logger.error("[SEO POST] Error:", error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ error: "Failed to save SEO settings" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] }), { maxRequests: 30, windowSeconds: 60 });
