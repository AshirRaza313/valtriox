import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const DELETE = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Expenses] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the expense belongs to this organization
    const existing = await withRetry(async () => {
      return await db.expense.findFirst({ where: { id, organizationId: orgId } })
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    await withRetry(async () => {
      return await db.expense.delete({ where: { id } })
    }, 2, 500);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Expenses DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
