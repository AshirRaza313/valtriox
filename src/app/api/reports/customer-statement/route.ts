// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { generateReportPDF, type ReportData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/reports/customer-statement?orgId=xxx&customerId=xxx
// If no customerId, returns aggregated customer statement (all customers)
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;
    const customerId = req.nextUrl.searchParams.get("customerId");

    const __isPlatformAdmin = isPlatformRole(authCtx.role);
    if (!__isPlatformAdmin && orgId !== authCtx.organizationId) {
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

    let customer: any = null;
    let orders: any[] = [];
    let title = "Customer Statement — All Customers";

    if (customerId) {
      customer = await withRetry(async () => {
        return await db.customer.findUnique({ where: { id: customerId } });
      }, 2, 500);
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      title = `Customer Statement — ${customer.name}`;
      orders = await withRetry(async () => {
        return await db.order.findMany({
          where: { organizationId: orgId, customerId },
          include: { items: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      }, 2, 500);
    } else {
      // All customers — aggregate
      const customers = await withRetry(async () => {
        return await db.customer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      }, 2, 500);
      orders = await withRetry(async () => {
        return await db.order.findMany({
          where: { organizationId: orgId },
          include: { items: true, customer: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
      }, 2, 500);

      // Per-customer aggregation
      const customerAgg = new Map<string, { name: string; email: string; orders: number; total: number; lastOrder: Date | null }>();
      customers.forEach((c) => customerAgg.set(c.id, { name: c.name, email: c.email || "—", orders: 0, total: 0, lastOrder: null }));
      orders.forEach((o) => {
        if (!o.customerId) return;
        const agg = customerAgg.get(o.customerId);
        if (!agg) return;
        agg.orders += 1;
        agg.total += Number(o.total) || 0;
        if (!agg.lastOrder || new Date(o.createdAt) > agg.lastOrder) agg.lastOrder = new Date(o.createdAt);
      });

      const reportData: ReportData = {
        title,
        subtitle: `${org.name} — All customers statement`,
        period: `As of ${new Date().toLocaleDateString()}`,
        generatedAt: new Date().toISOString(),
        orgName: org.name,
        orgEmail: org.email || undefined,
        brandName: org.name,
        brandColor: org.brandColor || "#D4A73A",
        plan: org.plan,
        stats: [
          { label: "Total Customers", value: customers.length },
          { label: "Total Orders", value: orders.length },
          { label: "Total Revenue", value: `${sym} ${orders.reduce((s, o) => s + (Number(o.total) || 0), 0).toLocaleString()}` },
          { label: "Avg Revenue / Customer", value: `${sym} ${customers.length > 0 ? Math.round(orders.reduce((s, o) => s + (Number(o.total) || 0), 0) / customers.length).toLocaleString() : 0}` },
        ],
        tables: [
          {
            title: "Customer Summary",
            headers: ["Customer", "Email", "Orders", "Total Spent", "Last Order"],
            rows: Array.from(customerAgg.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 50)
              .map(([_, v]) => [
                v.name,
                v.email,
                v.orders,
                `${sym} ${v.total.toLocaleString()}`,
                v.lastOrder ? v.lastOrder.toLocaleDateString() : "—",
              ]),
          },
        ],
        summary: `Statement covers ${customers.length} customers with ${orders.length} total orders.`,
        ...platformInfo,
      };

      const pdfBuffer = await generateReportPDF(reportData);
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="customer-statement-${new Date().toISOString().split("T")[0]}.pdf"`,
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    // Single customer statement
    const totalSpent = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const reportData: ReportData = {
      title,
      subtitle: `${customer.name} <${customer.email || "—"}>`,
      period: `All orders as of ${new Date().toLocaleDateString()}`,
      generatedAt: new Date().toISOString(),
      orgName: org.name,
      orgEmail: org.email || undefined,
      brandName: org.name,
      brandColor: org.brandColor || "#D4A73A",
      plan: org.plan,
      stats: [
        { label: "Customer", value: customer.name },
        { label: "Email", value: customer.email || "—" },
        { label: "Total Orders", value: orders.length },
        { label: "Total Spent", value: `${sym} ${totalSpent.toLocaleString()}` },
      ],
      tables: [
        {
          title: "Order History",
          headers: ["Order #", "Date", "Items", "Total", "Status"],
          rows: orders.slice(0, 50).map((o) => [
            o.orderNumber || o.id.slice(-6),
            new Date(o.createdAt).toLocaleDateString(),
            o.items?.length || 0,
            `${sym} ${Number(o.total || 0).toLocaleString()}`,
            String(o.status || "—").charAt(0).toUpperCase() + String(o.status || "—").slice(1),
          ]),
        },
      ],
      summary: `Customer ${customer.name} has placed ${orders.length} orders totaling ${sym} ${totalSpent.toLocaleString()}.`,
      ...platformInfo,
    };

    const pdfBuffer = await generateReportPDF(reportData);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="customer-statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: unknown) {
    logger.error("[Customer Statement] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate customer statement" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
