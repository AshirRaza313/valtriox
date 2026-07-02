import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry } from "@/lib/db";
import { missingOrgIdResponse, notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validations/api";
import { updateOrderDetailSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const DELETE = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Orders] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the order belongs to this organization
    await withRetry(async () => {
      const order = await db.order.findFirst({
        where: { id, organizationId: orgId },
        include: {
          items: { select: { productId: true, quantity: true } },
          customer: { select: { id: true } },
        },
      });

      if (!order) {
        return notFoundOrUnauthorizedResponse();
      }

      // Restore product stock
      for (const item of order.items) {
        try {
          await db.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        } catch {
          // Product might have been deleted, skip
        }
      }

      // Restore customer stats
      if (order.customerId && order.customer) {
        try {
          await db.customer.update({
            where: { id: order.customerId },
            data: {
              totalSpent: { decrement: order.total },
              orderCount: { decrement: 1 },
            },
          });
        } catch {
          // Customer might have been deleted, skip
        }
      }

      // Delete order items then order
      await db.orderItem.deleteMany({ where: { orderId: id } });
      await db.order.delete({ where: { id } });

      return { success: true };
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Delete order error:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

export const PATCH = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Orders] PATCH request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the order belongs to this organization
    const existing = await withRetry(async () => {
      const e = await db.order.findFirst({
        where: { id, organizationId: orgId },
      });
      return e;
    }, 2, 500);
    if (!existing) {
      return notFoundOrUnauthorizedResponse();
    }

    const result = await validateBody(req, updateOrderDetailSchema);
    if (!result.success) return result.response;
    const body = result.data;

    // Only allow certain fields to be updated (schema-validated)
    const allowedFields = ["status", "notes", "courier", "trackingNumber", "priority", "channel"] as const;
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const order = await withRetry(async () => {
      return db.order.update({
        where: { id },
        data: updateData,
        include: { customer: { select: { name: true } }, items: true },
      });
    }, 2, 500);
    return NextResponse.json({ order });
  } catch (error: unknown) {
    logger.error("Update order error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
