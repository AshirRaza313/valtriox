import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { validateBody, validateQuery, createCustomerSchema, paginationQuerySchema } from "@/lib/validations";
import logger from "@/lib/logger";
import { z } from "zod";
import { withRateLimit } from "@/lib/rate-limit";

// Phase 3: Query validation schema
const customersQuerySchema = paginationQuerySchema.extend({
  orgId: z.string().min(1).optional(),
});

export const GET = withAuth(async (req, authCtx) => {
  try {
    const queryResult = validateQuery(req, customersQuerySchema);
    if (!queryResult.success) return queryResult.response;
    const { page, limit, orgId: queryOrgId } = queryResult.data;

    const orgId = queryOrgId || authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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

    // Aggregate stats
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
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      stats: { totalCustomers: totalCount, totalRevenue: rev, totalOrders: ord, avgOrderValue, vipCount, tierCounts },
    });
  } catch (error: unknown) {
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

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    // Phase 3: Zod validation
    const bodyResult = await validateBody(req, createCustomerSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { name, email, phone, address, notes } = bodyResult.data;

    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const customer = await withRetry(async () => {
      return db.customer.create({
        data: {
          organizationId: orgId,
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          notes: notes || null,
          loyaltyTier: "new",
        },
      });
    }, 2, 500);

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: unknown) {
    logger.error("Failed to create customer", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}, { maxRequests: 30, windowSeconds: 60 });
