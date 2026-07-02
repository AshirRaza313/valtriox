import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery, dbErrorResponse, isDbUnavailable } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// Daily Summary API
// Returns today's summary: orders, revenue, new customers, top products, low stock
// Includes comparison with yesterday's data
// ─────────────────────────────────────────────────────────────────────────────

export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Reports Daily Summary] GET request", { userId: authCtx.userId });
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId!;

    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // ── Date Ranges ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // ── Today's Stats ──
    const [todayOrdersRes, todayRevenueRes, newCustomersRes, topProductsRes, lowStockProductsRes] = await Promise.all([
      safeDbQuery(() =>
        db.order.count({
          where: { organizationId: orgId, createdAt: { gte: todayStart } },
        })
      ),
      safeDbQuery(() =>
        db.order.aggregate({
          where: { organizationId: orgId, createdAt: { gte: todayStart } },
          _sum: { total: true },
        })
      ),
      safeDbQuery(() =>
        db.customer.count({
          where: { organizationId: orgId, createdAt: { gte: todayStart } },
        })
      ),
      safeDbQuery(() =>
        db.orderItem.groupBy({
          by: ["productId", "productName"],
          where: {
            order: { organizationId: orgId, createdAt: { gte: todayStart } },
          },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        })
      ),
      safeDbQuery(() =>
        db.product.findMany({
          where: {
            organizationId: orgId,
            stock: { lte: 10 },
            status: "active",
          },
          orderBy: { stock: "asc" },
          take: 5,
          select: { id: true, name: true, stock: true, price: true },
        })
      ),
    ]);

    // Return first error if any query failed
    for (const res of [todayOrdersRes, todayRevenueRes, newCustomersRes, topProductsRes, lowStockProductsRes]) {
      if (res.error) return res.errorResponse;
    }

    const todayOrders = todayOrdersRes.data!;
    const todayRevenue = todayRevenueRes.data!;
    const newCustomers = newCustomersRes.data!;
    const topProducts = topProductsRes.data!;
    const lowStockProducts = lowStockProductsRes.data!;

    // ── Yesterday's Stats (for comparison) ──
    const [yesterdayOrdersRes, yesterdayRevenueRes, yesterdayNewCustomersRes] = await Promise.all([
      safeDbQuery(() =>
        db.order.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: yesterdayStart, lt: todayStart },
          },
        })
      ),
      safeDbQuery(() =>
        db.order.aggregate({
          where: {
            organizationId: orgId,
            createdAt: { gte: yesterdayStart, lt: todayStart },
          },
          _sum: { total: true },
        })
      ),
      safeDbQuery(() =>
        db.customer.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: yesterdayStart, lt: todayStart },
          },
        })
      ),
    ]);

    for (const res of [yesterdayOrdersRes, yesterdayRevenueRes, yesterdayNewCustomersRes]) {
      if (res.error) return res.errorResponse;
    }

    const yesterdayOrders = yesterdayOrdersRes.data!;
    const yesterdayRevenue = yesterdayRevenueRes.data!;
    const yesterdayNewCustomers = yesterdayNewCustomersRes.data!;

    // ── Pending & Active Orders ──
    const [pendingOrdersRes, activeOrdersRes] = await Promise.all([
      safeDbQuery(() =>
        db.order.count({
          where: { organizationId: orgId, status: "pending" },
        })
      ),
      safeDbQuery(() =>
        db.order.count({
          where: {
            organizationId: orgId,
            status: { in: ["pending", "confirmed", "packed", "dispatched"] },
          },
        })
      ),
    ]);

    for (const res of [pendingOrdersRes, activeOrdersRes]) {
      if (res.error) return res.errorResponse;
    }

    const pendingOrders = pendingOrdersRes.data!;
    const activeOrders = activeOrdersRes.data!;

    // Calculate percentage changes
    const orderChange = yesterdayOrders > 0
      ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100)
      : todayOrders > 0 ? 100 : 0;

    const todayRev = todayRevenue._sum.total || 0;
    const yesterdayRev = yesterdayRevenue._sum.total || 0;
    const revenueChange = yesterdayRev > 0
      ? Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100)
      : todayRev > 0 ? 100 : 0;

    const customerChange = yesterdayNewCustomers > 0
      ? Math.round(((newCustomers - yesterdayNewCustomers) / yesterdayNewCustomers) * 100)
      : newCustomers > 0 ? 100 : 0;

    const formatCurrency = (val: number) => `Rs. ${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    return NextResponse.json({
      date: todayStart.toISOString().split("T")[0],
      today: {
        orders: todayOrders,
        revenue: todayRev,
        revenueFormatted: formatCurrency(todayRev),
        newCustomers,
        pendingOrders,
        activeOrders,
      },
      yesterday: {
        orders: yesterdayOrders,
        revenue: yesterdayRev,
        revenueFormatted: formatCurrency(yesterdayRev),
        newCustomers: yesterdayNewCustomers,
      },
      changes: {
        orders: orderChange,
        revenue: revenueChange,
        newCustomers: customerChange,
      },
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        quantitySold: p._sum.quantity || 0,
        revenue: p._sum.total || 0,
      })),
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        price: p.price,
      })),
    });
  } catch (error: unknown) {
    logger.error("Daily summary error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch daily summary" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });
