import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import logger from "@/lib/logger";

// ============================================================================
// PayPro Webhook Handler
// ============================================================================
// Receives POST requests from PayPro when a payment status changes.
// Updates the proposal's paymentStatus accordingly.
//
// Environment Variables:
//   PAYPRO_WEBHOOK_SECRET - (Optional) Secret key to verify webhook signatures
// ============================================================================

// PayPro expected webhook event types
const VALID_PAYMENT_STATUSES = ["paid", "failed", "refunded", "pending"];

// POST /api/admin/proposals/paypro/webhook - Handle PayPro webhook callbacks
export async function POST(req: NextRequest) {
  try {
    logger.info("[PayPro Webhook] Received webhook callback");

    // ── Parse request body ──
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    logger.info("[PayPro Webhook] Payload received", {
      orderId: payload.order_id,
      transactionId: payload.transaction_id,
      status: payload.status,
    });

    // ── Verify webhook signature (if secret is configured) ──
    const webhookSecret = process.env.PAYPRO_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("x-paypro-signature") || req.headers.get("x-signature");
      if (!signature) {
        logger.warn("[PayPro Webhook] Missing signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      // PayPro signature verification:
      // Compare the received signature with a HMAC of the payload using the secret
      // This is a basic verification - adjust based on PayPro's actual signing method
      const crypto = await import("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn("[PayPro Webhook] Signature verification failed", {
          received: signature,
          expected: expectedSignature,
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // ── Extract fields from payload ──
    // PayPro sends various field names - handle multiple possibilities
    const payproOrderId =
      payload.order_id ||
      payload.paypro_order_id ||
      payload.id;

    const transactionStatus =
      payload.status ||
      payload.payment_status ||
      payload.event;

    const transactionAmount =
      payload.amount ||
      payload.paid_amount ||
      payload.payment_amount;

    const transactionId =
      payload.transaction_id ||
      payload.txn_id ||
      payload.payment_id;

    if (!payproOrderId) {
      logger.warn("[PayPro Webhook] No order_id in payload");
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // ── Find proposal by payproOrderId ──
    await ensureDb();
    const proposal = await withRetry(async () => {
      return await db.proposal.findFirst({
      where: { payproOrderId },
    })
    }, 2, 500);

    if (!proposal) {
      logger.warn("[PayPro Webhook] No proposal found for order_id", { payproOrderId });
      return NextResponse.json({ error: "Proposal not found for this order" }, { status: 404 });
    }

    // ── Map PayPro status to our payment status ──
    let mappedStatus: string | null = null;
    const statusLower = String(transactionStatus).toLowerCase();

    if (statusLower === "paid" || statusLower === "completed" || statusLower === "success" || statusLower === "confirmed") {
      mappedStatus = "paid";
    } else if (statusLower === "failed" || statusLower === "declined" || statusLower === "rejected" || statusLower === "error") {
      mappedStatus = "failed";
    } else if (statusLower === "refunded") {
      mappedStatus = "refunded";
    } else if (statusLower === "pending" || statusLower === "processing" || statusLower === "initiated") {
      mappedStatus = "pending";
    }

    if (!mappedStatus || !VALID_PAYMENT_STATUSES.includes(mappedStatus)) {
      logger.warn("[PayPro Webhook] Unrecognized or invalid status", {
        transactionStatus,
        mappedStatus,
      });
      return NextResponse.json({ error: `Unrecognized payment status: ${transactionStatus}` }, { status: 400 });
    }

    // ── Update proposal ──
    const updateData: any = {
      paymentStatus: mappedStatus,
    };

    if (mappedStatus === "paid") {
      updateData.paidAt = new Date();
      if (transactionAmount) {
        updateData.paymentAmount = parseFloat(transactionAmount);
      } else if (proposal.totalCost) {
        updateData.paymentAmount = proposal.totalCost;
      }
    }

    await withRetry(async () => {
      return await db.proposal.update({
      where: { id: proposal.id },
      data: updateData,
    })
    }, 2, 500);

    logger.info("[PayPro Webhook] Proposal updated successfully", {
      proposalId: proposal.id,
      payproOrderId,
      newStatus: mappedStatus,
      amount: updateData.paymentAmount,
    });

    return NextResponse.json({
      success: true,
      message: `Payment status updated to ${mappedStatus}`,
      proposalId: proposal.id,
      payproOrderId,
      status: mappedStatus,
    });
  } catch (error: any) {
    logger.error("[PayPro Webhook] Error processing webhook", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

// GET /api/admin/proposals/paypro/webhook - Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "PayPro webhook endpoint is active",
  });
}
