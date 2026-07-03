// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { generateReportPDF, type ReportData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/reports/custom-range?orgId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD&dataTypes=orders,expenses,customers
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const dataTypesParam = req.nextUrl.searchParams.get("dataTypes") || "orders,customers,expenses";

    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!from || !to) {
      return NextResponse.json({ error: "from and to query params are required (YYYY-MM-DD)" }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
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

    const dataTypes = dataTypesParam.split(",").map((s) => s.trim()).filter(Boolean);
    const tables: Array<{ title: string; headers: string[]; rows: Array<Array<string | number>> }> = [];
    const stats: Array<{ label: string; value: string | number }> = [];

    const dateRangeLabel = `${fromDate.toLocaleDateString()} → ${toDate.toLocaleDateString()}`;

    // ── Fetch orders ──
    let orders: any[] = [];
    if (dataTypes.includes("orders")) {
      orders = await withRetry(async () => {
        return await db.order.findMany({
          where: { organizationId: orgId, createdAt: { gte: fromDate, lte: toDate } },
          include: { items: true, customer: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
      }, 2, 500);

      const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      stats.push({ label: "Orders", value: orders.length });
      stats.push({ label: "Revenue", value: `${sym} ${totalRevenue.toLocaleString()}` });
      stats.push({ label: "Avg Order", value: orders.length > 0 ? `${sym} ${Math.round(totalRevenue / orders.length).toLocaleString()}` : `${sym} 0` });

      tables.push({
        title: "Orders in Range",
        headers: ["Order #", "Date", "Customer", "Items", "Total", "Status"],
        rows: orders.slice(0, 30).map((o) => [
          o.orderNumber || o.id.slice(-6),
          new Date(o.createdAt).toLocaleDateString(),
          o.customer?.name || "Walk-in",
          o.items?.length || 0,
          `${sym} ${Number(o.total || 0).toLocaleString()}`,
          String(o.status || "—").charAt(0).toUpperCase() + String(o.status || "—").slice(1),
        ]),
      });
    }

    // ── Fetch expenses ──
    if (dataTypes.includes("expenses")) {
      const expenses = await withRetry(async () => {
        return await db.expense.findMany({
          where: { organizationId: orgId, date: { gte: fromDate, lte: toDate } },
          orderBy: { date: "desc" },
          take: 500,
        });
      }, 2, 500).catch(() => []);

      const totalExp = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      stats.push({ label: "Expenses", value: `${sym} ${totalExp.toLocaleString()}` });
      stats.push({ label: "Net", value: `${sym} ${(orders.reduce((s, o) => s + (Number(o.total) || 0), 0) - totalExp).toLocaleString()}` });

      tables.push({
        title: "Expenses in Range",
        headers: ["Date", "Category", "Description", "Amount"],
        rows: expenses.slice(0, 30).map((e) => [
          new Date(e.date).toLocaleDateString(),
          e.category || "—",
          e.description || "—",
          `${sym} ${Number(e.amount || 0).toLocaleString()}`,
        ]),
      });
    }

    // ── Fetch customers ──
    if (dataTypes.includes("customers")) {
      const customers = await withRetry(async () => {
        return await db.customer.findMany({
          where: { organizationId: orgId, createdAt: { gte: fromDate, lte: toDate } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      }, 2, 500).catch(() => []);

      stats.push({ label: "New Customers", value: customers.length });

      tables.push({
        title: "New Customers in Range",
        headers: ["Name", "Email", "Phone", "Joined"],
        rows: customers.slice(0, 30).map((c) => [
          c.name,
          c.email || "—",
          c.phone || "—",
          new Date(c.createdAt).toLocaleDateString(),
        ]),
      });
    }

    if (stats.length === 0) {
      stats.push({ label: "Period", value: dateRangeLabel });
      stats.push({ label: "Status", value: "No data types selected" });
    }

    const reportData: ReportData = {
      title: "Custom Date-Range Report",
      subtitle: `${org.name} — ${dateRangeLabel}`,
      period: dateRangeLabel,
      generatedAt: new Date().toISOString(),
      orgName: org.name,
      orgEmail: org.email || undefined,
      brandName: org.name,
      brandColor: org.brandColor || "#D4A73A",
      plan: org.plan,
      stats,
      tables,
      summary: `Custom report for ${dateRangeLabel} covering: ${dataTypes.join(", ")}.`,
      ...platformInfo,
    };

    const pdfBuffer = await generateReportPDF(reportData);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="custom-report-${from}-to-${to}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: unknown) {
    logger.error("[Custom Range Report] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate custom range report" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
