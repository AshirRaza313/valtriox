import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// ============================================================================
// PayPro Subscription Billing - Create Payment Order
// ============================================================================
// Creates a PayPro payment order for SUBSCRIPTION billing.
// Reads gateway config from SystemSetting table (admin-configured).
// ============================================================================

const PAYPRO_BASES: Record<string, string> = {
  live: "https://paypro.com.pk",
  sandbox: "https://sandbox.paypro.com.pk",
};

// POST /api/subscriptions/paypro/create-order
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[PayPro SubBilling] POST request", { userId: authCtx.userId });
    await ensureDb();

    const body = await req.json();
    const { planId, billingCycle } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const cycle = billingCycle || "monthly";
    if (!["monthly", "quarterly", "annually"].includes(cycle)) {
      return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
    }

    const orgId = authCtx.organizationId;

    // ── Fetch Organization ──
    const organization = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id: orgId } })
    }, 2, 500);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    if (organization.isBanned) {
      return NextResponse.json({ error: "Organization is banned" }, { status: 403 });
    }

    // ── Fetch Plan ──
    const plan = await withRetry(async () => {
      return await db.subscriptionPlan.findUnique({ where: { id: planId } })
    }, 2, 500);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found or inactive" }, { status: 400 });
    }

    // ── Check Existing Subscription ──
    const existingSub = await withRetry(async () => {
      return await db.subscription.findUnique({ where: { organizationId: orgId } })
    }, 2, 500);
    if (existingSub?.status === "active" && existingSub.planId === planId) {
      return NextResponse.json({ error: "You are already on this plan" }, { status: 400 });
    }
    if (existingSub?.status === "pending_payment") {
      return NextResponse.json({ error: "A payment is already under review" }, { status: 400 });
    }

    // Check duplicate pending payment for this plan
    if (existingSub) {
      const existingPending = await withRetry(async () => {
        return await db.paymentProof.findFirst({
        where: { subscriptionId: existingSub.id, planName: plan.name, status: "pending" },
      })
      }, 2, 500);
      if (existingPending) {
        return NextResponse.json({ error: "You already have a pending payment for this plan" }, { status: 400 });
      }
    }

    // ── Load PayPro Gateway Config ──
    const payproSetting = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: "gateway_paypro_config" } })
    }, 2, 500);
    if (!payproSetting) {
      return NextResponse.json({ error: "PayPro gateway is not configured" }, { status: 503 });
    }

    let gatewayConfig: any;
    try { gatewayConfig = JSON.parse(payproSetting.value); } catch {
      return NextResponse.json({ error: "PayPro configuration is corrupt" }, { status: 500 });
    }

    if (!gatewayConfig.enabled || !gatewayConfig.apiKey) {
      return NextResponse.json({ error: "PayPro gateway is not enabled" }, { status: 503 });
    }

    // ── Calculate Amount ──
    const amount = cycle === "annually" && plan.annualPrice > 0 ? plan.annualPrice : cycle === "quarterly" && plan.quarterlyPrice > 0 ? plan.quarterlyPrice : plan.price;
    if (amount <= 0) {
      return NextResponse.json({ error: "Plan has no price configured" }, { status: 400 });
    }

    // ── Generate Order ID ──
    const orderId = `VTX-SUB-${orgId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // ── Build Callback URLs ──
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://valtriox.vercel.app";
    const redirectUrl = `${appUrl}/subscriptions?payment=pending`;
    const webhookUrl = `${appUrl}/api/subscriptions/paypro/webhook`;

    // ── Call PayPro API ──
    const baseUrl = PAYPRO_BASES[gatewayConfig.environment] || PAYPRO_BASES.sandbox;

    try {
      const payproResponse = await fetch(`${baseUrl}/api/v2/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayConfig.apiKey}`,
        },
        body: JSON.stringify({
          amount,
          currency: "PKR",
          customer_name: organization.name,
          customer_email: organization.email || "",
          customer_phone: organization.phone || "",
          order_id: orderId,
          redirect_url: redirectUrl,
          webhook_url: webhookUrl,
          description: `Valtriox ${plan.name} Plan - ${cycle} billing`,
        }),
      });

      const payproData = await payproResponse.json();

      if (!payproResponse.ok) {
        logger.error("[PayPro SubBilling] API error", { status: payproResponse.status, data: payproData });
        return NextResponse.json(
          { error: payproData?.message || payproData?.error || `PayPro API error: ${payproResponse.status}` },
          { status: 502 }
        );
      }

      const paymentUrl = payproData?.payment_url || payproData?.data?.payment_url || payproData?.url;
      if (!paymentUrl) {
        logger.error("[PayPro SubBilling] No payment URL in response", payproData);
        return NextResponse.json({ error: "PayPro did not return a payment URL" }, { status: 502 });
      }

      const payproOrderId = payproData?.order_id || payproData?.data?.order_id || payproData?.id || orderId;

      // ── Create/Update Subscription + PaymentProof ──
      let subscription = existingSub;
      if (!subscription) {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
        subscription = await db.subscription.create({
          data: {
            organizationId: orgId,
            planId: plan.id,
            status: "pending_payment",
            billingCycle: cycle,
            trialStartsAt: now,
            trialEndsAt: trialEnd,
          },
        });
      } else {
        await withRetry(async () => {
          return await db.subscription.update({ where: { id: subscription.id }, data: { status: "pending_payment" } })
        }, 2, 500);
      }

      await withRetry(async () => {
        return await db.paymentProof.create({
        data: {
          subscriptionId: subscription.id,
          organizationId: orgId,
          planId: plan.id,
          planName: plan.name,
          amount,
          billingCycle: cycle,
          transactionId: payproOrderId,
          paymentMethod: "paypro",
          screenshotUrl: null,
        },
      })
      }, 2, 500);

      logger.info("[PayPro SubBilling] Order created", { orgId, payproOrderId, amount, plan: plan.name });

      return NextResponse.json({
        success: true,
        paymentUrl,
        orderId: payproOrderId,
        amount,
        currency: "PKR",
        planName: plan.name,
        billingCycle: cycle,
        message: "Redirecting to PayPro...",
      });
    } catch (fetchError: any) {
      logger.error("[PayPro SubBilling] Network error", { error: fetchError?.message });
      return NextResponse.json({ error: "Failed to connect to PayPro" }, { status: 502 });
    }
  } catch (error: any) {
    logger.error("[PayPro SubBilling] Error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
});
