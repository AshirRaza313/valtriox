import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { ensureDb, isDbUnavailable, dbErrorResponse, withRetry } from "@/lib/db";

// GET /api/settings/seo?orgId=... — Retrieve stored SEO meta tags
export const GET = withAuth(async (req: NextRequest, authCtx) => {
  try {
    await ensureDb();
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
  } catch (error: any) {
    console.error("[SEO GET] Error:", error?.message || error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ seo: null });
  }
}, { requireOrg: true });

// POST /api/settings/seo — Save SEO meta tags
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    await ensureDb();
    const body = await req.json();
    const { url, title, description, orgId: bodyOrgId } = body;
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
  } catch (error: any) {
    console.error("[SEO POST] Error:", error?.message || error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ error: "Failed to save SEO settings" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] });
