import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(withAuth(async (_req: NextRequest, authCtx) => {
  logger.info("[Admin Feature Toggles] GET request", { userId: authCtx.userId });
  try {
    const settings = await withRetry(async () => {
      return await db.systemSetting.findFirst({
      where: { key: "feature_toggles" },
    })
    }, 2, 500);

    const toggles = settings?.value ? JSON.parse(settings.value as string) : {
      lockedGrowth: [],
      lockedEnterprise: [],
    };

    return NextResponse.json(toggles);
  } catch (error: unknown) {
    logger.error("Feature toggles GET error:", error);
    return NextResponse.json({ lockedGrowth: [], lockedEnterprise: [] });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });

export const PUT = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Feature Toggles] PUT request", { userId: authCtx.userId });
  try {
    const body = await req.json();
    const { lockedGrowth, lockedEnterprise } = body;

    const value = JSON.stringify({
      lockedGrowth: Array.isArray(lockedGrowth) ? lockedGrowth : [],
      lockedEnterprise: Array.isArray(lockedEnterprise) ? lockedEnterprise : [],
    });

    await withRetry(async () => {
      return await db.systemSetting.upsert({
      where: { key: "feature_toggles" },
      update: { value },
      create: { key: "feature_toggles", value, category: "system" },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, lockedGrowth, lockedEnterprise });
  } catch (error: unknown) {
    logger.error("Feature toggles PUT error:", error);
    return NextResponse.json({ error: "Failed to save feature toggles" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
