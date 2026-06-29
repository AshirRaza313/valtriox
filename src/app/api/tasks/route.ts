import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { validateBody, createTaskSchema } from "@/lib/validations";
import logger from "@/lib/logger";

export const GET = withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const tasks = await withRetry(async () => {
      return await db.teamTask.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
      });
    }, 2, 500);
    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    logger.error("Tasks GET error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ tasks: [], fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, authCtx) => {
  try {
    // Phase 3: Zod validation
    const bodyResult = await validateBody(req, createTaskSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { title, description, priority, assignedTo, dueDate } = bodyResult.data;

    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const task = await withRetry(async () => {
      return await db.teamTask.create({
        data: {
          organizationId: orgId,
          title,
          description: description || null,
          priority: priority || "medium",
          assignedTo: assignedTo || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });
    }, 2, 500);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    logger.error("Tasks POST error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
});
