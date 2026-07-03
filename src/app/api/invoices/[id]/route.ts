import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry } from "@/lib/db";
import { generateInvoicePDF, generateCustomInvoicePDF } from "@/lib/pdf-generator";
import { withAuth, RouteContext, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { safeDate } from "@/lib/utils-extended";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/invoices/[id] - Get single invoice data or PDF
export const GET = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Invoices] GET request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const format = req.nextUrl.searchParams.get("format"); // "pdf" or null for JSON

    if (!id) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    let invoice;
    try {
      invoice = await withRetry(async () => {
        return db.invoice.findUnique({ where: { id } });
      }, 2, 500);
    } catch (dbErr: unknown) {
      logger.error("[Invoice GET] DB error:", dbErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Security: platform admins can view ANY invoice; regular users only their own org
    if (!isPlatformRole(authCtx.role) && invoice.organizationId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Phase 2: PDF download lock — non-admin users can only download when status is approved/paid
    if (format === "pdf" && !isPlatformRole(authCtx.role)) {
      if (!["approved", "paid"].includes(invoice.status)) {
        return NextResponse.json({
          error: `Invoice PDF is locked. Current status: ${invoice.status}. PDF unlocks after admin verifies payment.`,
          status: invoice.status,
        }, { status: 403 });
      }
    }

    // If format=pdf, return PDF buffer
    if (format === "pdf") {
      let platformSettings: any = null;
      try {
        platformSettings = await withRetry(async () => {
          return db.platformSettings.findFirst();
        }, 2, 500);
      } catch (psErr: unknown) {
        logger.warn("[Invoice GET] platformSettings fetch failed, using defaults");
      }

      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber || "N/A",
        status: invoice.status || "pending",
        planName: invoice.planName || "Unknown",
        amount: Number(invoice.amount) || 0,
        billingCycle: invoice.billingCycle || "monthly",
        currencySymbol: invoice.currencySymbol || "Rs.",
        currencyCode: invoice.currencyCode || "PKR",
        issuedAt: safeDate(invoice.issuedAt) || new Date(),
        dueDate: safeDate(invoice.dueDate),
        paidAt: safeDate(invoice.paidAt),
        periodStart: safeDate(invoice.periodStart),
        periodEnd: safeDate(invoice.periodEnd),
        notes: invoice.notes || null,
        orgName: invoice.orgName || "Unknown",
        orgEmail: invoice.orgEmail || undefined,
        orgPhone: invoice.orgPhone || undefined,
        orgAddress: invoice.orgAddress || undefined,
        platformName: platformSettings?.companyName || "Valtriox",
        platformEmail: platformSettings?.companyEmail || undefined,
        platformPhone: platformSettings?.companyPhone || undefined,
        platformAddress: platformSettings?.companyAddress || undefined,
        platformWebsite: platformSettings?.companyWebsite || undefined,
        platformWhatsapp: platformSettings?.whatsappNumber || undefined,
        platformInstagram: platformSettings?.instagramUrl || undefined,
        platformFacebook: platformSettings?.facebookUrl || undefined,
        platformTwitter: platformSettings?.twitterUrl || undefined,
        platformSupportHours: platformSettings?.supportHours || undefined,
        platformInvoiceHeaderText: platformSettings?.invoiceHeaderText || undefined,
        platformPaymentMethods: (() => { try { const p = platformSettings?.paymentMethods; return p ? JSON.parse(p) : undefined; } catch { return undefined; } })(),
        platformLogo: platformSettings?.logoUrl || undefined,
        platformTagline: platformSettings?.tagline || "COMMAND YOUR BRAND UNIVERSE",
        // Phase 2 fields
        invoiceType: invoice.type,
        invoiceTitle: invoice.invoiceTitle || undefined,
        lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems : undefined,
        subtotal: invoice.subtotal ? Number(invoice.subtotal) : undefined,
        taxRate: invoice.taxRate ? Number(invoice.taxRate) : undefined,
        taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : undefined,
        discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : undefined,
        clientName: invoice.clientName || undefined,
        clientEmail: invoice.clientEmail || undefined,
        clientAddress: invoice.clientAddress || undefined,
        approvedAt: invoice.approvedAt,
        sentAt: invoice.sentAt,
        paymentStatus: invoice.paymentStatus || undefined,
      };

      let pdfBuffer: Buffer;
      try {
        // Use new premium generator for custom invoices
        const generator = invoice.type === "custom" ? generateCustomInvoicePDF : generateInvoicePDF;
        pdfBuffer = await generator(invoiceData);
      } catch (pdfErr: unknown) {
        logger.error("[Invoice GET] PDF generation error:", pdfErr);
        return NextResponse.json(
          { error: "PDF generation failed", details: pdfErr instanceof Error ? pdfErr.message : undefined },
          { status: 500 }
        );
      }

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${invoice.invoiceNumber || "invoice"}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
          "Cache-Control": "no-cache",
        },
      });
    }

    // Otherwise return JSON
    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    logger.error("[Invoice GET] Unhandled error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch invoice", details: undefined }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });
