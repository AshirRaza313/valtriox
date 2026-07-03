// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { generateInvoicePDF, generateCustomInvoicePDF, type InvoiceData } from "@/lib/pdf-generator";
import { withAuth, RouteContext, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export const maxDuration = 60;

/**
 * Build a detailed error message from a safeDbQuery error.
 * Mirrors the format used by /custom route so the user can see
 * the actual Prisma/SQL error code and message.
 */
function describeDbError(error: unknown): string {
  if (!error) return "unknown error";
  const errObj = error as any;
  const prismaCode = errObj?.code || "N/A";
  const prismaMessage = errObj?.message
    ? String(errObj.message).substring(0, 200)
    : String(error).substring(0, 200);
  const prismaMeta = errObj?.meta ? JSON.stringify(errObj.meta).substring(0, 200) : "";
  return `Prisma[code=${prismaCode}]: ${prismaMessage}${prismaMeta ? ` | meta=${prismaMeta}` : ""}`;
}

// GET /api/admin/invoices/:id/pdf
// Returns the branded PDF. For custom invoices, uses generateCustomInvoicePDF.
// For subscription invoices, uses generateInvoicePDF.
// PDF download is ALWAYS allowed for platform admins.
// For org-scoped users, PDF only unlocks when status is "approved" or "paid".
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  const { id } = await ctx.params;

  // ── Attempt 1: findUnique with organization include ──
  // This is the preferred path — fetches invoice + org in one query.
  let invoice: any = null;
  let fetchErr: unknown = null;

  const r1 = await safeDbQuery(() =>
    db.invoice.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, email: true, phone: true, address: true, country: true, taxId: true } },
      },
    })
  );
  invoice = r1.data;
  fetchErr = r1.error;

  // ── Attempt 2: if include fails (likely Organization schema mismatch),
  //     retry WITHOUT the include. We'll fetch the org separately if needed. ──
  if (!invoice && fetchErr) {
    logger.warn("[Invoice PDF] findUnique with include failed, retrying without include", {
      invoiceId: id,
      error: describeDbError(fetchErr),
    });
    const r2 = await safeDbQuery(() =>
      db.invoice.findUnique({ where: { id } })
    );
    invoice = r2.data;
    if (!invoice && r2.error) {
      // Both paths failed — surface the detailed error
      const errInfo = describeDbError(r2.error);
      logger.error("[Invoice PDF] Both findUnique attempts failed", {
        invoiceId: id,
        attempt1Err: describeDbError(fetchErr),
        attempt2Err: errInfo,
      });
      return NextResponse.json({
        error: `Failed to fetch invoice. ${errInfo}`,
      }, { status: 503 });
    }
    // Attempt 2 succeeded — fetch the organization separately (best-effort, only basic columns)
    if (invoice?.organizationId) {
      const orgRes = await safeDbQuery(() =>
        db.organization.findUnique({
          where: { id: invoice.organizationId },
          select: { id: true, name: true, email: true, phone: true },
        })
      );
      if (orgRes.data) {
        invoice.organization = orgRes.data;
      } else {
        // Even the basic org fetch failed — proceed with whatever fields are on the invoice
        logger.warn("[Invoice PDF] Org fetch failed (continuing with invoice-only data)", {
          invoiceId: id,
          orgId: invoice.organizationId,
          error: orgRes.error ? describeDbError(orgRes.error) : "not found",
        });
      }
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const isAdmin = isPlatformRole(authCtx.role);
  if (!isAdmin && invoice.organizationId !== authCtx.organizationId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Org-scoped users: PDF only unlocks after approval/payment
  if (!isAdmin) {
    if (!["approved", "paid"].includes(invoice.status)) {
      return NextResponse.json({
        error: `Invoice PDF is locked. Current status: ${invoice.status}. PDF unlocks after admin verifies payment.`,
        status: invoice.status,
      }, { status: 403 });
    }
  }

  // ── Load platform settings (best-effort, won't block PDF generation) ──
  const { data: ps } = await safeDbQuery(() => db.platformSettings.findFirst());

  // ── Build InvoiceData ──
  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    planName: invoice.planName,
    amount: Number(invoice.amount),
    billingCycle: invoice.billingCycle,
    currencySymbol: invoice.currencySymbol,
    currencyCode: invoice.currencyCode,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    notes: invoice.notes,
    orgName: invoice.orgName || invoice.organization?.name || "",
    orgEmail: invoice.orgEmail || invoice.organization?.email || undefined,
    orgPhone: invoice.orgPhone || invoice.organization?.phone || undefined,
    orgAddress: invoice.orgAddress || invoice.organization?.address || undefined,
    orgCountry: invoice.organization?.country || undefined,
    orgTaxId: invoice.organization?.taxId || undefined,
    platformName: ps?.companyName || "Valtriox",
    platformEmail: ps?.companyEmail || undefined,
    platformPhone: ps?.companyPhone || undefined,
    platformAddress: ps?.companyAddress || undefined,
    platformWebsite: ps?.companyWebsite || undefined,
    platformWhatsapp: ps?.whatsappNumber || undefined,
    platformInstagram: ps?.instagramUrl || undefined,
    platformFacebook: ps?.facebookUrl || undefined,
    platformTwitter: ps?.twitterUrl || undefined,
    platformSupportHours: ps?.supportHours || undefined,
    platformInvoiceHeaderText: ps?.invoiceHeaderText || undefined,
    platformLogo: ps?.logoUrl || undefined,
    platformTagline: ps?.tagline || "COMMAND YOUR BRAND UNIVERSE",
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

  // Parse payment methods
  if (ps?.paymentMethods) {
    try {
      const pms = typeof ps.paymentMethods === "string" ? JSON.parse(ps.paymentMethods) : ps.paymentMethods;
      if (Array.isArray(pms)) invoiceData.platformPaymentMethods = pms.map((pm: any) => pm.name || pm);
    } catch {}
  }

  // Pick generator: custom invoices use the new premium generator
  const generator = invoice.type === "custom" ? generateCustomInvoicePDF : generateInvoicePDF;

  try {
    const pdfBuffer = await Promise.race([
      generator(invoiceData),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF generation timed out (30s)")), 30000)
      ),
    ]);

    if (!pdfBuffer || pdfBuffer.length < 100) {
      return NextResponse.json({ error: "Generated PDF is invalid" }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (pdfErr: unknown) {
    const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
    logger.error("[Invoice PDF] Generation failed", { error: msg, invoiceId: id });
    return NextResponse.json({
      error: `PDF generation failed: ${msg.substring(0, 200)}`,
    }, { status: 500 });
  }
}, { requireRole: [], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
