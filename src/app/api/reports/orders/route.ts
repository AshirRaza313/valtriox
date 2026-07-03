// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry } from "@/lib/db";
import { generateReportPDF, type ReportData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { safeDate } from "@/lib/utils-extended";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/reports/orders?orgId=xxx&period=daily|weekly|monthly
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const type = "orders";
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;
    const period = req.nextUrl.searchParams.get("period") || "monthly";

    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id: orgId } });
    }, 2, 500);
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const currency = getCurrencyForCountry(org.country || "PK");
    const sym = currency.symbol;

    const platformSettings = await db.platformSettings.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null);
    const platformInfo = {
      platformName: platformSettings?.companyName || "Valtriox",
      platformEmail: platformSettings?.companyEmail || undefined,
      platformPhone: platformSettings?.companyPhone || undefined,
      platformWebsite: platformSettings?.companyWebsite || undefined,
      platformLogo: platformSettings?.logoUrl || undefined,
      platformTagline: platformSettings?.tagline || "COMMAND YOUR BRAND UNIVERSE",
    };

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "daily": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case "weekly": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orders = await withRetry(async () => {
      return await db.order.findMany({
        where: { organizationId: orgId, createdAt: { gte: startDate } },
        include: { items: true, customer: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    }, 2, 500);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(orders.map((o) => o.customerId).filter(Boolean)).size;

    const statusMap: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const s = String(o.status || "unknown");
      if (!statusMap[s]) statusMap[s] = { count: 0, revenue: 0 };
      statusMap[s].count += 1;
      statusMap[s].revenue += Number(o.total) || 0;
    });

    const reportData: ReportData = {
      title: "Orders Report",
      subtitle: `${org.name} — ${period.charAt(0).toUpperCase() + period.slice(1)} summary`,
      period: `${period.charAt(0).toUpperCase() + period.slice(1)} (since ${startDate.toLocaleDateString()})`,
      generatedAt: new Date().toISOString(),
      orgName: org.name,
      orgEmail: org.email || undefined,
      orgPhone: org.phone || undefined,
      brandName: org.name,
      brandColor: org.brandColor || "#D4A73A",
      plan: org.plan,
      stats: [
        { label: "Total Orders", value: totalOrders },
        { label: "Total Revenue", value: `${sym} ${totalRevenue.toLocaleString()}` },
        { label: "Avg Order Value", value: `${sym} ${Math.round(avgOrderValue).toLocaleString()}` },
        { label: "Unique Customers", value: uniqueCustomers },
      ],
      tables: [
        {
          title: "Order Status Breakdown",
          headers: ["Status", "Orders", "Revenue"],
          rows: Object.entries(statusMap).map(([s, v]) => [
            s.charAt(0).toUpperCase() + s.slice(1),
            v.count,
            `${sym} ${v.revenue.toLocaleString()}`,
          ]),
        },
        {
          title: "Recent Orders (Top 20)",
          headers: ["Order #", "Date", "Customer", "Items", "Total", "Status"],
          rows: orders.slice(0, 20).map((o) => [
            o.orderNumber || o.id.slice(-6),
            new Date(o.createdAt).toLocaleDateString(),
            o.customer?.name || "Walk-in",
            o.items?.length || 0,
            `${sym} ${Number(o.total || 0).toLocaleString()}`,
            String(o.status || "—").charAt(0).toUpperCase() + String(o.status || "—").slice(1),
          ]),
        },
      ],
      summary: totalOrders === 0
        ? "No orders during this period."
        : `${totalOrders} orders processed totaling ${sym} ${totalRevenue.toLocaleString()}.`,
      ...platformInfo,
    };

    const pdfBuffer = await generateReportPDF(reportData);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="orders-report-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: unknown) {
    logger.error("[Orders Report] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate orders report" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
