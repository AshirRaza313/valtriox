import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { isPlatformRole } from "@/lib/roles";

// ============================================================================
// Payment Gateways Configuration API
// ============================================================================
// Manages PayPro and Safepay gateway settings via SystemSetting table.
// Keys: "gateway_paypro_config", "gateway_safepay_config"
// ============================================================================

interface PlanMapping {
  planId: string;
  planName: string;
  safepayTierId: string;
  linked: boolean;
}

interface GatewayConfig {
  apiKey: string;
  merchantId: string;
  webhookUrl: string;
  environment: "sandbox" | "live";
  enabled: boolean;
  secretKey?: string;
  webhookSecret?: string;
  planMappings?: PlanMapping[]; // Safepay plan tier mappings
}

// GET /api/admin/payment-gateways - Returns all gateway configs
export const GET = withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const settings = await withRetry(async () => {
      return await db.systemSetting.findMany({
      where: {
        key: { in: ["gateway_paypro_config", "gateway_safepay_config"] },
      },
    })
    }, 2, 500);

    const configMap: Record<string, GatewayConfig | null> = {
      paypro: null,
      safepay: null,
    };

    for (const s of settings) {
      try {
        const parsed = JSON.parse(s.value);
        if (s.key === "gateway_paypro_config") configMap.paypro = parsed;
        if (s.key === "gateway_safepay_config") configMap.safepay = parsed;
      } catch {
        // Ignore corrupt settings
      }
    }

    // Mask API keys in response
    const mask = (val: string) => val ? `${val.slice(0, 4)}${"•".repeat(Math.min(val.length - 4, 12))}` : "";
    const maskSecret = (val: string) => val ? `${"•".repeat(Math.min(val.length, 16))}` : "";

    const safePaypro = configMap.paypro
      ? { ...configMap.paypro, apiKey: mask(configMap.paypro.apiKey), secretKey: maskSecret(configMap.paypro.secretKey || "") }
      : null;

    const safeSafepay = configMap.safepay
      ? { ...configMap.safepay, apiKey: mask(configMap.safepay.apiKey), secretKey: maskSecret(configMap.safepay.secretKey || ""), webhookSecret: maskSecret(configMap.safepay.webhookSecret || "") }
      : null;

    return NextResponse.json({
      paypro: safePaypro,
      safepay: safeSafepay,
    });
  } catch (error: any) {
    logger.error("[PaymentGateways] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch gateway configurations" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "owner"], requireOrg: false });

// PUT /api/admin/payment-gateways - Updates gateway config
export const PUT = withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json();
    const { gateway, config } = body;

    if (!gateway || !["paypro", "safepay"].includes(gateway)) {
      return NextResponse.json({ error: "Invalid gateway. Must be 'paypro' or 'safepay'" }, { status: 400 });
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "config object is required" }, { status: 400 });
    }

    const settingKey = `gateway_${gateway}_config`;

    // Validate required fields
    if (gateway === "paypro") {
      if (!config.apiKey && config.enabled) {
        return NextResponse.json({ error: "API Key is required when enabling PayPro" }, { status: 400 });
      }
    }

    if (gateway === "safepay") {
      if (!config.apiKey && config.enabled) {
        return NextResponse.json({ error: "API Key is required when enabling Safepay" }, { status: 400 });
      }
    }

    // Build the config to store
    const storeConfig: any = {
      apiKey: config.apiKey || "",
      merchantId: config.merchantId || "",
      webhookUrl: config.webhookUrl || "",
      environment: config.environment || "sandbox",
      enabled: config.enabled ?? false,
    };

    if (gateway === "safepay") {
      storeConfig.secretKey = config.secretKey || "";
      storeConfig.webhookSecret = config.webhookSecret || "";
      // Persist Safepay plan mappings
      if (config.planMappings && Array.isArray(config.planMappings)) {
        storeConfig.planMappings = config.planMappings;
      }
    }

    // Upsert into SystemSetting
    const existing = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: settingKey } })
    }, 2, 500);

    if (existing) {
      await withRetry(async () => {
        return await db.systemSetting.update({
        where: { key: settingKey },
        data: { value: JSON.stringify(storeConfig), updatedAt: new Date() },
      })
      }, 2, 500);
    } else {
      await withRetry(async () => {
        return await db.systemSetting.create({
        data: {
          id: `gw-${gateway}-${Date.now()}`,
          key: settingKey,
          value: JSON.stringify(storeConfig),
          category: "payment_gateway",
        },
      })
      }, 2, 500);
    }

    logger.info(`[PaymentGateways] Updated ${gateway} config`, { userId: authCtx.userId });

    return NextResponse.json({
      success: true,
      message: `${gateway === "paypro" ? "PayPro" : "Safepay"} configuration saved`,
    });
  } catch (error: any) {
    logger.error("[PaymentGateways] PUT error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to save gateway configuration" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "owner"], requireOrg: false });
