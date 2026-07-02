import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry} from "@/lib/db";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/reports/sales?orgId=xxx&period=daily|weekly|monthly
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Reports Sales] GET request", { userId: authCtx.userId });
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;
    const period = req.nextUrl.searchParams.get("period") || "monthly";

    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Date range based on period
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Fetch orders for the period
    const orders = await withRetry(async () => {
      return await db.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: startDate },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    // Calculate stats
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const refundedOrders = orders.filter((o) => o.status === "cancelled" || o.status === "returns");
    const refunds = refundedOrders.reduce((sum, o) => sum + o.total, 0);

    // Order status breakdown
    const statusBreakdown = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    // Daily breakdown
    const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
    const dailyBreakdown: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = d.toISOString().split("T")[0];
      const dayOrders = orders.filter(
        (o) => o.createdAt.toISOString().split("T")[0] === dayStr
      );
      dailyBreakdown.push({
        date: dayStr,
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length,
      });
    }

    // Channel breakdown
    const channelBreakdown = orders.reduce<Record<string, { count: number; revenue: number }>>((acc, o) => {
      if (!acc[o.channel]) acc[o.channel] = { count: 0, revenue: 0 };
      acc[o.channel].count += 1;
      acc[o.channel].revenue += o.total;
      return acc;
    }, {});

    // Get org currency
    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id: orgId } })
    }, 2, 500);
    const currency = getCurrencyForCountry(org?.country || "PK");

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      stats: {
        totalRevenue,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        refunds,
        refundCount: refundedOrders.length,
      },
      statusBreakdown,
      dailyBreakdown,
      channelBreakdown,
      currency: { code: currency.code, symbol: currency.symbol },
    });
  } catch (error: unknown) {
    if (isDbUnavailable(error)) {
      return NextResponse.json({
        period: "monthly",
        stats: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, refunds: 0, refundCount: 0 },
        statusBreakdown: {},
        dailyBreakdown: [],
        channelBreakdown: {},
        currency: { code: "PKR", symbol: "Rs." },
        fallback: true,
      });
    }
    return NextResponse.json({ error: "Failed to fetch sales report" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });
