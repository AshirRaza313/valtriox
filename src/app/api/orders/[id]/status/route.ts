import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry } from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validations/api";
import { updateOrderStatusSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";

export const PATCH = withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Orders] Status PATCH request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the order belongs to this organization
    const existing = await withRetry(async () => {
      return db.order.findFirst({
        where: { id, organizationId: orgId },
      });
    }, 2, 500);
    if (!existing) {
      return notFoundOrUnauthorizedResponse();
    }

    const result = await validateBody(req, updateOrderStatusSchema);
    if (!result.success) return result.response;
    const body = result.data;

    const order = await withRetry(async () => {
      return db.order.update({
        where: { id },
        data: { status: body.status },
        include: { customer: { select: { name: true } }, items: true },
      });
    }, 2, 500);
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error("Order status update error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
});
