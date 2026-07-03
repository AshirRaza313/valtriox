// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery, getDirectPool, resilientDirectQuery } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── Proactive schema ensure for Invoice Phase 2 columns ──
// Runs idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS for every Phase 2 column
// BEFORE attempting the create. This eliminates the "create fails → auto-repair →
// retry" round-trip that was causing invoice creation to fail silently.
//
// Uses resilientDirectQuery which falls back to Prisma's PgBouncer pool if the
// direct pool DNS fails (ENOTFOUND on db.{ref}.supabase.co from Vercel).
let invoiceSchemaEnsured = false;
async function ensureInvoicePhase2Columns(): Promise<void> {
  if (invoiceSchemaEnsured) return;
  const cols: [string, string][] = [
    ["lineItems", "JSONB"],
    ["subtotal", "DECIMAL(12,2)"],
    ["taxRate", "DECIMAL(5,2)"],
    ["taxAmount", "DECIMAL(10,2)"],
    ["discountAmount", "DECIMAL(10,2)"],
    ["clientEmail", "TEXT"],
    ["clientName", "TEXT"],
    ["clientAddress", "TEXT"],
    ["approvedBy", "TEXT"],
    ["approvedAt", "TIMESTAMP(3)"],
    ["sentAt", "TIMESTAMP(3)"],
    ["createdBy", "TEXT"],
    ["invoiceTitle", "TEXT"],
    ["paymentStatus", "TEXT"],
  ];
  let allOk = true;
  for (const [col, type] of cols) {
    // Use plain ALTER TABLE ... ADD COLUMN IF NOT EXISTS (no DO $$ wrapper).
    // The IF NOT EXISTS clause is already idempotent in PostgreSQL 9.6+,
    // so the exception handler is unnecessary. Plain ALTER TABLE is also
    // more compatible with PgBouncer transaction-mode pooling.
    const result = await resilientDirectQuery(
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "${col}" ${type};`
    );
    if (!result.ok) allOk = false;
  }
  if (allOk) {
    invoiceSchemaEnsured = true;
    logger.info("[Custom Invoice] Phase 2 columns ensured");
  } else {
    logger.warn("[Custom Invoice] Some Phase 2 columns could not be ensured (will retry next request)");
  }
}

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

    // ── Proactively ensure Phase 2 columns exist ──
    await ensureInvoicePhase2Columns();

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

    // ── Resolve organizationId (Invoice.organizationId is non-nullable) ──
    // If the admin didn't pick a client org, fall back to the first org in the DB.
    let resolvedOrgId = organizationId || "";
    if (!resolvedOrgId) {
      const { data: firstOrg } = await safeDbQuery(() =>
        db.organization.findFirst({ orderBy: { createdAt: "asc" } })
      );
      if (firstOrg) {
        resolvedOrgId = firstOrg.id;
      } else {
        return NextResponse.json(
          { error: "No organization exists in the database. Create an organization first via /api/setup/init." },
          { status: 400 }
        );
      }
    }

    // ── Persist (Prisma path) ──
    const createData: any = {
      invoiceNumber,
      organizationId: resolvedOrgId,
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

    let invoice: any = null;
    let createErr: any = null;

    // Attempt 1: Prisma create
    let prismaResult = await safeDbQuery(() => db.invoice.create({ data: createData }));
    invoice = prismaResult.data;
    createErr = prismaResult.error;

    // Attempt 1b: If Prisma failed due to a missing column, force a fresh
    // schema ensure (reset the cached flag first) and retry the create once.
    // This handles the race condition where the very first request after a
    // deploy hits the schema-ensure step while the direct pool is still
    // warming up — the ALTERs fail silently, then the create fails too.
    if (!invoice && createErr) {
      const errMsg = String(createErr).toLowerCase();
      if (errMsg.includes('does not exist') || errMsg.includes('column') || errMsg.includes('schema')) {
        logger.warn("[Custom Invoice Create] Prisma failed with schema error — forcing fresh schema ensure + retry", {
          error: String(createErr).substring(0, 150),
        });
        invoiceSchemaEnsured = false; // force re-ensure
        await ensureInvoicePhase2Columns();
        prismaResult = await safeDbQuery(() => db.invoice.create({ data: createData }));
        invoice = prismaResult.data;
        createErr = prismaResult.error;
      }
    }

    // Attempt 2: Direct SQL INSERT fallback (if Prisma fails for any reason)
    if (!invoice && createErr) {
      logger.warn("[Custom Invoice Create] Prisma path failed, trying direct SQL fallback", {
        error: String(createErr).substring(0, 200),
      });
      const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const lineItemsJson = JSON.stringify(lineItems);
      const insertResult = await resilientDirectQuery(
        `INSERT INTO "Invoice" (
          "id", "invoiceNumber", "organizationId", "planName", "amount",
          "billingCycle", "status", "type", "currencyCode", "currencySymbol",
          "issuedAt", "dueDate", "notes", "orgName", "orgEmail", "orgAddress",
          "lineItems", "subtotal", "taxRate", "taxAmount", "discountAmount",
          "clientName", "clientEmail", "clientAddress", "createdBy",
          "invoiceTitle", "paymentStatus", "sentAt", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17::jsonb, $18, $19, $20, $21,
          $22, $23, $24, $25,
          $26, $27, $28, NOW(), NOW()
        )`,
        [
          invId,
          invoiceNumber,
          resolvedOrgId,
          invoiceTitle || "Custom Services",
          total,
          "one_time",
          sendImmediately ? "sent" : "draft",
          "custom",
          resolvedCurrencyCode,
          resolvedCurrencySymbol,
          issuedAt,
          resolvedDueDate,
          notes || null,
          clientName,
          clientEmail || null,
          clientAddress || null,
          lineItemsJson,
          subtotal,
          tRate || null,
          taxAmount || null,
          discount || null,
          clientName,
          clientEmail || null,
          clientAddress || null,
          authCtx.userId,
          invoiceTitle || null,
          "unpaid",
          sendImmediately ? issuedAt : null,
        ]
      );
      if (insertResult.ok) {
        // Fetch the created invoice to return consistent shape
        const fetchResult = await safeDbQuery(() =>
          db.invoice.findUnique({ where: { id: invId } })
        );
        invoice = fetchResult.data;
        logger.info("[Custom Invoice Create] Direct SQL fallback succeeded", { invoiceId: invId });
      } else {
        const sqlMsg = insertResult.error || "unknown SQL error";
        logger.error("[Custom Invoice Create] Direct SQL fallback also failed", { error: sqlMsg.substring(0, 200) });
        const errMsg = process.env.NODE_ENV === "production"
          ? `Failed to create invoice. Prisma: ${String(createErr).substring(0, 80)} | SQL: ${sqlMsg.substring(0, 80)}`
          : `Failed to create invoice. Prisma: ${String(createErr).substring(0, 150)} | SQL: ${sqlMsg.substring(0, 150)}`;
        return NextResponse.json({ error: errMsg }, { status: 503 });
      }
    }

    if (!invoice) {
      // Both paths failed — surface the error
      const errMsg = process.env.NODE_ENV === "production"
        ? `Failed to create invoice: ${String(createErr || "unknown error").substring(0, 100)}`
        : `Failed to create invoice: ${String(createErr || "unknown error").substring(0, 200)}`;
      return NextResponse.json({ error: errMsg }, { status: 503 });
    }

    // ── Create notification (best-effort) ──
    await safeDbQuery(() =>
      db.notification.create({
        data: {
          orgId: resolvedOrgId,
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
    const errMsg = process.env.NODE_ENV === "production"
      ? `Failed to create custom invoice: ${msg.substring(0, 100)}`
      : `Failed to create custom invoice: ${msg.substring(0, 200)}`;
    return NextResponse.json({ error: errMsg }, { status: 500 });
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
