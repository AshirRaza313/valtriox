import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { getPlanLimits, getUsagePercent, getLimitLabel, PLAN_NAMES } from "@/lib/plan-limits";
import { estimateStorageUsage } from "@/lib/storage-tracker";

// ============================================================================
// Usage Stats API Route
// ============================================================================
// Returns the organization's current usage across all plan-limited resources,
// alongside the plan limits and percentage used for each category.
//
// GET /api/admin/usage-stats?organizationId=...
// ============================================================================

export const GET = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId") || authCtx.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // ── Fetch the organization to get the current plan ──
    const org = await withRetry(async () => {
      return await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        plan: true,
        usageLastResetAt: true,
      },
    })
    }, 2, 500);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const plan = org.plan || "starter";
    const limits = getPlanLimits(plan);

    // ── Check if monthly counters need resetting ──
    const now = new Date();
    const lastReset = org.usageLastResetAt;
    let needsReset = false;

    if (lastReset) {
      const nextReset = new Date(lastReset);
      nextReset.setMonth(nextReset.getMonth() + 1);
      if (now >= nextReset) {
        needsReset = true;
      }
    } else {
      needsReset = true;
    }

    if (needsReset) {
      await withRetry(async () => {
        return await db.organization.update({
        where: { id: organizationId },
        data: {
          usageOrdersCount: 0,
          usageLastResetAt: now,
        },
      })
      }, 2, 500);
      logger.info(`[Usage Stats] Monthly counters reset for org ${organizationId}`);
    }

    // ── Fetch actual usage counts ──
    const [
      ordersCount,
      productsCount,
      customersCount,
      expensesCount,
      tasksCount,
      teamMembersCount,
      couponsCount,
    ] = await Promise.all([
      db.order.count({ where: { organizationId } }),
      db.product.count({ where: { organizationId } }),
      db.customer.count({ where: { organizationId } }),
      db.expense.count({ where: { organizationId } }),
      db.teamTask.count({ where: { organizationId } }),
      db.organizationMember.count({ where: { organizationId } }),
      db.coupon.count({ where: { organizationId } }),
    ]);

    // ── Build usage object ──
    const usage = {
      teamMembers: teamMembersCount,
      orders: ordersCount,
      products: productsCount,
      customers: customersCount,
      expenses: expensesCount,
      tasks: tasksCount,
      coupons: couponsCount,
    };

    // ── Build per-category breakdown with limits and percentages ──
    const categories = [
      { key: "teamMembers", label: "Team Members", usage: teamMembersCount, limit: limits.teamMembers },
      { key: "orders", label: "Orders", usage: ordersCount, limit: limits.ordersPerMonth },
      { key: "products", label: "Products", usage: productsCount, limit: limits.products },
      { key: "customers", label: "Customers", usage: customersCount, limit: limits.customers },
      { key: "expenses", label: "Expenses", usage: expensesCount, limit: -1 }, // no limit
      { key: "tasks", label: "Tasks", usage: tasksCount, limit: limits.tasks },
      { key: "coupons", label: "Coupons", usage: couponsCount, limit: limits.coupons },
    ];

    const breakdown = categories.map((cat) => ({
      key: cat.key,
      label: cat.label,
      usage: cat.usage,
      limit: cat.limit,
      percent: getUsagePercent(cat.usage, cat.limit),
      label: getLimitLabel(cat.usage, cat.limit),
      isUnlimited: cat.limit === -1,
      atLimit: cat.limit !== -1 && cat.usage >= cat.limit,
    }));

    // ── Storage usage (estimated via storage-tracker) ──
    let storageUsedMb = 0;
    try {
      storageUsedMb = await estimateStorageUsage(organizationId);
    } catch (err: any) {
      logger.warn("[Usage Stats] Storage estimate failed:", err?.message || err);
      storageUsedMb = 0;
    }

    // ── Feature flags (boolean limits) ──
    const features = {
      sla: limits.sla,
      apiAccess: limits.apiAccess,
      customBranding: limits.customBranding,
      whiteLabel: limits.whiteLabel,
      supportLevel: limits.supportLevel,
    };

    return NextResponse.json({
      organizationId,
      organizationName: org.name,
      plan,
      planDisplayName: PLAN_NAMES[plan] || plan,
      usage,
      limits: {
        teamMembers: limits.teamMembers,
        ordersPerMonth: limits.ordersPerMonth,
        products: limits.products,
        customers: limits.customers,
        coupons: limits.coupons,
        tasks: limits.tasks,
        storageGb: limits.storageGb,
        storageUsedMb: Math.round(storageUsedMb * 100) / 100,
        emailsPerMonth: limits.emailsPerMonth,
        campaigns: limits.campaigns,
      },
      features,
      breakdown,
      storage: {
        usedMb: Math.round(storageUsedMb * 100) / 100,
        limitGb: limits.storageGb === -1 ? -1 : limits.storageGb,
        limitMb: limits.storageGb === -1 ? -1 : limits.storageGb * 1024,
        percent: getUsagePercent(storageUsedMb, limits.storageGb === -1 ? -1 : limits.storageGb * 1024),
        label: getLimitLabel(Math.round(storageUsedMb), limits.storageGb === -1 ? -1 : limits.storageGb),
        isUnlimited: limits.storageGb === -1,
      },
      lastReset: org.usageLastResetAt,
    });
  } catch (error: any) {
    logger.error("[Usage Stats] Error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}, { requireOrg: true });
