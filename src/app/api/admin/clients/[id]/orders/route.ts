import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, db, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Prisma } from "@prisma/client";

// GET /api/admin/clients/[id]/orders - Admin-only: paginated orders for an organization
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx, context) => {
  const { id } = await context.params;
  logger.info("[Admin Client Orders] GET request", { userId: authCtx.userId, clientId: id });
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status") || undefined;
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    // Validate sortBy to prevent injection
    const validSortFields: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      createdAt: { createdAt: sortDir as "asc" | "desc" },
      updatedAt: { updatedAt: sortDir as "asc" | "desc" },
      total: { total: sortDir as "asc" | "desc" },
      status: { status: sortDir as "asc" | "desc" },
      orderNumber: { orderNumber: sortDir as "asc" | "desc" },
    };
    const orderBy = validSortFields[sortBy] || { createdAt: "desc" as const };

    // Verify org exists
    const org = await withRetry(async () => {
      return await db.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    }, 2, 500);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Build where clause
    const where: Prisma.OrderWhereInput = { organizationId: id };
    if (status) {
      where.status = status;
    }

    // Run all queries in parallel
    const [orders, total, statusCounts, revenueData] = await Promise.all([
      // Paginated orders with customer info
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { name: true, email: true, phone: true } },
        },
      }),
      // Total count (without status filter for overall total)
      db.order.count({ where }),
      // Status distribution (across all orders for this org, not filtered by status)
      db.order.groupBy({
        by: ["status"],
        where: { organizationId: id },
        _count: { status: true },
      }),
      // Revenue summary (across all orders for this org)
      db.$queryRaw<
        { total: string; subtotal: string; discount: string }[]
      >`SELECT COALESCE(SUM(total), 0)::text as total, COALESCE(SUM(subtotal), 0)::text as subtotal, COALESCE(SUM(discount), 0)::text as discount FROM "Order" WHERE "organizationId" = ${id}`,
    ]);

    // Map orders to match original raw SQL shape
    const ordersMapped = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      organizationId: o.organizationId,
      customerId: o.customerId,
      status: o.status,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      channel: o.channel,
      courier: o.courier,
      trackingNumber: o.trackingNumber,
      notes: o.notes,
      priority: o.priority,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      customerName: o.customer?.name || null,
      customerEmail: o.customer?.email || null,
      customerPhone: o.customer?.phone || null,
    }));

    // Build status counts map
    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row._count.status;
    }

    const revenue = revenueData[0] || {};

    return NextResponse.json({
      organization: { id, name: org.name },
      orders: ordersMapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      statusCounts: statusMap,
      revenueSummary: {
        totalRevenue: parseFloat(revenue.total) || 0,
        totalSubtotal: parseFloat(revenue.subtotal) || 0,
        totalDiscount: parseFloat(revenue.discount) || 0,
      },
    });
  } catch (error: unknown) {
    logger.error("Admin client orders API error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch client orders", details: undefined }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
