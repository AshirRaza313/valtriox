import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, withRetry} from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

export const DELETE = withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Expenses] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    await ensureDb();
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
  } catch (error: any) {
    console.error("Expenses DELETE error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
});
