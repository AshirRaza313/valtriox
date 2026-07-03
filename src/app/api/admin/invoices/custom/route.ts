// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── Proactive schema ensure for Invoice Phase 2 columns ──
// Runs idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS for every Phase 2 column
// BEFORE attempting the create.
//
// IMPORTANT: We use Prisma's $executeRawUnsafe DIRECTLY — NOT the direct pool.
// Supabase has DEPRECATED direct external connections (db.{ref}.supabase.co)
// from Vercel — the DNS no longer resolves (ENOTFOUND). Prisma's normal
// connection goes through the PgBouncer pooler (aws-X-{region}.pooler.supabase.com)
// which is the supported, reliable path. ALTER TABLE ADD COLUMN IF NOT EXISTS
// works fine through PgBouncer transaction mode.
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
    try {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "${col}" ${type};`
      );
    } catch (e) {
      // Column may already exist (race condition) or other minor error — log and continue
      logger.warn("[Custom Invoice] Schema ensure column failed (continuing)", {
        col, type, error: String(e).substring(0, 120),
      });
      allOk = false;
    }
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

    // ── Generate invoice number (collision-proof) ──
    // The old approach used count() + 1, which is racy and breaks if any
    // invoice was ever deleted (count goes down, but sequence doesn't).
    // Instead, query the MAX existing sequence number for the current year
    // and increment by 1. Also retry on unique-violation (P2002 / 23505)
    // with a fresh sequence number.
    const generateUniqueInvoiceNumber = async (): Promise<string> => {
      const year = new Date().getFullYear();
      // Query MAX sequence for this year via Prisma raw query
      // Pattern: VTX-2026-0007 → extract 0007 → 7
      const rows = await db.$queryRawUnsafe(
        `SELECT "invoiceNumber" FROM "Invoice"
         WHERE "invoiceNumber" LIKE $1
         ORDER BY "invoiceNumber" DESC
         LIMIT 1;`,
        `VTX-${year}-%`
      ) as any[];
      let nextSeq = 1;
      if (rows && rows.length > 0 && rows[0].invoiceNumber) {
        const parts = String(rows[0].invoiceNumber).split("-");
        const seqNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seqNum)) nextSeq = seqNum + 1;
      }
      const seq = String(nextSeq).padStart(4, "0");
      return `VTX-${year}-${seq}`;
    };
    let invoiceNumber = await generateUniqueInvoiceNumber();
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

    // ── Persist (with retry on invoiceNumber collision) ──
    // We try up to 3 times with a fresh invoiceNumber each attempt, in case
    // of a unique-violation (P2002 / 23505) race condition.
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
    let lastSqlErr: any = null;

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !invoice; attempt++) {
      if (attempt > 1) {
        // Generate a fresh invoice number for retry
        invoiceNumber = await generateUniqueInvoiceNumber();
        createData.invoiceNumber = invoiceNumber;
      }

      // ── Attempt A: Prisma create ──
      const prismaResult = await safeDbQuery(() => db.invoice.create({ data: createData }));
      invoice = prismaResult.data;
      createErr = prismaResult.error;

      if (createErr) {
        // Log the FULL Prisma error object (code, meta, message) for debugging
        const errObj = createErr as any;
        logger.warn("[Custom Invoice Create] Prisma create failed", {
          attempt,
          invoiceNumber,
          prismaCode: errObj?.code || "N/A",
          prismaMessage: errObj?.message ? String(errObj.message).substring(0, 200) : String(createErr).substring(0, 200),
          prismaMeta: errObj?.meta ? JSON.stringify(errObj.meta).substring(0, 300) : "N/A",
        });

        // If it's a unique constraint violation on invoiceNumber, retry with a new number
        const errStr = String(createErr).toLowerCase();
        const isUniqueViolation =
          errObj?.code === "P2002" ||
          errStr.includes("unique constraint") ||
          errStr.includes("already exists");
        if (isUniqueViolation && attempt < MAX_ATTEMPTS) {
          logger.info("[Custom Invoice Create] Retrying with new invoice number due to unique violation", { attempt });
          continue; // skip the SQL fallback, retry Prisma create with new number
        }

        // If it's a schema error (missing column), force re-ensure + retry once
        if (errStr.includes("does not exist") || errStr.includes("column")) {
          logger.warn("[Custom Invoice Create] Schema error — forcing fresh schema ensure", { attempt });
          invoiceSchemaEnsured = false;
          await ensureInvoicePhase2Columns();
          const retryResult = await safeDbQuery(() => db.invoice.create({ data: createData }));
          invoice = retryResult.data;
          createErr = retryResult.error;
          if (invoice) break;
        }
      }

      if (invoice) break;

      // ── Attempt B: $executeRawUnsafe INSERT fallback ──
      // Use Prisma's PgBouncer connection (NOT the deprecated direct pool).
      try {
        const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const lineItemsJson = JSON.stringify(lineItems);
        await db.$executeRawUnsafe(
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
          sendImmediately ? issuedAt : null
        );
        // Fetch the created invoice to return consistent shape
        const fetchResult = await safeDbQuery(() =>
          db.invoice.findUnique({ where: { id: invId } })
        );
        invoice = fetchResult.data;
        logger.info("[Custom Invoice Create] $executeRawUnsafe INSERT succeeded", { invoiceId: invId, attempt });
        break;
      } catch (sqlErr: unknown) {
        lastSqlErr = sqlErr;
        const sqlErrObj = sqlErr as any;
        const sqlMsg = sqlErr instanceof Error ? sqlErr.message : String(sqlErr);
        logger.error("[Custom Invoice Create] $executeRawUnsafe INSERT failed", {
          attempt,
          invoiceNumber,
          sqlMessage: sqlMsg.substring(0, 300),
          sqlCode: sqlErrObj?.code || "N/A",
          sqlMeta: sqlErrObj?.meta ? JSON.stringify(sqlErrObj.meta).substring(0, 300) : "N/A",
        });

        // If it's a unique violation on invoiceNumber, retry with a new number
        const errStr = sqlMsg.toLowerCase();
        const isUniqueViolation =
          errStr.includes("23505") ||
          errStr.includes("unique constraint") ||
          errStr.includes("already exists") ||
          errStr.includes("duplicate key");
        if (isUniqueViolation && attempt < MAX_ATTEMPTS) {
          logger.info("[Custom Invoice Create] Retrying with new invoice number due to SQL unique violation", { attempt });
          continue;
        }
        // For other SQL errors, break and surface the error
        break;
      }
    }

    if (!invoice) {
      // Both paths failed — surface the FULL error for debugging
      const errObj = createErr as any;
      const sqlErrObj = lastSqlErr as any;
      const prismaInfo = errObj
        ? `Prisma[code=${errObj?.code || "?"}]: ${errObj?.message ? String(errObj.message).substring(0, 200) : String(createErr).substring(0, 200)}`
        : "no error";
      const sqlInfo = sqlErrObj
        ? `SQL[code=${sqlErrObj?.code || "?"}]: ${sqlErrObj?.message ? String(sqlErrObj.message).substring(0, 200) : String(lastSqlErr).substring(0, 200)}`
        : "no error";
      const errMsg = `Failed to create invoice. ${prismaInfo} | ${sqlInfo}`;
      logger.error("[Custom Invoice Create] All attempts failed", {
        invoiceNumber,
        prismaInfo,
        sqlInfo,
        prismaMeta: errObj?.meta ? JSON.stringify(errObj.meta) : "N/A",
        sqlMeta: sqlErrObj?.meta ? JSON.stringify(sqlErrObj.meta) : "N/A",
      });
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
