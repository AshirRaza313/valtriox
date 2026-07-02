import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { isPlatformRole } from "@/lib/roles";
import { withRateLimit } from "@/lib/rate-limit";

// ============================================================================
// Payment Gateway Server-Side Test Connection
// ============================================================================
// Tests PayPro and Safepay connectivity from the server (avoids CORS issues).
// Reads gateway config from SystemSetting table.
// ============================================================================

const GATEWAY_BASES: Record<string, Record<string, string>> = {
  paypro: {
    live: "https://paypro.com.pk",
    sandbox: "https://sandbox.paypro.com.pk",
  },
  safepay: {
    live: "https://api.getsafepay.com",
    sandbox: "https://sandbox-api.getsafepay.com",
  },
};

// POST /api/admin/payment-gateways/test-connection
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json();
    const { gateway } = body; // "paypro" or "safepay"

    if (!gateway || !["paypro", "safepay"].includes(gateway)) {
      return NextResponse.json({ error: "Invalid gateway. Must be 'paypro' or 'safepay'" }, { status: 400 });
    }

    // ── Load Gateway Config ──
    const settingKey = `gateway_${gateway}_config`;
    const setting = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: settingKey } })
    }, 2, 500);

    if (!setting) {
      return NextResponse.json({ error: `${gateway} gateway is not configured` }, { status: 404 });
    }

    let config: any;
    try { config = JSON.parse(setting.value); } catch {
      return NextResponse.json({ error: "Gateway configuration is corrupt" }, { status: 500 });
    }

    if (!config.apiKey) {
      return NextResponse.json({ error: "API key is missing" }, { status: 400 });
    }

    // ── Test Connection ──
    const env = config.environment || "sandbox";
    const baseUrl = GATEWAY_BASES[gateway]?.[env] || GATEWAY_BASES[gateway]?.sandbox;

    try {
      // PayPro: POST health check or GET health
      // Safepay: GET health endpoint
      const testUrl = gateway === "paypro"
        ? `${baseUrl}/api/v2/health`
        : `${baseUrl}/api/v1/health`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok || response.status === 200) {
        logger.info(`[Gateway Test] ${gateway} connection successful`, { environment: env });
        return NextResponse.json({
          success: true,
          gateway,
          environment: env,
          message: `${gateway === "paypro" ? "PayPro" : "Safepay"} connection successful!`,
          status: "connected",
        });
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.warn(`[Gateway Test] ${gateway} returned ${response.status}`, { errorText });
        return NextResponse.json({
          success: false,
          gateway,
          environment: env,
          message: `${gateway === "paypro" ? "PayPro" : "Safepay"} returned status ${response.status}. Check your API key.`,
          status: "failed",
          httpStatus: response.status,
        });
      }
    } catch (fetchError: unknown) {
      const isAbort = fetchError instanceof Error && fetchError.name === "AbortError";
      const msg = isAbort
        ? "Connection timed out (10s)"
        : `Could not reach ${gateway === "paypro" ? "PayPro" : "Safepay"} servers. Check network.`;

      logger.error(`[Gateway Test] ${gateway} connection failed`, { error: fetchError instanceof Error ? fetchError.message : String(fetchError) });
      return NextResponse.json({
        success: false,
        gateway,
        environment: env,
        message: msg,
        status: "failed",
      });
    }
  } catch (error: unknown) {
    logger.error("[Gateway Test] Error", error);
    return NextResponse.json({ error: "Test connection failed" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "owner"], requireOrg: false }), { maxRequests: 5, windowSeconds: 60 });
