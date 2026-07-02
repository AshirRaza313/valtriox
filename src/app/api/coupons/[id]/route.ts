import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validations/api";
import { updateCouponApiSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const PATCH = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Coupons] PATCH request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the coupon belongs to this organization
    const existing = await withRetry(async () => {
      return await db.coupon.findFirst({ where: { id, organizationId: orgId } })
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    const result = await validateBody(req, updateCouponApiSchema);
    if (!result.success) return result.response;
    const body = result.data;

    const coupon = await withRetry(async () => {
      return await db.coupon.update({
      where: { id },
      data: body,
    })
    }, 2, 500);
    return NextResponse.json({ coupon });
  } catch (error: unknown) {
    logger.error("Coupons PATCH error:", error);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

export const DELETE = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Coupons] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the coupon belongs to this organization
    const existing = await withRetry(async () => {
      return await db.coupon.findFirst({ where: { id, organizationId: orgId } })
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    await withRetry(async () => {
      return await db.coupon.delete({ where: { id } })
    }, 2, 500);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Coupons DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
