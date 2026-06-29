import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { validateBody, validateQuery, createOrderSchema, paginationQuerySchema } from "@/lib/validations";
import logger from "@/lib/logger";
import { z } from "zod";

// Phase 3: Query validation schema for GET /orders
const ordersQuerySchema = paginationQuerySchema.extend({
  orgId: z.string().min(1).optional(),
  status: z.string().max(50).optional(),
});

export const GET = withAuth(async (req, authCtx) => {
  try {
    // Phase 3: Validate query parameters with Zod
    const queryResult = validateQuery(req, ordersQuerySchema);
    if (!queryResult.success) return queryResult.response;
    const { page, limit, search, sortBy, sortDir, orgId: queryOrgId, status } = queryResult.data;

    const orgId = queryOrgId || authCtx.organizationId;

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    // Validate sort field
    const validSortFields = ["createdAt", "total", "status", "orderNumber", "subtotal"];
    const orderField = validSortFields.includes(sortBy || "") ? (sortBy as string) : "createdAt";
    const orderDirection = sortDir === "asc" ? "asc" : "desc";

    const { orders, totalCount, total, pending, confirmed, dispatched, delivered } = await withRetry(async () => {
      const [ordersResult, countResult] = await Promise.all([
        db.order.findMany({
          where,
          include: {
            customer: { select: { name: true, email: true, phone: true } },
            items: { select: { productName: true, quantity: true, price: true, total: true } },
          },
          orderBy: { [orderField]: orderDirection },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.order.count({ where }),
      ]);

      // Stats (always for the org, not filtered by search/pagination)
      const [totalR, pendingR, confirmedR, dispatchedR, deliveredR] = await Promise.all([
        db.order.count({ where: { organizationId: orgId } }),
        db.order.count({ where: { organizationId: orgId, status: "pending" } }),
        db.order.count({ where: { organizationId: orgId, status: "confirmed" } }),
        db.order.count({ where: { organizationId: orgId, status: { in: ["packed", "dispatched"] } } }),
        db.order.count({ where: { organizationId: orgId, status: "delivered" } }),
      ]);

      return { orders: ordersResult, totalCount: countResult, total: totalR, pending: pendingR, confirmed: confirmedR, dispatched: dispatchedR, delivered: deliveredR };
    }, 2, 500);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: { total, pending, confirmed, dispatched, delivered },
    });
  } catch (error: unknown) {
    logger.error("Fetch orders error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({
        orders: [],
        pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 },
        stats: { total: 0, pending: 0, confirmed: 0, dispatched: 0, delivered: 0 },
        fallback: true,
      });
    }
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, authCtx) => {
  try {
    // Phase 3: Zod validation replaces raw req.json() + manual checks
    const bodyResult = await validateBody(req, createOrderSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { customerId, channel, notes, items } = bodyResult.data;
    const organizationId = authCtx.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    // ── Order limit enforcement (lifetime) ──
    // Platform roles (platform_owner, platform_admin, owner) bypass order limits.
    const { order, orderLimitResult } = await withRetry(async () => {
      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true, paymentRejectionCount: true, isBanned: true },
      });
      if (!org) return { _error: "Organization not found", _status: 404 };
      if (org.isBanned) return { _error: "Organization is suspended", _status: 403 };

      // Skip order limit check for platform admin roles and admin email
      const isPlatformAdmin = authCtx.role === "platform_owner" || authCtx.role === "platform_admin" || authCtx.role === "owner";
      const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
      const isAdminByEmail = adminEmail && authCtx.email?.toLowerCase() === adminEmail;

      if (!isPlatformAdmin && !isAdminByEmail && org.plan === "starter") {
        const plan = await db.subscriptionPlan.findFirst({ where: { name: "starter" } });
        if (plan && plan.orderLimit > 0) {
          const currentOrderCount = await db.order.count({ where: { organizationId } });
          if (currentOrderCount >= plan.orderLimit) {
            return {
              _error: "Order limit reached",
              _status: 403,
              _extra: {
                message: `Your Starter plan allows ${plan.orderLimit} orders/month. You have used ${currentOrderCount} orders this month. Please upgrade to Professional plan for unlimited orders.`,
                code: "ORDER_LIMIT_REACHED",
                currentCount: currentOrderCount,
                limit: plan.orderLimit,
              },
            };
          }
        }
      }

      // FIX 2.1: Wrap order number generation + order create + stock update in a transaction
      // FIX 6 (FULL): Atomic order counter — guarantees unique order numbers under concurrency
      const createdOrder = await db.$transaction(async (tx) => {
        const updatedOrg = await tx.organization.update({
          where: { id: organizationId },
          data: { orderCounter: { increment: 1 } },
          select: { orderCounter: true },
        });
        const counter = updatedOrg.orderCounter;

        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const txOrder = await tx.order.create({
          data: {
            orderNumber: `VTX-${String(counter).padStart(4, "0")}`,
            organizationId,
            customerId: customerId || null,
            channel: channel || "manual",
            notes: notes || null,
            subtotal,
            total: subtotal,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
              })),
            },
          },
          include: { customer: { select: { name: true } }, items: true },
        });

        // Update customer stats (verify customer belongs to same org)
        if (customerId) {
          const customerExists = await tx.customer.findFirst({
            where: { id: customerId, organizationId },
          });
          if (customerExists) {
            await tx.customer.update({
              where: { id: customerId },
              data: { totalSpent: { increment: subtotal }, orderCount: { increment: 1 } },
            });
          }
        }

        // Update product stock — Phase 4: Batch ownership check, then individual updates
        // Reduces from 2N queries to N+1 (1 bulk check + N updates)
        const productIds = items.map(i => i.productId);
        const orgProducts = await tx.product.findMany({
          where: { id: { in: productIds }, organizationId },
          select: { id: true },
        });
        const validProductIds = new Set(orgProducts.map(p => p.id));

        for (const item of items) {
          if (validProductIds.has(item.productId)) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }

        return txOrder;
      });

      return { order: createdOrder };
    }, 2, 500);

    // Type-safe error check (Phase 3: eliminated `as any`)
    if (orderLimitResult && typeof orderLimitResult === "object" && "_error" in orderLimitResult) {
      const err = orderLimitResult as { _error: string; _status: number; _extra?: Record<string, unknown> };
      return NextResponse.json({ error: err._error, ...err._extra }, { status: err._status });
    }

    // ── Auto-generate 4 tasks for the new order ──
    const orderNum = order.orderNumber;
    const autoTasks = [
      { title: `Confirm order ${orderNum} with customer`, assignedTo: "sales_manager", priority: "critical" },
      { title: `Send WhatsApp confirmation for ${orderNum}`, assignedTo: "support_agent", priority: "high" },
      { title: `Pack order ${orderNum}`, assignedTo: "warehouse_manager", priority: "medium" },
      { title: `Verify stock for order ${orderNum}`, assignedTo: "inventory_clerk", priority: "high" },
    ];

    try {
      await Promise.all(
        autoTasks.map((t) =>
          db.teamTask.create({
            data: {
              organizationId,
              title: t.title,
              assignedTo: t.assignedTo,
              priority: t.priority,
              status: "todo",
              description: `Auto-generated task for order ${orderNum}`,
            },
          })
        )
      );
    } catch (taskErr: unknown) {
      // Log task creation failure but don't fail the order creation
      const msg = taskErr instanceof Error ? taskErr.message : String(taskErr);
      logger.warn("Auto-task creation failed (non-blocking)", msg, { orderNumber: orderNum });
    }

    return NextResponse.json({ order, autoTasksCreated: true }, { status: 201 });
  } catch (error: unknown) {
    logger.error("Create order error", error, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
});
