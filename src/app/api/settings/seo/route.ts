import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { isDbUnavailable, dbErrorResponse, withRetry } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

// Inline schema matching the SEO route's actual body fields
const seoSaveSchema = z.object({
  url: z.string().max(2048).optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  orgId: z.string().max(50).optional(),
});
import logger from "@/lib/logger";

// GET /api/settings/seo?orgId=... — Retrieve stored SEO meta tags
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Read from localStorage-style key-value in org model
    // Since we don't have a dedicated SEO table, we store in a JSON file
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(process.cwd(), "db", `seo-${orgId}.json`);

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      return NextResponse.json({ seo: data });
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

    // Store as JSON file (no Prisma schema change needed)
    const fs = require("fs");
    const path = require("path");
    const dirPath = path.join(process.cwd(), "db");

    // Ensure db directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `seo-${orgId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(seoData, null, 2));

    return NextResponse.json({ seo: seoData, success: true });
  } catch (error: unknown) {
    logger.error("[SEO POST] Error:", error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ error: "Failed to save SEO settings" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] }), { maxRequests: 30, windowSeconds: 60 });
