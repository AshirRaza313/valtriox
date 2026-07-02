import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry } from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validations/api";
import { updateCustomerDetailSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Customers] GET request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    const customer = await withRetry(async () => {
      return db.customer.findFirst({
        where: { id, organizationId: orgId },
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            include: { items: { select: { productName: true, quantity: true, total: true } } },
          },
        },
      });
    }, 2, 500);
    if (!customer) return notFoundOrUnauthorizedResponse();
    return NextResponse.json({ customer });
  } catch (error: unknown) {
    logger.error("Failed to fetch customer:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

export const PATCH = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Customers] PATCH request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify customer belongs to this organization
    const existing = await withRetry(async () => {
      return db.customer.findFirst({ where: { id, organizationId: orgId } });
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    const result = await validateBody(req, updateCustomerDetailSchema);
    if (!result.success) return result.response;
    const body = result.data;

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.city !== undefined) data.city = body.city || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.loyaltyTier !== undefined) data.loyaltyTier = body.loyaltyTier;
    if (body.totalSpent !== undefined) data.totalSpent = body.totalSpent;
    if (body.orderCount !== undefined) data.orderCount = body.orderCount;

    const customer = await withRetry(async () => {
      return db.customer.update({
        where: { id },
        data,
      });
    }, 2, 500);
    return NextResponse.json({ customer });
  } catch (error: unknown) {
    logger.error("Failed to update customer:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

export const DELETE = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Customers] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify customer belongs to this organization
    const existing = await withRetry(async () => {
      return db.customer.findFirst({ where: { id, organizationId: orgId } });
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    await withRetry(async () => {
      await db.customer.delete({ where: { id } });
    }, 2, 500);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Failed to delete customer:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
