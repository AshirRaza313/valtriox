import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { pushSendSchema } from "@/lib/validations/schemas";

// ── Configure VAPID ──

function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@valtriox-portal.vercel.app";

  if (!publicKey || !privateKey) {
    logger.warn("[Push] VAPID keys not configured. Push notifications disabled.");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

// ── POST /api/push/send - Send a push notification ──

export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Send] POST request", { userId: authCtx.userId });
    const vapidOk = configureVapid();
    if (!vapidOk) {
      return NextResponse.json({ error: "Push notifications not configured. Set VAPID keys in environment variables." }, { status: 503 });
    }

    const rawBody = await req.json();
    const body = sanitizeObject(rawBody);
    // Phase 7: Use validated data from parseResult, not raw body
    const parseResult = pushSendSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const validated = parseResult.data;

    // Allow sending to own user or own org. Platform admins can send to any.
    const targetUserId = (body as Record<string, unknown>)?.userId as string | undefined;
    const targetOrgId = (body as Record<string, unknown>)?.orgId as string | undefined;
    const title = validated.title;
    const bodyText = validated.body;
    const url = validated.url || "/";
    const icon = validated.icon || "/valtriox-icon-32.png";

    if (!targetUserId && !targetOrgId) {
      return NextResponse.json(
        { error: "userId or orgId is required" },
        { status: 400 }
      );
    }

    // Phase 7: Security — verify orgId matches auth context (unless platform admin)
    if (targetOrgId && targetOrgId !== authCtx.organizationId && !isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Phase 7: Security — non-admin users can only send to themselves
    if (targetUserId && targetUserId !== authCtx.userId && !isPlatformRole(authCtx.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch subscriptions
    let subscriptions: { endpoint: string; keysP256dh: string; keysAuth: string }[];

    if (targetUserId) {
      const result = await db.$queryRawUnsafe(
        `SELECT endpoint, "keysAuth", "keysP256dh" FROM push_subscriptions WHERE "userId" = $1`,
        targetUserId
      );
      subscriptions = result as { endpoint: string; keysP256dh: string; keysAuth: string }[];
    } else {
      const result = await db.$queryRawUnsafe(
        `SELECT endpoint, "keysAuth", "keysP256dh" FROM push_subscriptions WHERE "orgId" = $1`,
        targetOrgId
      );
      subscriptions = result as { endpoint: string; keysP256dh: string; keysAuth: string }[];
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No push subscriptions found for the target",
        sent: 0,
        failed: 0,
      });
    }

    // Send push notifications to all matched subscriptions
    const payload = JSON.stringify({ title, body: bodyText, icon, url });
    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription: webpush.PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keysP256dh,
            auth: sub.keysAuth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      })
    );

    // Phase 7: Batch cleanup of expired subscriptions instead of one-by-one
    const failedEndpoints: string[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        failed++;
        const err = results[i].reason as { statusCode?: number } | undefined;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          failedEndpoints.push(subscriptions[i].endpoint);
        }
      }
    }

    if (failedEndpoints.length > 0) {
      try {
        // Batch delete all expired subscriptions
        const placeholders = failedEndpoints.map((_, i) => `$${i + 1}`).join(', ');
        await db.$executeRawUnsafe(
          `DELETE FROM push_subscriptions WHERE endpoint IN (${placeholders})`,
          ...failedEndpoints
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json({
      success: true,
      message: `Push notification processed`,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Push/Send] Error:", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to send push notification" }, { status: 500 });
  }
}), { maxRequests: 10, windowSeconds: 60 });
