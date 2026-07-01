import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { notFoundOrUnauthorizedResponse } from "@/lib/api-utils";
import { withAuth, RouteContext } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validations/api";
import { updateTaskSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";

export const PATCH = withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Tasks] PATCH request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the task belongs to this organization
    const existing = await withRetry(async () => {
      return await db.teamTask.findFirst({ where: { id, organizationId: orgId } })
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    const result = await validateBody(req, updateTaskSchema);
    if (!result.success) return result.response;
    const body = result.data;

    const task = await withRetry(async () => {
      return await db.teamTask.update({ where: { id }, data: body })
    }, 2, 500);
    return NextResponse.json({ task });
  } catch (error: any) {
    console.error("Tasks PATCH error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
  req: NextRequest,
  authCtx,
  ctx: RouteContext
) => {
  try {
    logger.info("[Tasks] DELETE request", { userId: authCtx.userId, orgId: authCtx.organizationId });
    const { id } = await ctx.params;
    const orgId = authCtx.organizationId!;

    // Verify the task belongs to this organization
    const existing = await withRetry(async () => {
      return await db.teamTask.findFirst({ where: { id, organizationId: orgId } })
    }, 2, 500);
    if (!existing) return notFoundOrUnauthorizedResponse();

    await withRetry(async () => {
      return await db.teamTask.delete({ where: { id } })
    }, 2, 500);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Tasks DELETE error:", error?.message || error);
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
});
