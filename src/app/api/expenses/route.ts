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

    const where: any = { organizationId: orgId };
    const category = searchParams.get("category");
    if (category && category !== "all") where.category = category;

    const expenses = await withRetry(async () => {
      return await db.expense.findMany({ where, orderBy: { date: "desc" } })
    }, 2, 500);
    return NextResponse.json({ expenses });
  } catch (error: any) {
    logger.error("Expenses GET error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ expenses: [], fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, authCtx) => {
  try {
    await ensureDb();
    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { organizationId, title, amount, category, date, description } = body;
    const orgId = organizationId || authCtx.organizationId;

    if (!orgId || !title || !amount || !category || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: Ensure user can only create expenses in their own org
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const expense = await withRetry(async () => {
      return await db.expense.create({
      data: {
        organizationId: orgId,
        title,
        amount: parseFloat(amount),
        category,
        date: new Date(date),
        description: description || null,
      },
    })
    }, 2, 500);

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    logger.error("Expenses POST error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
});
