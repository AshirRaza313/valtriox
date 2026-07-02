import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { pushSubscribeSchema } from "@/lib/validations/schemas";

// ── POST /api/push/subscribe - Save a push subscription ──

export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Subscribe] POST request", { userId: authCtx.userId });

    const rawBody = await req.json();
    const body = sanitizeObject(rawBody);
    // Phase 7: Zod validation — use parseResult.data, NOT raw body
    const parseResult = pushSubscribeSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const validated = parseResult.data;
    const { endpoint, keys } = validated;

    // Phase 7: CRITICAL FIX — Use authCtx.userId instead of body.userId
    // Previously, body.userId was used directly in SQL, allowing any user to
    // subscribe push notifications as another user (IDOR vulnerability).
    const userId = authCtx.userId;
    const orgId = authCtx.organizationId || null;

    // Upsert: delete any existing subscription for the same endpoint, then insert
    await db.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE endpoint = $1`,
      endpoint
    );

    await db.$executeRawUnsafe(
      `INSERT INTO push_subscriptions ("userId", "orgId", endpoint, "keysAuth", "keysP256dh", "userAgent")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      userId,
      orgId,
      endpoint,
      keys.auth,
      keys.p256dh,
      (rawBody as Record<string, unknown>)?.userAgent ? String((rawBody as Record<string, unknown>).userAgent) : null
    );

    return NextResponse.json({ success: true, message: "Push subscription saved" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Push/Subscribe] Error:", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}), { maxRequests: 20, windowSeconds: 60 });

// ── DELETE /api/push/subscribe - Remove a push subscription ──

export const DELETE = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Subscribe] DELETE request", { userId: authCtx.userId });

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE endpoint = $1 AND "userId" = $2`,
      endpoint,
      authCtx.userId
    );

    return NextResponse.json({ success: true, message: "Push subscription removed" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Push/Subscribe] Delete error:", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to remove push subscription" }, { status: 500 });
  }
}), { maxRequests: 20, windowSeconds: 60 });
