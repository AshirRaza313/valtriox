import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject, sanitizeEmail, sanitizePhone } from "@/lib/sanitize";
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

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    const [customers, totalCount] = await Promise.all([
      withRetry(async () => {
        return db.customer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });
      }, 2, 500),
      withRetry(async () => {
        return db.customer.count({ where: { organizationId: orgId } });
      }, 2, 500),
    ]);

    // Aggregate stats (computed from the full org, not just the current page)
    const [totalRevenue, totalOrders, tierAgg] = await Promise.all([
      db.customer.aggregate({
        where: { organizationId: orgId },
        _sum: { totalSpent: true },
      }),
      db.customer.aggregate({
        where: { organizationId: orgId },
        _sum: { orderCount: true },
      }),
      db.customer.groupBy({
        by: ["loyaltyTier"],
        where: { organizationId: orgId },
        _count: { loyaltyTier: true },
      }),
    ]);

    const rev = Number(totalRevenue._sum.totalSpent || 0);
    const ord = Number(totalOrders._sum.orderCount || 0);
    const avgOrderValue = ord > 0 ? rev / ord : 0;

    const tierCounts = { new: 0, bronze: 0, silver: 0, gold: 0 };
    for (const t of tierAgg) {
      if (t.loyaltyTier in tierCounts) {
        tierCounts[t.loyaltyTier as keyof typeof tierCounts] = t._count.loyaltyTier;
      }
    }
    const vipCount = tierCounts.gold + tierCounts.silver;

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalCustomers: totalCount,
        totalRevenue: rev,
        totalOrders: ord,
        avgOrderValue,
        vipCount,
        tierCounts,
      },
    });
  } catch (error: any) {
    logger.error("Failed to fetch customers", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({
        customers: [],
        stats: { totalCustomers: 0, totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, vipCount: 0, tierCounts: { new: 0, bronze: 0, silver: 0, gold: 0 } },
        fallback: true,
      });
    }
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, authCtx) => {
  try {
    await ensureDb();
    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { organizationId, name, email, phone, city, address, notes, loyaltyTier } = body;
    const orgId = organizationId || authCtx.organizationId;

    if (!orgId || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: Ensure user can only create customers in their own org
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const customer = await withRetry(async () => {
      return db.customer.create({
      data: {
        organizationId: orgId,
        name,
        email: email || null,
        phone: phone || null,
        city: city || null,
        address: address || null,
        notes: notes || null,
        loyaltyTier: loyaltyTier || "new",
      },
    });
    }, 2, 500);

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: any) {
    logger.error("Failed to create customer", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
});
