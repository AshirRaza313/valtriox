import { NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Revenue vs Expenses (last 30 days, grouped by week)
    const orders = await withRetry(async () => {
      return await db.order.findMany({
      where: { organizationId: orgId, status: { not: "cancelled" }, createdAt: { gte: thirtyDaysAgo } },
      select: { total: true, createdAt: true, channel: true },
    })
    }, 2, 500);

    const expenses = await withRetry(async () => {
      return await db.expense.findMany({
      where: { organizationId: orgId, date: { gte: thirtyDaysAgo } },
      select: { amount: true, category: true, date: true },
    })
    }, 2, 500);

    // Weekly revenue
    const weeklyRevenue: Record<string, number> = {};
    const weeklyExpenses: Record<string, number> = {};
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const key = `Week ${4 - i}`;
      weeklyRevenue[key] = 0;
      weeklyExpenses[key] = 0;

      for (const o of orders) {
        if (o.createdAt >= weekStart && o.createdAt < new Date(weekStart.getTime() + 7 * 86400000)) {
          weeklyRevenue[key] += o.total;
        }
      }
      for (const e of expenses) {
        if (e.date >= weekStart && e.date < new Date(weekStart.getTime() + 7 * 86400000)) {
          weeklyExpenses[key] += e.amount;
        }
      }
    }

    const revenueVsExpenses = Object.entries(weeklyRevenue).map(([week, revenue]) => ({
      week,
      revenue: Math.round(revenue),
      expenses: Math.round(weeklyExpenses[week]),
    }));

    // Orders by channel
    const channelCounts: Record<string, number> = {};
    for (const o of orders) {
      channelCounts[o.channel] = (channelCounts[o.channel] || 0) + 1;
    }
    const ordersByChannel = Object.entries(channelCounts).map(([channel, count]) => ({
      channel: channel.charAt(0).toUpperCase() + channel.slice(1),
      count,
    }));

    // Order status breakdown
    const statusCounts = await withRetry(async () => {
      return await db.order.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    })
    }, 2, 500);
    const orderStatusBreakdown = statusCounts.map((s) => ({
      status: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      count: s._count,
    }));

    // Top selling products
    const topProducts = await withRetry(async () => {
      return await db.orderItem.groupBy({
      by: ["productName"],
      where: {
        order: { organizationId: orgId, status: { not: "cancelled" } },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    })
    }, 2, 500);

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    }
    const expenseCategoryData = Object.entries(expenseByCategory).map(([category, amount]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      amount: Math.round(amount),
    }));

    // Customer tier distribution
    const tierCounts = await withRetry(async () => {
      return await db.customer.groupBy({
      by: ["loyaltyTier"],
      where: { organizationId: orgId },
      _count: true,
    })
    }, 2, 500);
    const customerTierDistribution = tierCounts.map((t) => ({
      tier: t.loyaltyTier.charAt(0).toUpperCase() + t.loyaltyTier.slice(1),
      count: t._count,
    }));

    // Top customers by spend
    const topCustomers = await withRetry(async () => {
      return await db.customer.findMany({
      where: { organizationId: orgId },
      orderBy: { totalSpent: "desc" },
      take: 5,
      select: { name: true, totalSpent: true, orderCount: true },
    })
    }, 2, 500);

    // Monthly new customers (last 6 months)
    const monthlyNewCustomers: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = mStart.toLocaleDateString("en-US", { month: "short" });
      monthlyNewCustomers[key] = await withRetry(async () => {
        return db.customer.count({
          where: { organizationId: orgId, createdAt: { gte: mStart, lt: mEnd } },
        });
      }, 2, 500);
    }
    const newCustomersData = Object.entries(monthlyNewCustomers).map(([month, count]) => ({
      month,
      count,
    }));

    return NextResponse.json({
      revenueVsExpenses,
      ordersByChannel,
      orderStatusBreakdown,
      topProducts,
      expenseCategoryData,
      customerTierDistribution,
      topCustomers,
      newCustomersData,
      totalRevenue: orders.reduce((s, o) => s + o.total, 0),
      totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
      avgOrderValue: orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0,
    });
  } catch (error: any) {
    logger.error("Analytics error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({
        revenueVsExpenses: [
          { week: "Week 1", revenue: 0, expenses: 0 },
          { week: "Week 2", revenue: 0, expenses: 0 },
          { week: "Week 3", revenue: 0, expenses: 0 },
          { week: "Week 4", revenue: 0, expenses: 0 },
        ],
        ordersByChannel: [],
        orderStatusBreakdown: [],
        topProducts: [],
        expenseCategoryData: [],
        customerTierDistribution: [],
        topCustomers: [],
        newCustomersData: [],
        totalRevenue: 0,
        totalExpenses: 0,
        avgOrderValue: 0,
        fallback: true,
      });
    }
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
