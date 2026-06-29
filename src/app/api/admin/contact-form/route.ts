import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// GET /api/admin/contact-form - Fetch current form configuration
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const setting = await withRetry(async () => {
      return await db.platformSettings.findFirst({
      where: { key: "contact_form_config" },
    })
    }, 2, 500);

    const fields = setting?.value
      ? JSON.parse(String(setting.value))
      : null;

    return NextResponse.json({ fields });
  } catch (error: any) {
    logger.error("[Admin Contact Form] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ fields: null }, { status: 200 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// PUT /api/admin/contact-form - Update form configuration
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { fields } = body;

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: "fields array is required" },
        { status: 400 }
      );
    }

    // Validate each field has required properties
    for (const field of fields) {
      if (!field.key || !field.label || !field.status) {
        return NextResponse.json(
          { error: "Each field must have key, label, and status" },
          { status: 400 }
        );
      }
      if (!["required", "optional", "hidden"].includes(field.status)) {
        return NextResponse.json(
          { error: `Invalid status "${field.status}" for field "${field.key}". Must be: required, optional, or hidden` },
          { status: 400 }
        );
      }
    }

    await withRetry(async () => {
      return await db.platformSettings.upsert({
      where: { key: "contact_form_config" },
      update: { value: JSON.stringify(fields) },
      create: { key: "contact_form_config", value: JSON.stringify(fields) },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, fields });
  } catch (error: any) {
    logger.error("[Admin Contact Form] PUT error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to save form configuration" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
