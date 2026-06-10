import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";

export const GET = withAuth(async (req, ctx) => {
  try {
    const orgId = ctx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Fetch all organization data in parallel
    const [products, customers, orders, expenses, tasks, coupons] =
      await Promise.all([
        db.product.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, sku: true, description: true,
            price: true, costPrice: true, stock: true, category: true,
            status: true, imageUrl: true, createdAt: true, updatedAt: true,
          },
        }),
        db.customer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
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
          include: {
            items: {
              select: {
                productName: true, quantity: true, price: true, total: true,
              },
            },
          },
          select: {
            id: true, orderNumber: true, customerId: true, status: true,
            subtotal: true, discount: true, total: true, channel: true,
            courier: true, trackingNumber: true, notes: true, priority: true,
            createdAt: true, updatedAt: true,
          },
        }),
        db.expense.findMany({
          where: { organizationId: orgId },
          orderBy: { date: "desc" },
          select: {
            id: true, title: true, amount: true, category: true,
            date: true, description: true, createdAt: true, updatedAt: true,
          },
        }),
        db.teamTask.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, assignedTo: true, title: true, description: true,
            status: true, priority: true, dueDate: true,
            createdAt: true, updatedAt: true,
          },
        }),
        db.coupon.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, code: true, type: true, value: true,
            minOrder: true, usageLimit: true, usageCount: true,
            expiresAt: true, isActive: true, createdAt: true, updatedAt: true,
          },
        }),
      ]);

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
  } catch (error: any) {
    console.error("[Export] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to export data. Please try again." },
      { status: 500 },
    );
  }
});
