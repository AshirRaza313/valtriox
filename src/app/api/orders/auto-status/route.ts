import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Status Rules API
// Stores rules in SystemSetting with key: "auto-status-rules-{orgId}"
// ─────────────────────────────────────────────────────────────────────────────

// Inline schema for auto-status rules
const autoStatusRuleSchema = z.object({
  id: z.string().max(100),
  triggerStatus: z.string().min(1).max(50),
  targetStatus: z.string().min(1).max(50),
  delayHours: z.number().min(0).max(720),
  enabled: z.boolean(),
});

const saveAutoStatusRulesSchema = z.object({
  orgId: z.string().min(1).max(50),
  rules: z.array(autoStatusRuleSchema).min(1, "At least one rule is required"),
});

interface AutoStatusRule {
  id: string;
  triggerStatus: string;     // e.g. "delivered"
  targetStatus: string;      // e.g. "completed"
  delayHours: number;        // e.g. 24
  enabled: boolean;
}

// GET: Retrieve auto-status rules for an organization
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Auto-Status] GET request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const orgId = authCtx.organizationId!;

    const setting = await withRetry(async () => {
      return db.systemSetting.findUnique({
      where: { key: `auto-status-rules-${orgId}` },
    });
    }, 2, 500);

    const rules: AutoStatusRule[] = setting
      ? JSON.parse(setting.value)
      : getDefaultRules();

    return NextResponse.json({ rules, orgId });
  } catch (error: unknown) {
    logger.error("Fetch auto-status rules error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch auto-status rules" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

// POST: Create or update auto-status rules for an organization
// This endpoint also supports cron calls (requireOrg: false to allow cron without org context)
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Auto-Status] POST request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const bodyResult = await validateBody(req, saveAutoStatusRulesSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { orgId, rules } = bodyResult.data;

    // Security: if auth has an org, verify the body's orgId matches
    if (authCtx.organizationId && orgId !== authCtx.organizationId) {
      return NextResponse.json(
        { error: "Organization mismatch. You can only manage rules for your own organization." },
        { status: 403 }
      );
    }

    const value = JSON.stringify(rules);

    await withRetry(async () => {
      return db.systemSetting.upsert({
      where: { key: `auto-status-rules-${orgId}` },
      create: {
        key: `auto-status-rules-${orgId}`,
        value,
        category: "automation",
      },
      update: { value },
    });
    }, 2, 500);

    return NextResponse.json({ success: true, rules, orgId });
  } catch (error: unknown) {
    logger.error("Save auto-status rules error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to save auto-status rules" }, { status: 500 });
  }
}, { requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// Default auto-status rules
function getDefaultRules(): AutoStatusRule[] {
  return [
    {
      id: "rule-1",
      triggerStatus: "delivered",
      targetStatus: "completed",
      delayHours: 24,
      enabled: true,
    },
    {
      id: "rule-2",
      triggerStatus: "confirmed",
      targetStatus: "packed",
      delayHours: 4,
      enabled: false,
    },
    {
      id: "rule-3",
      triggerStatus: "packed",
      targetStatus: "dispatched",
      delayHours: 12,
      enabled: false,
    },
  ];
}
