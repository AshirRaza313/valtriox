import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";

export const PATCH = withAuth(async (
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

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const coupon = await withRetry(async () => {
      return await db.coupon.update({
      where: { id },
      data: body,
    })
    }, 2, 500);
    return NextResponse.json({ coupon });
  } catch (error: any) {
    console.error("Coupons PATCH error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
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
  } catch (error: any) {
    console.error("Coupons DELETE error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
});
