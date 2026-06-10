import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import logger from "@/lib/logger";

// ============================================================================
// PayPro Subscription Billing - Webhook Handler
// ============================================================================
// Receives POST from PayPro when a subscription payment status changes.
// Finds the PaymentProof by transactionId and updates accordingly.
// When payment is "paid", the subscription is activated.
// ============================================================================

const VALID_STATUSES = ["paid", "failed", "refunded", "pending"];

// POST /api/subscriptions/paypro/webhook
export async function POST(req: NextRequest) {
  try {
    logger.info("[PayPro Sub Webhook] Received webhook");

    // Read raw body for signature verification
    const rawBody = await req.text();
    let payload: any;
    try { payload = JSON.parse(rawBody); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    logger.info("[PayPro Sub Webhook] Payload", {
      order_id: payload.order_id,
      status: payload.status,
      amount: payload.amount,
    });

    await ensureDb();

    // ── Verify HMAC-SHA256 signature (MANDATORY) ──
    const payproSetting = await withRetry(async () => {
      return await db.systemSetting.findUnique({ where: { key: "gateway_paypro_config" } })
    }, 2, 500);

    if (!payproSetting) {
      logger.error("[PayPro Sub Webhook] Gateway config not found in SystemSetting");
      return NextResponse.json({ error: "Gateway not configured" }, { status: 500 });
    }

    const gwConfig = JSON.parse(payproSetting.value);
    const webhookSecret = gwConfig.webhookSecret || process.env.PAYPRO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("[PayPro Sub Webhook] Webhook secret not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const signature = req.headers.get("x-paypro-signature") || req.headers.get("x-signature");
    if (!signature) {
      logger.warn("[PayPro Sub Webhook] Missing signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const crypto = await import("crypto");
    const expectedSig = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      logger.warn("[PayPro Sub Webhook] Signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Extract fields ──
    const payproOrderId = payload.order_id || payload.paypro_order_id || payload.id;
    const transactionStatus = payload.status || payload.payment_status || payload.event;
    const transactionAmount = payload.amount || payload.paid_amount || payload.payment_amount;
    const transactionId = payload.transaction_id || payload.txn_id || payload.payment_id;

    if (!payproOrderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // ── Find PaymentProof by transactionId (stored as payproOrderId) ──
    const paymentProof = await withRetry(async () => {
      return await db.paymentProof.findFirst({
      where: { transactionId: payproOrderId },
    })
    }, 2, 500);

    if (!paymentProof) {
      logger.warn("[PayPro Sub Webhook] No payment proof found for order", { payproOrderId });
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // ── Map status ──
    const statusLower = String(transactionStatus).toLowerCase();
    let mappedStatus: string | null = null;

    if (["paid", "completed", "success", "confirmed"].includes(statusLower)) mappedStatus = "approved";
    else if (["failed", "declined", "rejected", "error"].includes(statusLower)) mappedStatus = "rejected";
    else if (statusLower === "refunded") mappedStatus = "rejected";
    else if (["pending", "processing", "initiated"].includes(statusLower)) mappedStatus = "pending";

    if (!mappedStatus) {
      logger.warn("[PayPro Sub Webhook] Unrecognized status", { transactionStatus });
      return NextResponse.json({ error: `Unrecognized status: ${transactionStatus}` }, { status: 400 });
    }

    // ── Update PaymentProof ──
    const updateData: any = { status: mappedStatus, reviewedAt: new Date() };
    if (mappedStatus === "approved") {
      updateData.adminNote = `Auto-approved via PayPro webhook. TX: ${transactionId || payproOrderId}`;
    } else if (mappedStatus === "rejected") {
      updateData.adminNote = `Auto-rejected via PayPro. Status: ${transactionStatus}`;
    }

    await withRetry(async () => {
      return await db.paymentProof.update({ where: { id: paymentProof.id }, data: updateData })
    }, 2, 500);

    // ── If approved: Activate subscription ──
    if (mappedStatus === "approved") {
      const subscription = await withRetry(async () => {
        return await db.subscription.findUnique({
        where: { id: paymentProof.subscriptionId },
        include: { plan: true },
      })
      }, 2, 500);

      if (subscription) {
        // Fetch the target plan
        const targetPlan = await withRetry(async () => {
          return await db.subscriptionPlan.findUnique({ where: { id: paymentProof.planId } })
        }, 2, 500);
        if (targetPlan) {
          const periodEnd = new Date();
          if (paymentProof.billingCycle === "annually") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          await withRetry(async () => {
            return await db.subscription.update({
            where: { id: subscription.id },
            data: {
              status: "active",
              planId: targetPlan.id,
              currentPeriodEnd: periodEnd,
              billingCycle: paymentProof.billingCycle || "monthly",
            },
          })
          }, 2, 500);

          // Update organization plan
          await withRetry(async () => {
            return await db.organization.update({
            where: { id: paymentProof.organizationId },
            data: { plan: targetPlan.name },
          })
          }, 2, 500);

          // Create notification
          await withRetry(async () => {
            return await db.notification.create({
            data: {
              type: "payment_approved",
              title: "Payment Approved - Subscription Active!",
              message: `Your ${targetPlan.name} plan (${paymentProof.billingCycle}) has been activated via PayPro. Thank you!`,
              orgId: paymentProof.organizationId,
              actionUrl: "/subscriptions",
            },
          })
          }, 2, 500);

          // Auto-generate invoice
          try {
            const { generateInvoiceNumber } = await import("@/lib/pdf-generator");
            const { getCurrencyForCountry } = await import("@/lib/currency");
            const org = await withRetry(async () => {
              return await db.organization.findUnique({ where: { id: paymentProof.organizationId } })
            }, 2, 500);
            const country = org?.country || "PK";
            const currency = getCurrencyForCountry(country);
            const invoiceCount = await withRetry(async () => {
              return await db.invoice.count({ where: { organizationId: paymentProof.organizationId } })
            }, 2, 500);
            const invoiceNumber = generateInvoiceNumber(invoiceCount);

            await withRetry(async () => {
              return await db.invoice.create({
              data: {
                invoiceNumber,
                organizationId: paymentProof.organizationId,
                subscriptionId: subscription.id,
                paymentProofId: paymentProof.id,
                planName: targetPlan.name,
                amount: paymentProof.amount,
                billingCycle: paymentProof.billingCycle || "monthly",
                status: "paid",
                currencyCode: currency.code,
                currencySymbol: currency.symbol,
                dueDate: new Date(),
                orgName: org?.name || "",
                orgEmail: org?.email || null,
                orgPhone: org?.phone || null,
                orgAddress: org?.address || null,
                notes: "Auto-generated invoice. Paid via PayPro.",
              },
            })
            }, 2, 500);
          } catch (invoiceErr: any) {
            logger.warn("[PayPro Sub Webhook] Invoice generation failed", { error: invoiceErr?.message });
          }

          logger.info("[PayPro Sub Webhook] Subscription activated", {
            orgId: paymentProof.organizationId,
            plan: targetPlan.name,
            cycle: paymentProof.billingCycle,
          });
        }
      }
    } else if (mappedStatus === "rejected") {
      // Revert subscription status from pending_payment back to previous
      const subscription = await withRetry(async () => {
        return await db.subscription.findUnique({
        where: { id: paymentProof.subscriptionId },
      })
      }, 2, 500);
      if (subscription && subscription.status === "pending_payment") {
        // Check if trial was active when payment was submitted
        if (subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date()) {
          await withRetry(async () => {
            return await db.subscription.update({ where: { id: subscription.id }, data: { status: "trial" } })
          }, 2, 500);
        } else {
          await withRetry(async () => {
            return await db.subscription.update({ where: { id: subscription.id }, data: { status: "expired" } })
          }, 2, 500);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment ${mappedStatus}`,
      paymentProofId: paymentProof.id,
      status: mappedStatus,
    });
  } catch (error: any) {
    logger.error("[PayPro Sub Webhook] Error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// GET - Health check
export async function GET() {
  return NextResponse.json({ status: "ok", message: "PayPro subscription webhook is active" });
}
