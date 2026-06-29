import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

// Phase 4: Cap export queries to prevent OOM on large datasets
const EXPORT_ROW_LIMIT = 5000;

export const GET = withAuth(async (req, ctx) => {
  try {
    const orgId = ctx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Fetch organization data in parallel with row caps
    const [products, customers, orders, expenses, tasks, coupons] =
      await Promise.all([
        db.product.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_ROW_LIMIT,
          select: {
            id: true, name: true, sku: true, description: true,
            price: true, costPrice: true, stock: true, category: true,
            status: true, imageUrl: true, createdAt: true, updatedAt: true,
          },
        }),
        db.customer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_ROW_LIMIT,
          select: {
            id: true, name: true, email: true, phone: true,
            city: true, address: true, loyaltyTier: true,
            totalSpent: true, orderCount: true, notes: true,
            createdAt: true, updatedAt: true,
          },
        }),
        db.order.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_ROW_LIMIT,
          include: {
            items: {
              select: {
                productName: true, quantity: true, price: true, total: true,
              },
            },
          },
        }),
        db.expense.findMany({
          where: { organizationId: orgId },
          orderBy: { date: "desc" },
          take: EXPORT_ROW_LIMIT,
          select: {
            id: true, title: true, amount: true, category: true,
            date: true, description: true, createdAt: true, updatedAt: true,
          },
        }),
        db.teamTask.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_ROW_LIMIT,
          select: {
            id: true, assignedTo: true, title: true, description: true,
            status: true, priority: true, dueDate: true,
            createdAt: true, updatedAt: true,
          },
        }),
        db.coupon.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_ROW_LIMIT,
          select: {
            id: true, code: true, type: true, value: true,
            minOrder: true, usageLimit: true, usageCount: true,
            expiresAt: true, isActive: true, createdAt: true, updatedAt: true,
          },
        }),
      ]);

    // Check if any collection was truncated
    const truncated = [
      products.length >= EXPORT_ROW_LIMIT ? "products" : null,
      customers.length >= EXPORT_ROW_LIMIT ? "customers" : null,
      orders.length >= EXPORT_ROW_LIMIT ? "orders" : null,
      expenses.length >= EXPORT_ROW_LIMIT ? "expenses" : null,
      tasks.length >= EXPORT_ROW_LIMIT ? "tasks" : null,
      coupons.length >= EXPORT_ROW_LIMIT ? "coupons" : null,
    ].filter(Boolean);

    const exportData = {
      exportedAt: new Date().toISOString(),
      organizationId: orgId,
      data: {
        products: products.map((p) => ({
          ...p,
          price: Number(p.price),
          costPrice: p.costPrice ? Number(p.costPrice) : null,
        })),
        customers: customers.map((c) => ({
          ...c,
          totalSpent: Number(c.totalSpent),
        })),
        orders: orders.map((o) => ({
          ...o,
          subtotal: Number(o.subtotal),
          discount: Number(o.discount),
          total: Number(o.total),
          items: o.items.map((i) => ({
            ...i,
            price: Number(i.price),
            total: Number(i.total),
          })),
        })),
        expenses: expenses.map((e) => ({
          ...e,
          amount: Number(e.amount),
        })),
        tasks,
        coupons: coupons.map((c) => ({
          ...c,
          value: Number(c.value),
          minOrder: c.minOrder ? Number(c.minOrder) : null,
        })),
      },
      summary: {
        totalProducts: products.length,
        totalCustomers: customers.length,
        totalOrders: orders.length,
        totalExpenses: expenses.length,
        totalTasks: tasks.length,
        totalCoupons: coupons.length,
        truncated: truncated.length > 0 ? `Some collections reached the ${EXPORT_ROW_LIMIT} row limit: ${truncated.join(", ")}` : false,
      },
    };

    const filename = `valtriox-export-${orgId.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Export] Error:", msg);
    return NextResponse.json(
      { error: "Failed to export data. Please try again." },
      { status: 500 },
    );
  }
});
