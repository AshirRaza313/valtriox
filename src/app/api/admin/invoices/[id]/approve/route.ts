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

// POST /api/admin/invoices/:id/approve
// Body: { paymentMethod?, transactionId?, paymentReference?, adminNote? }
// Marks invoice payment as verified, unlocks PDF download for client
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx, ctx: RouteContext) => {
  if (!isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Only platform administrators can approve payments" }, { status: 403 });
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

  // ── Attempt 2: WITHOUT include (defensive fallback) ──
  if (!existing && fetchErr) {
    logger.warn("[Invoice Approve] findUnique with include failed, retrying without include", {
      invoiceId: id,
      error: describeDbError(fetchErr),
    });
    const r2 = await safeDbQuery(() => db.invoice.findUnique({ where: { id } }));
    existing = r2.data;
    if (!existing && r2.rawError) {
      const errInfo = describeDbError(r2.rawError);
      logger.error("[Invoice Approve] Both findUnique attempts failed", {
        invoiceId: id,
        attempt1Err: describeDbError(fetchErr),
        attempt2Err: errInfo,
      });
      return NextResponse.json({ error: `Failed to fetch invoice. ${errInfo}` }, { status: 503 });
    }
    if (existing?.organizationId) {
      const orgRes = await safeDbQuery(() =>
        db.organization.findUnique({
          where: { id: existing.organizationId },
          select: { id: true, name: true, email: true },
        })
      );
      if (orgRes.data) existing.organization = orgRes.data;
    }
  }

  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (existing.status === "paid" || existing.status === "approved") {
    return NextResponse.json({ error: "Invoice is already approved/paid", invoice: existing }, { status: 400 });
  }

  // Transition: draft | sent | pending → approved
  const allowedFrom = ["draft", "sent", "pending", "overdue"];
  if (!allowedFrom.includes(existing.status)) {
    return NextResponse.json({
      error: `Cannot approve invoice in '${existing.status}' state`,
    }, { status: 400 });
  }

  // Append payment metadata to notes
  let notesContent = existing.notes || "";
  const paymentInfo: string[] = [];
  if (body.paymentMethod) paymentInfo.push(`Payment Method: ${body.paymentMethod}`);
  if (body.transactionId) paymentInfo.push(`Transaction ID: ${body.transactionId}`);
  if (body.paymentReference) paymentInfo.push(`Reference: ${body.paymentReference}`);
  if (body.adminNote) paymentInfo.push(`Admin Note: ${body.adminNote}`);
  if (paymentInfo.length > 0) {
    const paymentNote = `[Verified by ${authCtx.email} on ${new Date().toISOString()}]\n${paymentInfo.join("\n")}`;
    notesContent = notesContent ? `${notesContent}\n\n${paymentNote}` : paymentNote;
  }

  const now = new Date();

  // ── Attempt 1: update with include ──
  let updated: any = null;
  let updErr: unknown = null;
  const u1 = await safeDbQuery(() =>
    db.invoice.update({
      where: { id },
      data: {
        status: "approved",
        paidAt: existing.paidAt || now,
        approvedAt: now,
        approvedBy: authCtx.userId,
        paymentStatus: "verified",
        notes: notesContent,
      },
      include: { organization: { select: { id: true, name: true, email: true } } },
    })
  );
  updated = u1.data;
  updErr = u1.rawError;

  // ── Attempt 2: WITHOUT include ──
  if (!updated && updErr) {
    logger.warn("[Invoice Approve] update with include failed, retrying without include", {
      invoiceId: id,
      error: describeDbError(updErr),
    });
    const u2 = await safeDbQuery(() =>
      db.invoice.update({
        where: { id },
        data: {
          status: "approved",
          paidAt: existing.paidAt || now,
          approvedAt: now,
          approvedBy: authCtx.userId,
          paymentStatus: "verified",
          notes: notesContent,
        },
      })
    );
    updated = u2.data;
    if (!updated && u2.rawError) {
      const errInfo = describeDbError(u2.rawError);
      logger.error("[Invoice Approve] Both update attempts failed", {
        invoiceId: id,
        attempt1Err: describeDbError(updErr),
        attempt2Err: errInfo,
      });
      return NextResponse.json({ error: `Failed to approve invoice. ${errInfo}` }, { status: 503 });
    }
    if (updated?.organizationId) {
      const orgRes = await safeDbQuery(() =>
        db.organization.findUnique({
          where: { id: updated.organizationId },
          select: { id: true, name: true, email: true },
        })
      );
      if (orgRes.data) updated.organization = orgRes.data;
    }
  }

  // Notify org (best-effort)
  await safeDbQuery(() =>
    db.notification.create({
      data: {
        orgId: existing.organizationId,
        title: `Invoice ${existing.invoiceNumber} — Payment Verified`,
        message: `Payment for invoice #${existing.invoiceNumber} (${existing.currencySymbol} ${Number(existing.amount).toLocaleString()}) has been verified by ${authCtx.email}. You can now download the official PDF.`,
        type: "invoice_status",
        actionUrl: `/admin/invoices`,
      },
    })
  );

  logger.info("[Invoice Approve] Success", { invoiceId: id, userId: authCtx.userId });
  return NextResponse.json({
    invoice: updated,
    message: "Payment approved. PDF download unlocked for client.",
  });
}, { requireRole: ["platform_owner", "platform_admin", "admin", "owner"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
