import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { generateInvoiceNumber, generateInvoicePDF, type InvoiceData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// POST /api/admin/invoices/generate - Generate a branded PDF invoice from payment data
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Admin Invoice Generate] POST request", { userId: authCtx.userId });

    // Only platform roles can generate invoices
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json(
        { error: "Only platform administrators can generate invoices" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      organizationId,
      planName,
      amount,
      paymentMethod,
      transactionId,
      billingCycle = "monthly",
    } = body;

    // Validate required fields
    if (!organizationId || !planName || amount === undefined) {
      return NextResponse.json(
        { error: "organizationId, planName, and amount are required" },
        { status: 400 }
      );
    }

    // Get organization info
    const { data: organization, error: orgErr } = await safeDbQuery(() =>
      db.organization.findUnique({
        where: { id: organizationId },
      })
    );

    if (orgErr) {
      logger.error("[Invoice Generate] DB error fetching organization", { error: orgErr });
      return NextResponse.json(
        { error: "Database error fetching organization", details: orgErr?.substring(0, 200) },
        { status: 503 }
      );
    }

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get currency info
    const country = organization.country || "PK";
    const currency = getCurrencyForCountry(country);

    // Get platform settings for branding
    const { data: platformSettings } = await safeDbQuery(() =>
      db.platformSettings.findFirst()
    );

    // Count existing invoices for sequential number
    const { data: invoiceCount } = await safeDbQuery(() =>
      db.invoice.count({
        where: { organizationId },
      })
    );
    const invoiceNumber = generateInvoiceNumber(invoiceCount || 0);
    const issuedAt = new Date();
    const dueDate = new Date();

    // Save invoice record to database first
    const { data: invoice, error: createErr } = await safeDbQuery(() =>
      db.invoice.create({
        data: {
          invoiceNumber,
          organizationId,
          planName,
          amount: parseFloat(amount) || 0,
          billingCycle,
          status: "paid",
          type: "subscription",
          currencyCode: currency.code,
          currencySymbol: currency.symbol,
          issuedAt,
          dueDate,
          paidAt: issuedAt,
          orgName: organization.name,
          orgEmail: organization.email || null,
          orgPhone: organization.phone || null,
          orgAddress: organization.address || null,
        },
      })
    );

    if (createErr) {
      logger.error("[Invoice Generate] DB create error", { error: createErr });
      if (createErr?.includes('P2002') || createErr?.includes('Unique constraint')) {
        return NextResponse.json({ error: "Invoice number conflict. Please retry." }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to create invoice record", details: createErr?.substring(0, 200) },
        { status: 503 }
      );
    }

    // Build InvoiceData for PDF generator
    const invoiceData: InvoiceData = {
      invoiceNumber,
      status: "paid",
      planName,
      amount: parseFloat(amount) || 0,
      billingCycle,
      currencySymbol: currency.symbol,
      currencyCode: currency.code,
      issuedAt,
      dueDate,
      paidAt: issuedAt,
      paymentMethod: paymentMethod || "bank_transfer",
      transactionId: transactionId || "",
      orgName: organization.name,
      orgEmail: organization.email || undefined,
      orgPhone: organization.phone || undefined,
      orgAddress: organization.address || undefined,
      orgCountry: organization.country || undefined,
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
      platformTagline: platformSettings?.tagline || "COMMAND YOUR BRAND UNIVERSE",
    };

    // Try to parse payment methods from JSON string
    if (platformSettings?.paymentMethods) {
      try {
        const pms = typeof platformSettings.paymentMethods === "string"
          ? JSON.parse(platformSettings.paymentMethods)
          : platformSettings.paymentMethods;
        if (Array.isArray(pms)) {
          invoiceData.platformPaymentMethods = pms.map((pm: any) => pm.name || pm);
        }
      } catch {}
    }

    // Generate PDF
    try {
      const pdfBuffer = await generateInvoicePDF(invoiceData);

      // Return PDF as downloadable blob
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
        },
      });
    } catch (pdfErr: any) {
      logger.error("[Invoice Generate] PDF generation error", { error: pdfErr?.message });
      // PDF generation failed but invoice record was created
      // Return the invoice data so admin knows it was saved
      return NextResponse.json({
        invoice,
        warning: "Invoice record saved but PDF generation failed. You can download it from Invoice Management.",
        error: pdfErr?.message,
      }, { status: 201 });
    }
  } catch (error: any) {
    logger.error("[Invoice Generate] Unhandled error", { error: error?.message });
    return NextResponse.json({ error: "Failed to generate invoice", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "owner", "admin"], requireOrg: false });
