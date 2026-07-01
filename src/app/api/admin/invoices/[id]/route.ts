import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db, safeDbQuery } from "@/lib/db";
import logger from "@/lib/logger";

// ── Valid status transitions ──
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  pending: ["paid", "approved", "cancelled"],
  sent: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
  paid: [],
  approved: [],
  cancelled: [],
  refunded: [],
};

// ── GET /api/admin/invoices/:id ──
export const GET = withAuth(async (req: NextRequest, authCtx, ctx: { params: Promise<{ id: string }> }) => {
    logger.info("[Admin Invoice Detail] GET request", {
      userId: authCtx.userId,
      invoiceId: (await ctx.params).id,
    });

    const { id } = await ctx.params;

    const { data: invoice, error } = await safeDbQuery(() =>
      db.invoice.findUnique({
        where: { id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              plan: true,
            },
          },
        },
      })
    );

    if (error) {
      logger.error("[Admin Invoice Detail] GET failed", { error, userId: authCtx.userId });
      return NextResponse.json({ error: "Failed to fetch invoice", detail: process.env.NODE_ENV === 'production' ? undefined : error?.substring(0, 200) }, { status: 503 });
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Fetch status history from notifications related to this invoice
    const { data: statusNotifications } = await safeDbQuery(() =>
      db.notification.findMany({
        where: {
          orgId: invoice.organizationId,
          type: "invoice_status",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true,
        },
      })
    );

    const statusHistory = (statusNotifications || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      createdAt: n.createdAt.toISOString(),
    }));

    return NextResponse.json({ invoice, statusHistory });
}, {
  requireRole: ["platform_owner", "platform_admin"],
  requireOrg: false,
});

// ── PUT /api/admin/invoices/:id ──
// Body: { status, dueDate, notes, paidAt, paymentMethod, paymentReference }
export const PUT = withAuth(async (req: NextRequest, authCtx, ctx: { params: Promise<{ id: string }> }) => {
    logger.info("[Admin Invoice Update] PUT request", {
      userId: authCtx.userId,
      invoiceId: (await ctx.params).id,
    });

    const { id } = await ctx.params;

    // Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Fetch existing invoice
    const { data: existing, error: fetchErr } = await safeDbQuery(() =>
      db.invoice.findUnique({
        where: { id },
        include: {
          organization: {
            select: { id: true, name: true, email: true },
          },
        },
      })
    );

    if (fetchErr) {
      logger.error("[Admin Invoice Update] Fetch failed", { error: fetchErr, userId: authCtx.userId });
      return NextResponse.json({ error: "Failed to fetch invoice", detail: process.env.NODE_ENV === 'production' ? undefined : fetchErr?.substring(0, 200) }, { status: 503 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    // Handle status transition
    if (body.status && body.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(body.status)) {
        logger.warn("[Admin Invoice Update] Invalid status transition", {
          userId: authCtx.userId,
          from: existing.status,
          to: body.status,
        });
        return NextResponse.json(
          {
            error: `Invalid status transition from '${existing.status}' to '${body.status}'. Allowed: ${allowed.join(", ") || "none"}`,
          },
          { status: 400 }
        );
      }
      updateData.status = body.status;

      // Auto-set paidAt when status changes to paid
      if (body.status === "paid" && !body.paidAt && !existing.paidAt) {
        updateData.paidAt = new Date();
      }
    }

    // Handle paidAt (allow explicit override)
    if (body.paidAt) {
      updateData.paidAt = new Date(body.paidAt);
    }

    // Handle dueDate
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    // Handle notes — append payment method/reference info if provided
    let notesContent = existing.notes || "";
    if (body.notes !== undefined) {
      notesContent = body.notes;
    }
    if (body.paymentMethod || body.paymentReference) {
      const paymentInfo: string[] = [];
      if (body.paymentMethod) {
        paymentInfo.push(`Payment Method: ${body.paymentMethod}`);
      }
      if (body.paymentReference) {
        paymentInfo.push(`Reference: ${body.paymentReference}`);
      }
      const paymentNote = paymentInfo.join(" | ");
      notesContent = notesContent
        ? `${notesContent}\n${paymentNote}`
        : paymentNote;
    }
    if (notesContent !== existing.notes) {
      updateData.notes = notesContent;
    }

    // Perform update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        invoice: existing,
        message: "No changes to apply",
      });
    }

    const { data: updated, error: updateErr } = await safeDbQuery(() =>
      db.invoice.update({
        where: { id },
        data: updateData,
        include: {
          organization: {
            select: { id: true, name: true, email: true, plan: true },
          },
        },
      })
    );

    if (updateErr) {
      logger.error("[Admin Invoice Update] Update failed", { error: updateErr, userId: authCtx.userId });
      return NextResponse.json({ error: "Failed to update invoice", detail: process.env.NODE_ENV === 'production' ? undefined : updateErr?.substring(0, 200) }, { status: 503 });
    }

    // Create notification on status change
    if (updateData.status && updateData.status !== existing.status) {
      const orgId = existing.organization?.id;
      const orgName = existing.organization?.name || existing.orgName || "Unknown";

      await safeDbQuery(() =>
        db.notification.create({
          data: {
            orgId,
            title: `Invoice ${existing.invoiceNumber} | ${updateData.status}`,
            message: `Invoice #${existing.invoiceNumber} for ${orgName} has been updated to "${updateData.status}" by ${authCtx.email}.`,
            type: "invoice_status",
            actionUrl: `/admin/invoices`,
          },
        })
      );

      logger.info("[Admin Invoice Update] Notification created", {
        invoiceId: id,
        newStatus: updateData.status,
        orgId,
      });
    }

    logger.info("[Admin Invoice Update] Invoice updated successfully", {
      invoiceId: id,
      changes: Object.keys(updateData),
      userId: authCtx.userId,
    });

    return NextResponse.json({
      invoice: updated,
      message: `Invoice updated successfully`,
    });
}, {
  requireRole: ["platform_owner", "platform_admin"],
  requireOrg: false,
});
