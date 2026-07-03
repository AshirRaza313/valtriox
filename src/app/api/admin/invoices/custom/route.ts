// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── POST /api/admin/invoices/custom ──
// Body shape:
// {
//   organizationId: string,          // optional — if client is a Valtriox org
//   clientName: string,              // free-text (required)
//   clientEmail?: string,
//   clientAddress?: string,
//   invoiceTitle?: string,
//   lineItems: [{ description, qty, rate, amount }],
//   taxRate?: number,                // percentage
//   discountAmount?: number,
//   notes?: string,
//   dueDate?: ISO string,
//   currencyCode?: string,
//   currencySymbol?: string,
//   sendImmediately?: boolean,       // if true, status=sent + sentAt=now
// }
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    if (!isPlatformRole(authCtx.role)) {
      return NextResponse.json(
        { error: "Only platform administrators can create custom invoices" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      organizationId,
      clientName,
      clientEmail,
      clientAddress,
      invoiceTitle,
      lineItems,
      taxRate,
      discountAmount,
      notes,
      dueDate,
      currencyCode,
      currencySymbol,
      sendImmediately,
    } = body;

    // ── Validation ──
    if (!clientName || typeof clientName !== "string" || clientName.trim().length < 2) {
      return NextResponse.json({ error: "clientName is required (min 2 chars)" }, { status: 400 });
    }
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }
    for (const li of lineItems) {
      if (!li.description || typeof li.description !== "string" || li.description.trim().length === 0) {
        return NextResponse.json({ error: "Each line item needs a description" }, { status: 400 });
      }
      const qty = Number(li.qty) || 1;
      const rate = Number(li.rate) || 0;
      li.qty = qty;
      li.rate = rate;
      li.amount = Number(li.amount) || (qty * rate);
    }

    // ── Resolve org (optional) ──
    let organization: any = null;
    let resolvedCurrencyCode = currencyCode || "PKR";
    let resolvedCurrencySymbol = currencySymbol || "Rs.";

    if (organizationId) {
      const { data: org, error } = await safeDbQuery(() =>
        db.organization.findUnique({ where: { id: organizationId } })
      );
      if (error) {
        return NextResponse.json({ error: "DB error fetching organization" }, { status: 503 });
      }
      if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }
      organization = org;
      const currency = getCurrencyForCountry(org.country || "PK");
      resolvedCurrencyCode = currencyCode || currency.code;
      resolvedCurrencySymbol = currencySymbol || currency.symbol;
    }

    // ── Compute totals ──
    const subtotal = lineItems.reduce((sum: number, li: any) => sum + (li.amount || 0), 0);
    const discount = Number(discountAmount) || 0;
    const taxableBase = Math.max(0, subtotal - discount);
    const tRate = Number(taxRate) || 0;
    const taxAmount = Math.round(taxableBase * (tRate / 100) * 100) / 100;
    const total = Math.round((taxableBase + taxAmount) * 100) / 100;

    // ── Generate invoice number ──
    const { data: invoiceCount } = await safeDbQuery(() =>
      db.invoice.count({ where: organizationId ? { organizationId } : {} })
    );
    const invoiceNumber = generateInvoiceNumber(invoiceCount || 0);
    const issuedAt = new Date();
    const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // ── Persist ──
    const createData: any = {
      invoiceNumber,
      organizationId: organizationId || "no-org", // placeholder; will overwrite below if no org
      planName: invoiceTitle || "Custom Services",
      amount: total,
      billingCycle: "one_time",
      status: sendImmediately ? "sent" : "draft",
      type: "custom",
      currencyCode: resolvedCurrencyCode,
      currencySymbol: resolvedCurrencySymbol,
      issuedAt,
      dueDate: resolvedDueDate,
      notes: notes || null,
      orgName: clientName,
      orgEmail: clientEmail || null,
      orgAddress: clientAddress || null,
      lineItems,
      subtotal,
      taxRate: tRate || null,
      taxAmount: taxAmount || null,
      discountAmount: discount || null,
      clientName,
      clientEmail: clientEmail || null,
      clientAddress: clientAddress || null,
      createdBy: authCtx.userId,
      invoiceTitle: invoiceTitle || null,
      paymentStatus: "unpaid",
      sentAt: sendImmediately ? issuedAt : null,
    };

    // If no organizationId provided, we need a placeholder org. Since Invoice.organizationId
    // is non-nullable, we'll use the platform's first org or fail gracefully.
    if (!organizationId) {
      const { data: firstOrg } = await safeDbQuery(() =>
        db.organization.findFirst({ orderBy: { createdAt: "asc" } })
      );
      if (firstOrg) {
        createData.organizationId = firstOrg.id;
      } else {
        return NextResponse.json(
          { error: "No organization exists in the database. Create an organization first." },
          { status: 400 }
        );
      }
    }

    const { data: invoice, error: createErr } = await safeDbQuery(() =>
      db.invoice.create({ data: createData })
    );

    if (createErr) {
      logger.error("[Custom Invoice Create] DB error", { error: createErr });
      if (String(createErr).includes("P2002") || String(createErr).includes("Unique constraint")) {
        return NextResponse.json({ error: "Invoice number conflict. Please retry." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create custom invoice" }, { status: 503 });
    }

    // ── Create notification ──
    await safeDbQuery(() =>
      db.notification.create({
        data: {
          orgId: createData.organizationId,
          userId: authCtx.userId,
          title: `Custom Invoice ${invoiceNumber} created`,
          message: `Custom invoice for ${clientName} (${resolvedCurrencySymbol} ${total.toLocaleString()}) has been created by ${authCtx.email}.`,
          type: "invoice_status",
          actionUrl: `/admin/invoices`,
        },
      })
    );

    logger.info("[Custom Invoice Create] Success", {
      invoiceId: invoice.id,
      invoiceNumber,
      clientName,
      total,
      userId: authCtx.userId,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Custom Invoice Create] Unhandled error", msg);
    return NextResponse.json({ error: "Failed to create custom invoice" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// ── GET /api/admin/invoices/custom — list custom invoices only ──
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { data, error } = await safeDbQuery(() =>
    db.invoice.findMany({
      where: { type: "custom" },
      include: {
        organization: { select: { id: true, name: true, email: true, plan: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  );
  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 503 });
  }
  return NextResponse.json({ invoices: data || [] });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
