import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// Activity Feed API
// Returns recent activities from orders, products, team, payments
// Each query is individually wrapped so a missing column/table won't crash the whole feed
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: "order" | "product" | "customer" | "team" | "payment" | "coupon";
  action: string;
  description: string;
  details: string;
  icon: string;
  timestamp: string;
  meta?: Record<string, any>;
}

/** Safely run a DB query — returns null on any error instead of throwing */
async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err: unknown) {
    logger.warn("[ActivityFeed] Query failed (non-fatal):", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Activity Feed] GET request", { userId: authCtx.userId });
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId!;
    const limit = parseInt(searchParams.get("limit") || "25");

    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const timeLimit = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    // ── Fetch each source independently — one failure won't crash others ──
    const [recentOrders, recentProducts, recentCustomers, recentInvitations, recentPayments] = await Promise.all([
      safeQuery(() => db.order.findMany({
        where: { organizationId: orgId, createdAt: { gte: timeLimit } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true, orderNumber: true, status: true, total: true,
          createdAt: true, channel: true,
          customer: { select: { name: true } },
        },
      })),
      safeQuery(() => db.product.findMany({
        where: { organizationId: orgId, createdAt: { gte: timeLimit } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, name: true, price: true, stock: true, status: true,
          createdAt: true, updatedAt: true,
        },
      })),
      safeQuery(() => db.customer.findMany({
        where: { organizationId: orgId, createdAt: { gte: timeLimit } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, createdAt: true, totalSpent: true },
      })),
      safeQuery(() => db.teamInvitation.findMany({
        where: { organizationId: orgId, invitedAt: { gte: timeLimit } },
        orderBy: { invitedAt: "desc" },
        take: 5,
        select: {
          id: true, inviteeName: true, role: true, status: true,
          invitedAt: true, acceptedAt: true,
        },
      })),
      safeQuery(() => db.paymentProof.findMany({
        where: { organizationId: orgId, createdAt: { gte: timeLimit } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, planName: true, amount: true, status: true, createdAt: true },
      })),
    ]);

    // ── Build activity feed ──
    const activities: ActivityItem[] = [];

    // Orders
    if (recentOrders) {
      for (const order of recentOrders) {
        const customerName = order.customer?.name || "Walk-in Customer";
        activities.push({
          id: `order-${order.id}`,
          type: "order",
          action: "New order received",
          description: `Order ${order.orderNumber || order.id.slice(-6)} from ${customerName}`,
          details: `Rs. ${(order.total ?? 0).toLocaleString()} · ${order.channel || "online"} · ${order.status}`,
          icon: "ShoppingBag",
          timestamp: order.createdAt.toISOString(),
          meta: { orderId: order.id, orderNumber: order.orderNumber, status: order.status },
        });
      }
    }

    // Products
    if (recentProducts) {
      for (const product of recentProducts) {
        const isNew = product.createdAt.getTime() === product.updatedAt.getTime() ||
          (product.updatedAt.getTime() - product.createdAt.getTime()) < 2000;

        if (isNew) {
          activities.push({
            id: `product-${product.id}`,
            type: "product",
            action: "New product added",
            description: `${product.name} added to catalog`,
            details: `Rs. ${(product.price ?? 0).toLocaleString()} · Stock: ${product.stock}`,
            icon: "Package",
            timestamp: product.createdAt.toISOString(),
            meta: { productId: product.id },
          });
        } else {
          activities.push({
            id: `product-${product.id}`,
            type: "product",
            action: "Product updated",
            description: `${product.name} was updated`,
            details: `Stock: ${product.stock} · Status: ${product.status}`,
            icon: "Package",
            timestamp: product.updatedAt.toISOString(),
            meta: { productId: product.id },
          });
        }
      }
    }

    // Customers
    if (recentCustomers) {
      for (const customer of recentCustomers) {
        activities.push({
          id: `customer-${customer.id}`,
          type: "customer",
          action: "New customer joined",
          description: `${customer.name} started shopping`,
          details: Number(customer.totalSpent) > 0 ? `Total spent: Rs. ${Number(customer.totalSpent).toLocaleString()}` : "New customer",
          icon: "Users",
          timestamp: customer.createdAt.toISOString(),
          meta: { customerId: customer.id },
        });
      }
    }

    // Team invitations
    if (recentInvitations) {
      for (const invite of recentInvitations) {
        if (invite.status === "accepted") {
          activities.push({
            id: `team-${invite.id}`,
            type: "team",
            action: "Team member joined",
            description: `${invite.inviteeName || "New member"} joined as ${invite.role}`,
            details: "Accepted invitation",
            icon: "UserPlus",
            timestamp: (invite.acceptedAt || invite.invitedAt).toISOString(),
            meta: { role: invite.role },
          });
        } else if (invite.status === "pending") {
          activities.push({
            id: `team-${invite.id}`,
            type: "team",
            action: "Team invitation sent",
            description: `Invited ${invite.inviteeName || "Team member"} as ${invite.role}`,
            details: "Pending acceptance",
            icon: "UserPlus",
            timestamp: invite.invitedAt.toISOString(),
            meta: { role: invite.role },
          });
        }
      }
    }

    // Payments
    if (recentPayments) {
      for (const payment of recentPayments) {
        const statusLabel = payment.status === "approved" ? "approved" :
          payment.status === "rejected" ? "rejected" : "pending review";
        activities.push({
          id: `payment-${payment.id}`,
          type: "payment",
          action: `Payment ${statusLabel}`,
          description: `${payment.planName || "Subscription"} plan payment`,
          details: `Rs. ${(payment.amount ?? 0).toLocaleString()} · ${statusLabel}`,
          icon: payment.status === "approved" ? "CheckCircle" : "CreditCard",
          timestamp: payment.createdAt.toISOString(),
          meta: { plan: payment.planName, amount: payment.amount },
        });
      }
    }

    // ── Sort all activities by timestamp (most recent first) ──
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit results
    const limited = activities.slice(0, limit);

    return NextResponse.json({ activities: limited, total: activities.length });
  } catch (error: unknown) {
    logger.error("Activity feed error:", error);
    if (isDbUnavailable(error)) {
      return NextResponse.json({ activities: [], total: 0, fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch activity feed" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });
