import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// ============================================================================
// PayPro Payment Gateway Integration
// ============================================================================
// Environment Variables Required:
//   PAYPRO_API_KEY      - Your PayPro merchant API key
//   PAYPRO_MERCHANT_ID  - (Optional) PayPro merchant ID for reference
//   NEXT_PUBLIC_APP_URL - Your app's public URL for redirect/webhook callbacks
// ============================================================================

// PayPro API base URLs
const PAYPRO_BASE = process.env.NODE_ENV === "production"
  ? "https://paypro.com.pk"
  : "https://sandbox.paypro.com.pk";

// POST /api/admin/proposals/paypro - Create a PayPro order for a proposal
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[PayPro] POST request - creating payment order", { userId: authCtx.userId });
    const body = await req.json();
    const { proposalId, returnUrl } = body;

    // ── Input Validation ──
    if (!proposalId) {
      return NextResponse.json(
        { error: "proposalId is required" },
        { status: 400 }
      );
    }

    // ── Fetch Proposal ──
    const proposal = await withRetry(async () => {
      return await db.proposal.findUnique({
      where: { id: proposalId },
    })
    }, 2, 500);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // ── Validate Proposal ──
    if (!proposal.totalCost || Number(proposal.totalCost) <= 0) {
      return NextResponse.json(
        { error: "Proposal must have a total cost greater than 0 to generate a payment link" },
        { status: 400 }
      );
    }

    if (proposal.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This proposal has already been paid" },
        { status: 400 }
      );
    }

    // ── Check for PAYPRO_API_KEY ──
    const apiKey = process.env.PAYPRO_API_KEY;
    if (!apiKey) {
      logger.error("[PayPro] PAYPRO_API_KEY is not configured");
      return NextResponse.json(
        { error: "Payment gateway is not configured. Please set PAYPRO_API_KEY environment variable." },
        { status: 500 }
      );
    }

    // ── Generate Order ID ──
    const orderId = `VTX-${proposal.id.slice(-8).toUpperCase()}`;

    // ── Build Callback URLs ──
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUrl = returnUrl || `${appUrl}/proposals`;
    const webhookUrl = `${appUrl}/api/admin/proposals/paypro/webhook`;

    // ── Call PayPro API ──
    try {
      const payproResponse = await fetch(`${PAYPRO_BASE}/api/v2/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          amount: proposal.totalCost,
          currency: proposal.currency || "PKR",
          customer_name: proposal.clientName,
          customer_email: proposal.clientEmail,
          customer_phone: proposal.clientPhone || "",
          order_id: orderId,
          redirect_url: redirectUrl,
          webhook_url: webhookUrl,
          description: `Proposal: ${proposal.title}`,
        }),
      });

      const payproData = await payproResponse.json();

      if (!payproResponse.ok) {
        logger.error("[PayPro] API error", {
          status: payproResponse.status,
          data: payproData,
        });
        return NextResponse.json(
          {
            error: payproData?.message || payproData?.error || `PayPro API returned status ${payproResponse.status}`,
          },
          { status: 502 }
        );
      }

      // ── Extract payment URL ──
      const paymentUrl = payproData?.payment_url || payproData?.data?.payment_url || payproData?.url;

      if (!paymentUrl) {
        logger.error("[PayPro] No payment URL in response", payproData);
        return NextResponse.json(
          { error: "PayPro did not return a payment URL. Please check your API configuration." },
          { status: 502 }
        );
      }

      // ── Extract PayPro order ID ──
      const payproOrderId = payproData?.order_id || payproData?.data?.order_id || payproData?.id;

      // ── Update Proposal Record ──
      await withRetry(async () => {
        return await db.proposal.update({
        where: { id: proposalId },
        data: {
          payproOrderId: payproOrderId || orderId,
          paymentStatus: "pending",
        },
      })
      }, 2, 500);

      logger.info("[PayPro] Payment order created successfully", {
        proposalId,
        payproOrderId: payproOrderId || orderId,
        amount: proposal.totalCost,
        currency: proposal.currency,
      });

      return NextResponse.json({
        success: true,
        paymentUrl,
        orderId: payproOrderId || orderId,
        amount: proposal.totalCost,
        currency: proposal.currency,
        message: "Payment order created. Redirect the client to the payment URL.",
      });
    } catch (fetchError: any) {
      logger.error("[PayPro] Network/API call failed", { error: fetchError?.message });
      return NextResponse.json(
        { error: "Failed to connect to PayPro payment gateway. Please try again later." },
        { status: 502 }
      );
    }
  } catch (error: any) {
    logger.error("[PayPro] POST error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
