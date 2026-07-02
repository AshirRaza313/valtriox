import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/admin/contact-form - Fetch current form configuration
export const GET = withRateLimit(withAuth(async (req: NextRequest) => {
  try {
    // Phase 6: Fixed query — PlatformSettings is a singleton model, no 'key' field
    const setting = await withRetry(async () => {
      return await db.systemSetting.findUnique({
      where: { key: "contact_form_config" },
    })
    }, 2, 500);

    const fields = setting?.value
      ? JSON.parse(String(setting.value))
      : null;

    return NextResponse.json({ fields });
  } catch (error: unknown) {
    logger.error("[Admin Contact Form] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ fields: null }, { status: 200 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });

// PUT /api/admin/contact-form - Update form configuration
export const PUT = withRateLimit(withAuth(async (req: NextRequest) => {
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

    // Phase 6: Fixed query — use SystemSetting model (has key/value), not PlatformSettings
    await withRetry(async () => {
      return await db.systemSetting.upsert({
      where: { key: "contact_form_config" },
      update: { value: JSON.stringify(fields) },
      create: { key: "contact_form_config", value: JSON.stringify(fields), category: "contact-form" },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, fields });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Admin Contact Form] PUT error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to save form configuration" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
