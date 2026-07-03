// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/reports/products?orgId=xxx
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Reports Products] GET request", { userId: authCtx.userId });
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;

    const __isPlatformAdmin = isPlatformRole(authCtx.role);
    if (!__isPlatformAdmin && orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch all products for the org
    const products = await withRetry(async () => {
      return await db.product.findMany({
      where: { organizationId: orgId },
      include: {
        orderItems: true,
      },
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    // Total products
    const totalProducts = products.length;

    // Total sold
    const totalSold = products.reduce((sum, p) => {
      return sum + p.orderItems.reduce((s, item) => s + item.quantity, 0);
    }, 0);

    // Avg margin
    const productsWithCost = products.filter((p) => p.costPrice !== null && p.costPrice! > 0);
    const avgMargin = productsWithCost.length > 0
      ? productsWithCost.reduce((sum, p) => {
          const margin = ((p.price - (p.costPrice || 0)) / p.price) * 100;
          return sum + margin;
        }, 0) / productsWithCost.length
      : 0;

    // Out of stock count
    const outOfStock = products.filter((p) => p.stock <= 0).length;

    // Low stock (<= 5)
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);

    // Best sellers by quantity sold
    const bestSellers = [...products]
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Uncategorized",
        price: p.price,
        quantitySold: p.orderItems.reduce((s, item) => s + item.quantity, 0),
        revenue: p.orderItems.reduce((s, item) => s + item.total, 0),
      }))
      .filter((p) => p.quantitySold > 0)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20);

    // Categories breakdown
    const categories = products.reduce<Record<string, { count: number; sold: number; revenue: number }>>((acc, p) => {
      const cat = p.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = { count: 0, sold: 0, revenue: 0 };
      acc[cat].count += 1;
      acc[cat].sold += p.orderItems.reduce((s, item) => s + item.quantity, 0);
      acc[cat].revenue += p.orderItems.reduce((s, item) => s + item.total, 0);
      return acc;
    }, {});

    // Get org currency
    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id: orgId } })
    }, 2, 500);
    const currency = getCurrencyForCountry(org?.country || "PK");

    return NextResponse.json({
      stats: {
        totalProducts,
        totalSold,
        avgMargin: Math.round(avgMargin * 10) / 10,
        outOfStock,
        lowStockCount: lowStock.length,
      },
      bestSellers,
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Uncategorized",
        price: p.price,
        stock: p.stock,
      })),
      categories,
      currency: { code: currency.code, symbol: currency.symbol },
    });
  } catch (error: unknown) {
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch product report" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });
