import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";

export const GET = withAuth(async (req, authCtx) => {
  try {
    await ensureDb();
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
    })
    }, 2, 500);
    return NextResponse.json({ tasks });
  } catch (error: any) {
    logger.error("Tasks GET error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ tasks: [], fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, authCtx) => {
  try {
    await ensureDb();
    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { organizationId, title, description, priority, assignedTo, dueDate } = body;
    const orgId = organizationId || authCtx.organizationId;

    if (!orgId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: Ensure user can only create tasks in their own org
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
    })
    }, 2, 500);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    logger.error("Tasks POST error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
});
