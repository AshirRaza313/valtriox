import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// GET /api/admin/automations - List all automations
export const GET = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();

    const automations = await withRetry(async () => {
      return await db.automation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          select: { id: true, name: true, type: true },
        },
      },
    })
    }, 2, 500);

    return NextResponse.json({ automations });
  } catch (error: any) {
    logger.error("[Admin Automations] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch automations", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// POST /api/admin/automations - Create automation
export const POST = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const body = await req.json();
    const { name, description, trigger, triggerConfig, templateId, action, actionConfig, delayMinutes, enabled } = body;

    if (!name || !trigger) {
      return NextResponse.json({ error: "Name and trigger are required" }, { status: 400 });
    }

    const validTriggers = ["lead_created", "consultation_scheduled", "proposal_sent", "status_changed", "manual"];
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json({ error: `Invalid trigger. Must be one of: ${validTriggers.join(", ")}` }, { status: 400 });
    }

    const automation = await withRetry(async () => {
      return await db.automation.create({
      data: {
        name,
        description: description || null,
        trigger,
        triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : "{}",
        templateId: templateId || null,
        action: action || "send_email",
        actionConfig: actionConfig ? JSON.stringify(actionConfig) : "{}",
        delayMinutes: delayMinutes || 0,
        enabled: enabled !== undefined ? enabled : true,
      },
      include: {
        template: { select: { id: true, name: true, type: true } },
      },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, automation });
  } catch (error: any) {
    logger.error("[Admin Automations] POST error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create automation", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// PUT /api/admin/automations - Update automation (toggle enable/disable, update config, run now)
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: "Automation ID is required" }, { status: 400 });

    // Handle "run now" action
    if (updateData.runNow) {
      const automation = await withRetry(async () => {
        return await db.automation.update({
        where: { id },
        data: {
          lastRunAt: new Date(),
          runCount: { increment: 1 },
        },
        include: { template: { select: { id: true, name: true, type: true } } },
      })
      }, 2, 500);

      logger.info(`[Admin Automations] Manual run triggered for: ${automation.name}`);
      return NextResponse.json({ success: true, automation, message: `Automation "${automation.name}" triggered successfully` });
    }

    // Handle toggle enable/disable
    if (updateData.toggleEnabled !== undefined) {
      const current = await withRetry(async () => {
        return await db.automation.findUnique({ where: { id } })
      }, 2, 500);
      if (!current) return NextResponse.json({ error: "Automation not found" }, { status: 404 });

      const automation = await withRetry(async () => {
        return await db.automation.update({
        where: { id },
        data: { enabled: !current.enabled },
        include: { template: { select: { id: true, name: true, type: true } } },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, automation });
    }

    // Handle general update
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && value !== null && !["runNow", "toggleEnabled"].includes(key)) {
        if (["triggerConfig", "actionConfig"].includes(key) && typeof value !== "string") {
          cleanData[key] = JSON.stringify(value);
        } else {
          cleanData[key] = value;
        }
      }
    }

    const automation = await withRetry(async () => {
      return await db.automation.update({
      where: { id },
      data: cleanData,
      include: { template: { select: { id: true, name: true, type: true } } },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, automation });
  } catch (error: any) {
    logger.error("[Admin Automations] PUT error", error);
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update automation", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// DELETE /api/admin/automations - Delete automation
export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Automation ID is required" }, { status: 400 });

    await withRetry(async () => {
      return await db.automation.delete({ where: { id } })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("[Admin Automations] DELETE error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete automation", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
