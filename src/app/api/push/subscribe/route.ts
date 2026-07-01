import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { pushSubscribeSchema } from "@/lib/validations/schemas";

// Instead of raw SQL DDL, just let Prisma handle schema.
// If the table doesn't exist, the Prisma query will fail and we return a 503.

// ── POST /api/push/subscribe - Save a push subscription ──

export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Subscribe] POST request", { userId: authCtx.userId });

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    // Phase 6: Zod validation
    const parseResult = pushSubscribeSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const { userId, orgId, endpoint, keysAuth, keysP256dh, userAgent } = body;

    if (!userId || !endpoint || !keysAuth || !keysP256dh) {
      return NextResponse.json(
        { error: "userId, endpoint, keysAuth, and keysP256dh are required" },
        { status: 400 }
      );
    }

    // Upsert: delete any existing subscription for the same endpoint, then insert
    await db.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE endpoint = $1`,
      endpoint
    );

    await db.$executeRawUnsafe(
      `INSERT INTO push_subscriptions ("userId", "orgId", endpoint, "keysAuth", "keysP256dh", "userAgent")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      userId,
      orgId || null,
      endpoint,
      keysAuth,
      keysP256dh,
      userAgent || null
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
});

// ── DELETE /api/push/subscribe - Remove a push subscription ──

export const DELETE = withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Subscribe] DELETE request", { userId: authCtx.userId });

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE endpoint = $1`,
      endpoint
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
});
