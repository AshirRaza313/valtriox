import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
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

// ── Ensure the push_subscriptions table exists ──

// Phase 6: Only create push table ONCE per warm instance, not on every request
const globalForPush = globalThis as unknown as { __valtrioxPushTableEnsured?: boolean };

async function ensurePushTable() {
  if (globalForPush.__valtrioxPushTableEnsured) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId"      TEXT NOT NULL,
      "orgId"       TEXT,
      endpoint      TEXT NOT NULL,
      "keysAuth"    TEXT NOT NULL,
      "keysP256dh"  TEXT NOT NULL,
      "userAgent"   TEXT,
      "createdAt"   TIMESTAMPTZ DEFAULT now()
    );
  `);
  globalForPush.__valtrioxPushTableEnsured = true;
}

// ── POST /api/push/send - Send a push notification ──

export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Push Send] POST request", { userId: authCtx.userId });
    await ensurePushTable();
    const vapidOk = configureVapid();
    if (!vapidOk) {
      return NextResponse.json({ error: "Push notifications not configured. Set VAPID keys in environment variables." }, { status: 503 });
    }

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    // Phase 6: Zod validation
    const parseResult = pushSendSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const {
      userId,       // Send to a specific user
      orgId,        // Or send to all users in an org
      title = "Valtriox",
      message = "You have a new notification",
      url = "/",
      icon = "/valtriox-icon-32.png",
    } = body;

    if (!userId && !orgId) {
      return NextResponse.json(
        { error: "userId or orgId is required" },
        { status: 400 }
      );
    }

    // Security: verify orgId matches auth context
    if (orgId && orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch subscriptions
    let subscriptions: any[];

    if (userId) {
      const result = await db.$queryRawUnsafe(
        `SELECT endpoint, "keysAuth", "keysP256dh" FROM push_subscriptions WHERE "userId" = $1`,
        userId
      );
      subscriptions = result as any[];
    } else {
      const result = await db.$queryRawUnsafe(
        `SELECT endpoint, "keysAuth", "keysP256dh" FROM push_subscriptions WHERE "orgId" = $1`,
        orgId
      );
      subscriptions = result as any[];
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
    const payload = JSON.stringify({ title, body: message, icon, url });
    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
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

    // Clean up failed subscriptions (likely expired/invalid)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        failed++;
        const err = results[i].reason as any;
        // Clean up expired subscriptions (410 or 404)
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          try {
            await db.$executeRawUnsafe(
              `DELETE FROM push_subscriptions WHERE endpoint = $1`,
              subscriptions[i].endpoint
            );
          } catch {
            // Ignore cleanup errors
          }
        }
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
