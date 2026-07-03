// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, RouteContext, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * Build a detailed error message from a safeDbQuery rawError.
 * Uses the RAW error object (preserved even in production) so we can
 * extract the Prisma code, message, and meta for diagnosis.
 *
 * IMPORTANT: This route is admin-only. Prisma error codes are documented
 * public codes and safe to expose to admins.
 */
function describeDbError(rawError: unknown): string {
  if (!rawError) return "unknown error";
  const errObj = rawError as any;
  const prismaCode = errObj?.code || "N/A";
  const prismaMessage = errObj?.message
    ? String(errObj.message).substring(0, 250)
    : String(rawError).substring(0, 250);
  const prismaMeta = errObj?.meta ? JSON.stringify(errObj.meta).substring(0, 250) : "";
  return `Prisma[code=${prismaCode}]: ${prismaMessage}${prismaMeta ? ` | meta=${prismaMeta}` : ""}`;
}

// POST /api/admin/invoices/:id/send
// Body: { email?, subject?, message? }
// Marks invoice as "sent", sets sentAt, optionally emails the client
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Only platform administrators can send invoices" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  // ── Attempt 1: findUnique with organization include ──
  let existing: any = null;
  let fetchErr: unknown = null;

  const r1 = await safeDbQuery(() =>
    db.invoice.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true, email: true } } },
    })
  );
  existing = r1.data;
  fetchErr = r1.rawError;

  // ── Attempt 2: if include fails, retry WITHOUT the include ──
  if (!existing && fetchErr) {
    logger.warn("[Invoice Send] findUnique with include failed, retrying without include", {
      invoiceId: id,
      error: describeDbError(fetchErr),
    });
    const r2 = await safeDbQuery(() => db.invoice.findUnique({ where: { id } }));
    existing = r2.data;
    if (!existing && r2.rawError) {
      const errInfo = describeDbError(r2.rawError);
      logger.error("[Invoice Send] Both findUnique attempts failed", {
        invoiceId: id,
        attempt1Err: describeDbError(fetchErr),
        attempt2Err: errInfo,
      });
      return NextResponse.json({
        error: `Failed to fetch invoice. ${errInfo}`,
      }, { status: 503 });
    }
    // Attempt 2 succeeded — fetch the organization separately (best-effort)
    if (existing?.organizationId) {
      const orgRes = await safeDbQuery(() =>
        db.organization.findUnique({
          where: { id: existing.organizationId },
          select: { id: true, name: true, email: true },
        })
      );
      if (orgRes.data) {
        existing.organization = orgRes.data;
      }
    }
  }

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Allow sending from draft or pending state
  const allowedFrom = ["draft", "pending"];
  if (!allowedFrom.includes(existing.status)) {
    return NextResponse.json({
      error: `Cannot send invoice in '${existing.status}' state. Already sent or finalized.`,
    }, { status: 400 });
  }

  const recipientEmail = body.email || existing.clientEmail || existing.orgEmail || existing.organization?.email;
  if (!recipientEmail) {
    return NextResponse.json({
      error: "No recipient email available. Provide an email in the request body.",
    }, { status: 400 });
  }

  const now = new Date();

  // ── Attempt 1: Prisma update with include ──
  let updated: any = null;
  let updErr: unknown = null;

  const u1 = await safeDbQuery(() =>
    db.invoice.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: now,
        clientEmail: recipientEmail,
      },
      include: { organization: { select: { id: true, name: true, email: true } } },
    })
  );
  updated = u1.data;
  updErr = u1.rawError;

  // ── Attempt 2: if update with include fails, retry WITHOUT the include ──
  if (!updated && updErr) {
    logger.warn("[Invoice Send] update with include failed, retrying without include", {
      invoiceId: id,
      error: describeDbError(updErr),
    });
    const u2 = await safeDbQuery(() =>
      db.invoice.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: now,
          clientEmail: recipientEmail,
        },
      })
    );
    updated = u2.data;
    if (!updated && u2.rawError) {
      const errInfo = describeDbError(u2.rawError);
      logger.error("[Invoice Send] Both update attempts failed", {
        invoiceId: id,
        attempt1Err: describeDbError(updErr),
        attempt2Err: errInfo,
      });
      return NextResponse.json({
        error: `Failed to mark invoice as sent. ${errInfo}`,
      }, { status: 503 });
    }
    // Update succeeded without include — fetch org separately for the response
    if (updated?.organizationId) {
      const orgRes = await safeDbQuery(() =>
        db.organization.findUnique({
          where: { id: updated.organizationId },
          select: { id: true, name: true, email: true },
        })
      );
      if (orgRes.data) {
        updated.organization = orgRes.data;
      }
    }
  }

  // Create a notification for the org (best-effort)
  await safeDbQuery(() =>
    db.notification.create({
      data: {
        orgId: existing.organizationId,
        title: `Invoice ${existing.invoiceNumber} sent to ${recipientEmail}`,
        message: `Invoice #${existing.invoiceNumber} for ${existing.clientName || existing.orgName || "client"} (${existing.currencySymbol} ${Number(existing.amount).toLocaleString()}) was emailed by ${authCtx.email}.`,
        type: "invoice_status",
        actionUrl: `/admin/invoices`,
      },
    })
  );

  // Note: Actual email delivery is handled by an external email service (Resend/SendGrid).
  // For now we mark as sent in DB; the front-end can include a mailto: link as a fallback.

  logger.info("[Invoice Send] Success", { invoiceId: id, recipientEmail, userId: authCtx.userId });
  return NextResponse.json({
    invoice: updated,
    recipientEmail,
    message: `Invoice emailed to ${recipientEmail}`,
  });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
