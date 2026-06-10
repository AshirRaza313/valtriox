// ============================================================================
// Admin Storage Settings API — Cloudinary Configuration
// ============================================================================
// Manages Cloudinary credentials via SystemSetting table.
// Key: "storage_cloudinary_config"
//
// GET  - Fetch current config (API keys masked)
// PUT  - Save/update config
// POST - Test connection with provided credentials
// DELETE - Disable Cloudinary (fall back to Supabase)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { isPlatformRole } from "@/lib/roles";
import { v2 as cloudinary } from "cloudinary";

const SETTING_KEY = "storage_cloudinary_config";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  enabled: boolean;
  folderPrefix: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Fetch current Cloudinary config (masked)
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withAuth(async (_req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await ensureDb();

    const setting = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    }, 2, 500);

    if (!setting) {
      // Check if env vars are set
      const envCloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      return NextResponse.json({
        available: !!envCloud,
        source: envCloud ? "env" : "none",
        cloudName: envCloud || "",
        apiKeyMasked: process.env.CLOUDINARY_API_KEY ? "••••••••" : "",
        apiSecretMasked: process.env.CLOUDINARY_API_SECRET ? "••••••••••••" : "",
        enabled: !!envCloud,
        folderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX || "org",
        message: envCloud ? "Using environment variables (set via Vercel/ hosting)" : "Cloudinary not configured. Add credentials below or set env vars.",
      });
    }

    const parsed = JSON.parse(setting.value) as CloudinaryConfig;
    const mask = (val: string) => val ? `${val.slice(0, 4)}${"•".repeat(Math.min(val.length - 4, 12))}` : "";
    const maskFull = (val: string) => val ? `${"•".repeat(Math.min(val.length, 16))}` : "";

    return NextResponse.json({
      available: parsed.enabled && !!parsed.cloudName,
      source: "database",
      cloudName: parsed.cloudName || "",
      apiKeyMasked: mask(parsed.apiKey),
      apiSecretMasked: maskFull(parsed.apiSecret),
      enabled: parsed.enabled,
      folderPrefix: parsed.folderPrefix || "org",
      message: parsed.enabled ? "Cloudinary active | client media storage configured" : "Cloudinary disabled | using Supabase fallback",
    });
  } catch (error: any) {
    logger.error("[StorageSettings] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch storage settings" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

// ═══════════════════════════════════════════════════════════════════════════
// PUT - Save/update Cloudinary config
// ═══════════════════════════════════════════════════════════════════════════

export const PUT = withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await ensureDb();
    const body = await req.json();

    const { cloudName, apiKey, apiSecret, enabled, folderPrefix } = body;

    if (!cloudName || typeof cloudName !== "string") {
      return NextResponse.json({ error: "Cloud Name is required" }, { status: 400 });
    }

    if (enabled && (!apiKey || !apiSecret)) {
      return NextResponse.json({ error: "API Key and API Secret are required when enabling Cloudinary" }, { status: 400 });
    }

    const config: CloudinaryConfig = {
      cloudName: String(cloudName).trim(),
      apiKey: String(apiKey || "").trim(),
      apiSecret: String(apiSecret || "").trim(),
      enabled: Boolean(enabled),
      folderPrefix: String(folderPrefix || "org").trim().replace(/[^a-zA-Z0-9_-]/g, ""),
    };

    // Upsert into SystemSetting
    const existing = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    }, 2, 500);

    if (existing) {
      await withRetry(async () => {
        return await db.systemSetting.update({
          where: { key: SETTING_KEY },
          data: { value: JSON.stringify(config), updatedAt: new Date() },
        });
      }, 2, 500);
    } else {
      await withRetry(async () => {
        return await db.systemSetting.create({
          data: {
            id: `storage-cld-${Date.now()}`,
            key: SETTING_KEY,
            value: JSON.stringify(config),
            category: "storage",
          },
        });
      }, 2, 500);
    }

    logger.info("[StorageSettings] Cloudinary config saved", { userId: authCtx.userId, cloudName: config.cloudName, enabled: config.enabled });

    return NextResponse.json({
      success: true,
      message: config.enabled ? "Cloudinary enabled successfully" : "Cloudinary disabled | files will use Supabase fallback",
      cloudName: config.cloudName,
    });
  } catch (error: any) {
    logger.error("[StorageSettings] PUT error:", error);
    return NextResponse.json({ error: "Failed to save storage settings" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

// ═══════════════════════════════════════════════════════════════════════════
// POST - Test Cloudinary connection with provided credentials
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { cloudName, apiKey, apiSecret } = body;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloud Name, API Key, and API Secret are required to test" }, { status: 400 });
    }

    // Configure and ping Cloudinary using the v2 SDK (no constructor needed)
    try {
      // Temporarily configure with provided credentials for testing
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });

      // Ping the API to verify credentials
      const pingResult = await new Promise<{ result: string }>((resolve, reject) => {
        cloudinary.api.ping((error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      if (pingResult?.result === "ok" || pingResult?.status === "ok") {
        logger.info("[StorageSettings] Connection test successful", { cloudName, userId: authCtx.userId });
        return NextResponse.json({
          success: true,
          message: "Connection successful! Cloudinary is reachable and credentials are valid.",
        });
      }

      return NextResponse.json({
        success: false,
        message: `Unexpected response: ${JSON.stringify(pingResult)}`,
      });
    } catch (testErr: any) {
      const msg = testErr?.message || String(testErr);
      logger.warn("[StorageSettings] Connection test failed:", msg);

      return NextResponse.json({
        success: false,
        message: `Connection failed: ${msg}`,
      });
    }
  } catch (error: any) {
    logger.error("[StorageSettings] POST error:", error);
    return NextResponse.json({ error: "Failed to test connection" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });
