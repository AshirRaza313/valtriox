import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// POST /api/invoices - Create a new invoice
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Invoices] POST request", { userId: authCtx.userId, orgId: authCtx.organizationId, role: authCtx.role });
    const body = await req.json();
    const {
      organizationId,
      subscriptionId,
      paymentProofId,
      planName,
      amount,
      billingCycle,
      status = "pending",
      currencyCode,
      currencySymbol,
      notes,
      periodStart,
      periodEnd,
    } = body;

    if (!organizationId || !planName || amount === undefined) {
      return NextResponse.json(
        { error: "organizationId, planName, and amount are required" },
        { status: 400 }
      );
    }

    // Security: platform admins can create invoices for ANY organization;
    // regular users can only create for their own.
    const isAdmin = isPlatformRole(authCtx.role);
    if (!isAdmin && organizationId !== authCtx.organizationId) {
      return NextResponse.json(
        { error: "Organization mismatch. You can only create invoices for your own organization." },
        { status: 403 }
      );
    }

    // Get organization info
    let organization;
    try {
      organization = await withRetry(async () => {
        return db.organization.findUnique({
        where: { id: organizationId },
      });
      }, 2, 500);
    } catch (dbErr: unknown) {
      const dbErrMsg = dbErr instanceof Error ? dbErr.message : "Unknown error";
      logger.error("[Invoice Create] DB findUnique error:", dbErrMsg);
      if (isDbUnavailable(dbErr)) {
        return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
      }
      // FIX: Never expose internal error details in production
      const detail = process.env.NODE_ENV === 'production' ? undefined : dbErrMsg;
      return NextResponse.json(
        { error: "Database error fetching organization", ...(detail ? { details: detail } : {}) },
        { status: 500 }
      );
    }

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get currency info
    const country = organization.country || "PK";
    const currency = getCurrencyForCountry(country);

    // Count existing invoices for sequential number
    let invoiceCount = 0;
    try {
      invoiceCount = await withRetry(async () => {
        return db.invoice.count({
          where: { organizationId },
        });
      }, 2, 500);
    } catch (countErr: unknown) {
      const countErrMsg = countErr instanceof Error ? countErr.message : "Unknown error";
      logger.warn("[Invoice Create] Invoice count failed, using 0:", { error: countErrMsg });
    }
    const invoiceNumber = generateInvoiceNumber(invoiceCount);

    // Calculate due date (7 days from now for pending)
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let invoice;
    try {
      invoice = await withRetry(async () => {
        return db.invoice.create({
        data: {
          invoiceNumber,
          organizationId,
          subscriptionId: subscriptionId || null,
          paymentProofId: paymentProofId || null,
          planName,
          amount: parseFloat(amount) || 0,
          billingCycle: billingCycle || "monthly",
          status,
          currencyCode: currencyCode || currency.code,
          currencySymbol: currencySymbol || currency.symbol,
          dueDate,
          periodStart: periodStart ? new Date(periodStart) : null,
          periodEnd: periodEnd ? new Date(periodEnd) : null,
          notes: notes || null,
          orgName: organization.name,
          orgEmail: organization.email || null,
          orgPhone: organization.phone || null,
          orgAddress: organization.address || null,
        },
      });
      }, 2, 500);
    } catch (createErr: unknown) {
      const createErrMsg = createErr instanceof Error ? createErr.message : "Unknown error";
      logger.error("[Invoice Create] DB create error:", createErrMsg);
      if ((createErr as any)?.code === "P2002") {
        return NextResponse.json({ error: "Invoice number conflict. Please retry." }, { status: 409 });
      }
      if (isDbUnavailable(createErr)) {
        return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
      }
      // FIX: Never expose internal error details in production
      const createDetail = process.env.NODE_ENV === 'production' ? undefined : createErrMsg;
      return NextResponse.json(
        { error: "Failed to create invoice in database", ...(createDetail ? { details: createDetail } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Invoice Create] Unhandled error:", message);
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    // FIX: Never expose internal error details in production
    const unhandledDetail = process.env.NODE_ENV === 'production' ? undefined : message;
    return NextResponse.json({ error: "Failed to create invoice", ...(unhandledDetail ? { details: unhandledDetail } : {}) }, { status: 500 });
  }
}), { maxRequests: 10, windowSeconds: 60 });
