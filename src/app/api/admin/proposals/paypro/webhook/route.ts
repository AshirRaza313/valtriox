import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, dbErrorResponse, isDbUnavailable, withRetry } from "@/lib/db";
import logger from "@/lib/logger";

// ============================================================================
// PayPro Webhook Handler
// ============================================================================
// FIX 1.4: Webhook signature is now MANDATORY.
// If PAYPRO_WEBHOOK_SECRET is not set, the endpoint returns 500.
// Uses crypto.timingSafeEqual to prevent timing attacks.
// ============================================================================

const VALID_PAYMENT_STATUSES = ["paid", "failed", "refunded", "pending"];

export async function POST(req: NextRequest) {
  try {
    logger.info("[PayPro Webhook] Received webhook callback");

    // FIX 1.4: Enforce webhook secret — fail hard if not configured
    const webhookSecret = process.env.PAYPRO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("[PayPro Webhook] PAYPRO_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook endpoint not properly configured" },
        { status: 500 }
      );
    }

    // Read raw body for signature verification BEFORE parsing JSON
    const rawBody = await req.text();

    // FIX 1.4: Verify signature using timingSafeEqual (prevents timing attacks)
    const signature =
      req.headers.get("x-paypro-signature") || req.headers.get("x-signature");
    if (!signature) {
      logger.warn("[PayPro Webhook] Missing signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // timingSafeEqual requires equal-length buffers
    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      logger.warn("[PayPro Webhook] Signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse JSON after signature is verified
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    logger.info("[PayPro Webhook] Payload verified", {
      orderId: payload.order_id,
      transactionId: payload.transaction_id,
      status: payload.status,
    });

    const payproOrderId =
      (payload.order_id as string) ||
      (payload.paypro_order_id as string) ||
      (payload.id as string);

    const transactionStatus =
      (payload.status as string) ||
      (payload.payment_status as string) ||
      (payload.event as string);

    const transactionAmount =
      payload.amount || payload.paid_amount || payload.payment_amount;

    const transactionId =
      (payload.transaction_id as string) ||
      (payload.txn_id as string) ||
      (payload.payment_id as string);

    if (!payproOrderId) {
      logger.warn("[PayPro Webhook] No order_id in payload");
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const proposal = await withRetry(async () => {
      return await db.proposal.findFirst({ where: { payproOrderId } });
    }, 2, 500);

    if (!proposal) {
      logger.warn("[PayPro Webhook] No proposal found for order_id", { payproOrderId });
      return NextResponse.json(
        { error: "Proposal not found for this order" },
        { status: 404 }
      );
    }

    // FIX 2.3: Idempotency — skip if status already set to same value
    let mappedStatus: string | null = null;
    const statusLower = String(transactionStatus).toLowerCase();

    if (["paid", "completed", "success", "confirmed"].includes(statusLower)) {
      mappedStatus = "paid";
    } else if (["failed", "declined", "rejected", "error"].includes(statusLower)) {
      mappedStatus = "failed";
    } else if (statusLower === "refunded") {
      mappedStatus = "refunded";
    } else if (["pending", "processing", "initiated"].includes(statusLower)) {
      mappedStatus = "pending";
    }

    if (!mappedStatus || !VALID_PAYMENT_STATUSES.includes(mappedStatus)) {
      logger.warn("[PayPro Webhook] Unrecognized status", { transactionStatus });
      return NextResponse.json(
        { error: `Unrecognized payment status: ${transactionStatus}` },
        { status: 400 }
      );
    }

    // FIX 2.3: Skip duplicate processing if already at target status
    if (proposal.paymentStatus === mappedStatus) {
      logger.info("[PayPro Webhook] Idempotent skip — status already set", {
        proposalId: proposal.id,
        status: mappedStatus,
      });
      return NextResponse.json({
        success: true,
        message: `Payment status already ${mappedStatus}`,
        proposalId: proposal.id,
      });
    }

    const updateData: Record<string, unknown> = { paymentStatus: mappedStatus };

    if (mappedStatus === "paid") {
      updateData.paidAt = new Date();
      if (transactionAmount) {
        updateData.paymentAmount = parseFloat(String(transactionAmount));
      } else if (proposal.totalCost) {
        updateData.paymentAmount = proposal.totalCost;
      }
    }

    // FIX 2.3: Wrap in transaction
    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: updateData,
      });
    });

    logger.info("[PayPro Webhook] Proposal updated successfully", {
      proposalId: proposal.id,
      payproOrderId,
      newStatus: mappedStatus,
      transactionId,
    });

    return NextResponse.json({
      success: true,
      message: `Payment status updated to ${mappedStatus}`,
      proposalId: proposal.id,
      payproOrderId,
      status: mappedStatus,
    });
  } catch (error: unknown) {
    logger.error("[PayPro Webhook] Error processing webhook", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "PayPro webhook endpoint is active",
  });
}
