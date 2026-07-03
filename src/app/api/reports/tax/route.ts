// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { generateReportPDF, type ReportData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/reports/tax?orgId=xxx&period=monthly|quarterly|yearly
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
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
    let periodLabel: string;
    switch (period) {
      case "quarterly":
        const q = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), q * 3, 1);
        periodLabel = `Q${q + 1} ${now.getFullYear()}`;
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        periodLabel = `FY ${now.getFullYear()}`;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = now.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
    }

    const [orders, expenses, invoices] = await Promise.all([
      withRetry(async () => {
        return await db.order.findMany({
          where: { organizationId: orgId, createdAt: { gte: startDate } },
          include: { items: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
      }, 2, 500),
      withRetry(async () => {
        return await db.expense.findMany({
          where: { organizationId: orgId, date: { gte: startDate } },
          orderBy: { date: "desc" },
          take: 500,
        });
      }, 2, 500).catch(() => []),
      withRetry(async () => {
        return await db.invoice.findMany({
          where: { organizationId: orgId, issuedAt: { gte: startDate }, status: { in: ["paid", "approved"] } },
          orderBy: { issuedAt: "desc" },
          take: 500,
        });
      }, 2, 500).catch(() => []),
    ]);

    const grossRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const refunds = orders
      .filter((o) => o.status === "cancelled" || o.status === "returns")
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const netRevenue = grossRevenue - refunds;
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const taxableIncome = Math.max(0, netRevenue - totalExpenses);

    // Default tax rates — Pakistan standard sales tax 13% (placeholder; user can override)
    const salesTaxRate = 13;
    const salesTax = Math.round(netRevenue * (salesTaxRate / 100) * 100) / 100;
    const incomeTaxRate = 0.25;
    const incomeTax = Math.round(taxableIncome * incomeTaxRate * 100) / 100;

    const reportData: ReportData = {
      title: "Tax Summary Report",
      subtitle: `${org.name} — ${periodLabel}`,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      orgName: org.name,
      orgEmail: org.email || undefined,
      brandName: org.name,
      brandColor: org.brandColor || "#D4A73A",
      plan: org.plan,
      stats: [
        { label: "Gross Revenue", value: `${sym} ${grossRevenue.toLocaleString()}` },
        { label: "Refunds", value: `${sym} ${refunds.toLocaleString()}` },
        { label: "Net Revenue", value: `${sym} ${netRevenue.toLocaleString()}` },
        { label: "Total Expenses", value: `${sym} ${totalExpenses.toLocaleString()}` },
      ],
      tables: [
        {
          title: "Tax Liability Breakdown",
          headers: ["Tax Type", "Rate", "Base Amount", "Tax Payable"],
          rows: [
            ["Sales Tax (Output)", `${salesTaxRate}%`, `${sym} ${netRevenue.toLocaleString()}`, `${sym} ${salesTax.toLocaleString()}`],
            ["Income Tax", `${(incomeTaxRate * 100).toFixed(0)}%`, `${sym} ${taxableIncome.toLocaleString()}`, `${sym} ${incomeTax.toLocaleString()}`],
            ["TOTAL TAX PAYABLE", "—", "—", `${sym} ${(salesTax + incomeTax).toLocaleString()}`],
          ],
        },
        {
          title: "Expense Breakdown (Top 20)",
          headers: ["Date", "Category", "Description", "Amount"],
          rows: expenses.slice(0, 20).map((e) => [
            new Date(e.date).toLocaleDateString(),
            e.category || "—",
            e.description || "—",
            `${sym} ${Number(e.amount || 0).toLocaleString()}`,
          ]),
        },
      ],
      summary: `For ${periodLabel}: Gross revenue ${sym} ${grossRevenue.toLocaleString()}, refunds ${sym} ${refunds.toLocaleString()}, net revenue ${sym} ${netRevenue.toLocaleString()}, expenses ${sym} ${totalExpenses.toLocaleString()}. Estimated total tax payable: ${sym} ${(salesTax + incomeTax).toLocaleString()}.`,
      ...platformInfo,
    };

    const pdfBuffer = await generateReportPDF(reportData);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tax-summary-${period}-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: unknown) {
    logger.error("[Tax Report] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate tax summary" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
