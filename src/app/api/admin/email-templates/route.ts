import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// GET /api/admin/email-templates - List all email templates
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const [templates, total] = await Promise.all([
      db.emailTemplate.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.emailTemplate.count(),
    ]);

    return NextResponse.json({ templates, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    logger.error("[Admin Email Templates] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch email templates", details: process.env.NODE_ENV === "production" ? undefined : error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// POST /api/admin/email-templates - Create new email template
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { type, name, subject, htmlContent, textContent, variables } = body;

    if (!type || !name || !subject || !htmlContent) {
      return NextResponse.json({ error: "Type, name, subject, and htmlContent are required" }, { status: 400 });
    }

    const template = await withRetry(async () => {
      return await db.emailTemplate.create({
      data: {
        type,
        name,
        subject,
        htmlContent,
        textContent: textContent || "",
        variables: variables || "[]",
      },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    logger.error("[Admin Email Templates] POST error", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A template with this type already exists" }, { status: 409 });
    }
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create email template", details: process.env.NODE_ENV === "production" ? undefined : error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// PUT /api/admin/email-templates - Update email template
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: "Template ID is required" }, { status: 400 });

    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && value !== null) cleanData[key] = value;
    }

    const template = await withRetry(async () => {
      return await db.emailTemplate.update({
      where: { id },
      data: cleanData,
    })
    }, 2, 500);

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    logger.error("[Admin Email Templates] PUT error", error);
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A template with this type already exists" }, { status: 409 });
    }
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update email template", details: process.env.NODE_ENV === "production" ? undefined : error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// DELETE /api/admin/email-templates - Delete email template
export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Template ID is required" }, { status: 400 });

    await withRetry(async () => {
      return await db.emailTemplate.delete({ where: { id } })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("[Admin Email Templates] DELETE error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete email template", details: process.env.NODE_ENV === "production" ? undefined : error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
