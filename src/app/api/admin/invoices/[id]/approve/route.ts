// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, RouteContext, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

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

  const { data: existing, error: fetchErr } = await safeDbQuery(() =>
    db.invoice.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true, email: true } } },
    })
  );
  if (fetchErr) return NextResponse.json({ error: "DB error" }, { status: 503 });
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
  const { data: updated, error: updErr } = await safeDbQuery(() =>
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

  if (updErr) {
    logger.error("[Invoice Approve] Update failed", { error: updErr });
    return NextResponse.json({ error: "Failed to approve invoice" }, { status: 503 });
  }

  // Notify org
  await safeDbQuery(() =>
    db.notification.create({
      data: {
        orgId: existing.organizationId,
        title: `Invoice ${existing.invoiceNumber} — Payment Verified ✓`,
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
