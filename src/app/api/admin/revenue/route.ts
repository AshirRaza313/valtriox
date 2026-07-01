import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// Fixed Monthly Platform Cost (Vercel Pro, Supabase Pro, Resend Pro, Calendly, WA API, Sentry, Cloudflare)
const FIXED_MONTHLY_COST = 48440;

// GET /api/admin/revenue?period=month&year=2026
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Revenue] GET request", { userId: authCtx.userId });
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "year"; // month | year | all
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // ── Date boundaries ──
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYearStart = new Date(year, 0, 1);
    const currentYearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const result = await withRetry(async () => {
    // ── 1. Invoice-based revenue (approved/paid invoices) ──
    const invoiceWhere: any = { status: { in: ["paid", "approved"] } };

    const allPaidInvoices = await db.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        amount: true,
        status: true,
        issuedAt: true,
        paidAt: true,
        type: true,
        organizationId: true,
        planName: true,
        orgName: true,
      },
    });

    const paidThisMonth = allPaidInvoices
      .filter((inv) => {
        const d = inv.paidAt || inv.issuedAt;
        return d && d >= currentMonthStart && d <= now;
      })
      .reduce((s, inv) => s + Number(inv.amount), 0);

    const paidThisYear = allPaidInvoices
      .filter((inv) => {
        const d = inv.paidAt || inv.issuedAt;
        return d && d.getFullYear() === year;
      })
      .reduce((s, inv) => s + Number(inv.amount), 0);

    const totalRevenue = allPaidInvoices.reduce((s, inv) => s + Number(inv.amount), 0);

    // ── 2. Monthly Recurring Revenue (active subscriptions) ──
    const activeSubscriptions = await db.subscription.findMany({
      where: { status: "active" },
      include: {
        plan: { select: { name: true, price: true, annualPrice: true } },
        organization: {
          select: { id: true, name: true, email: true, plan: true, createdAt: true },
        },
      },
    });

    const monthlyRecurring = activeSubscriptions.reduce((sum, sub) => {
      const annualPrice = Number(sub.plan.annualPrice ?? 0);
      const planPrice = Number(sub.plan.price ?? 0);
      const price = sub.billingCycle === "annually" && annualPrice > 0
        ? annualPrice / 12
        : planPrice;
      return sum + price;
    }, 0);

    // ── 3. Pending Payments ──
    const pendingPaymentsCount = await db.paymentProof.count({
      where: { status: "pending" },
    });

    const pendingPaymentsAmount = await db.paymentProof.aggregate({
      where: { status: "pending" },
      _sum: { amount: true },
    });

    const pendingPayments = Number(pendingPaymentsAmount._sum.amount || 0);

    // ── 4. Average Order Value ──
    const totalOrders = await db.order.count();
    const totalOrderRevenue = await db.order.aggregate({
      _sum: { total: true },
    });

    const averageOrderValue = totalOrders > 0
      ? Number(totalOrderRevenue._sum.total || 0) / totalOrders
      : 0;

    // ── 5. Proposal Conversion Rate ──
    const totalProposals = await db.proposal.count();
    const acceptedProposals = await db.proposal.count({
      where: { status: "accepted" },
    });

    const proposalConversionRate = totalProposals > 0
      ? (acceptedProposals / totalProposals) * 100
      : 0;

    // ── 6. Active Subscriptions Count ──
    const activeSubscriptionsCount = activeSubscriptions.length;

    // ── 7. Revenue by Month (past 12 months) ──
    const revenueByMonthData: { month: string; revenue: number; expenses: number; profit: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const monthRevenue = allPaidInvoices
        .filter((inv) => {
          const invDate = inv.paidAt || inv.issuedAt;
          return invDate && invDate >= d && invDate <= monthEnd;
        })
        .reduce((s, inv) => s + Number(inv.amount), 0);

      // Expenses for this month
      const monthExpenses = await db.expense.aggregate({
        where: {
          date: { gte: d, lte: monthEnd },
        },
        _sum: { amount: true },
      });

      const expenses = Number(monthExpenses._sum.amount || 0);
      const totalMonthCost = expenses + FIXED_MONTHLY_COST;

      revenueByMonthData.push({
        month: monthLabel,
        revenue: Math.round(monthRevenue),
        expenses: Math.round(totalMonthCost),
        profit: Math.round(monthRevenue - totalMonthCost),
      });
    }

    // ── 8. Revenue by Service / Proposal Type ──
    const proposalsGrouped = await db.proposal.groupBy({
      by: ["type"],
      where: { status: "accepted" },
      _sum: { totalCost: true },
      _count: { id: true },
      orderBy: { _sum: { totalCost: "desc" } },
    });

    const serviceTypeLabels: Record<string, string> = {
      brand_management: "Brand Management",
      digital_marketing: "Digital Marketing",
      tech_integration: "Tech Integration",
      e_commerce: "E-Commerce",
      enterprise: "Enterprise",
      monthly_retainer: "Monthly Retainer",
    };

    const revenueByService = proposalsGrouped
      .filter((p) => p._sum.totalCost && Number(p._sum.totalCost) > 0)
      .map((p) => ({
        service: serviceTypeLabels[p.type] || p.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        revenue: Math.round(Number(p._sum.totalCost || 0)),
        count: p._count.id,
      }));

    // Also include subscription revenue by plan as a "service"
    const subsByPlan = await db.subscription.groupBy({
      by: ["planId"],
      where: { status: "active" },
      _count: { id: true },
    });

    for (const subGroup of subsByPlan) {
      const plan = await db.subscriptionPlan.findUnique({
        where: { id: subGroup.planId },
        select: { name: true, price: true },
      });
      if (plan) {
        const existingIdx = revenueByService.findIndex((r) => r.service === `Subscription: ${plan.name}`);
        const rev = Math.round(Number(plan.price) * subGroup._count.id);
        if (existingIdx >= 0) {
          revenueByService[existingIdx].revenue += rev;
          revenueByService[existingIdx].count += subGroup._count.id;
        } else {
          revenueByService.push({
            service: `Subscription: ${plan.name}`,
            revenue: rev,
            count: subGroup._count.id,
          });
        }
      }
    }

    // Sort by revenue desc
    revenueByService.sort((a, b) => b.revenue - a.revenue);

    // ── 9. Top Clients (by subscription revenue) ──
    const topClients = await Promise.all(
      activeSubscriptions.map(async (sub) => {
        // Get total payments for this org
        const orgPayments = await db.paymentProof.findMany({
          where: { organizationId: sub.organization.id, status: "approved" },
          select: { amount: true, createdAt: true, paymentMethod: true },
        });

        const totalPaid = orgPayments.reduce((s, p) => s + Number(p.amount), 0);
        const orderCount = await db.order.count({
          where: { organizationId: sub.organization.id },
        });

        return {
          name: sub.organization.name,
          revenue: Math.round(totalPaid + (sub.billingCycle === "annually" && Number(sub.plan.annualPrice) > 0 ? Number(sub.plan.annualPrice) / 12 : Number(sub.plan.price))),
          orders: orderCount,
          plan: sub.plan.name,
        };
      })
    );

    topClients.sort((a, b) => b.revenue - a.revenue);

    // ── 10. Recent Payments ──
    const recentPaymentProofs = await db.paymentProof.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { name: true } },
      },
    });

    const recentPayments = recentPaymentProofs.map((p) => ({
      id: p.id,
      clientName: p.organization?.name || "Unknown",
      amount: Number(p.amount),
      method: p.paymentMethod === "paypro" ? "PayPro" : p.paymentMethod === "bank_transfer" ? "Bank Transfer" : p.paymentMethod,
      status: p.status,
      date: p.createdAt.toISOString(),
    }));

    // ── 11. Expenses by Category ──
    const expensesGrouped = await db.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    const expensesByCategory = expensesGrouped.map((e) => ({
      category: e.category,
      amount: Math.round(Number(e._sum.amount || 0)),
    }));

    // ── 12. Total Expenses (for net profit margin) ──
    const totalExpensesAgg = await db.expense.aggregate({
      _sum: { amount: true },
    });
    const totalExpenses = Number(totalExpensesAgg._sum.amount || 0);
    const totalCostWithFixed = totalExpenses + FIXED_MONTHLY_COST;
    const netProfitMargin = totalRevenue > 0
      ? ((totalRevenue - totalCostWithFixed) / totalRevenue) * 100
      : 0;

    // ── Build Response ──
    const summary = {
      totalRevenue: Math.round(totalRevenue),
      monthlyRecurring: Math.round(monthlyRecurring),
      pendingPayments: Math.round(pendingPayments),
      paidThisMonth: Math.round(paidThisMonth),
      paidThisYear: Math.round(paidThisYear),
      averageOrderValue: Math.round(averageOrderValue),
      proposalConversionRate: Math.round(proposalConversionRate * 10) / 10,
      activeSubscriptions: activeSubscriptionsCount,
      totalExpenses: Math.round(totalCostWithFixed),
      fixedMonthlyCost: FIXED_MONTHLY_COST,
      netProfitMargin: Math.round(netProfitMargin * 10) / 10,
    };

    return {
      summary,
      revenueByMonth: revenueByMonthData,
      revenueByService,
      topClients: topClients.slice(0, 10),
      recentPayments,
      expensesByCategory: [
        { category: "Platform Tools (Fixed)", amount: FIXED_MONTHLY_COST },
        ...expensesByCategory,
      ],
    };
    }, 2, 500);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Admin revenue error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch revenue data" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
