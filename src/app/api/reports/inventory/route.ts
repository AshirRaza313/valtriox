// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { generateReportPDF, type ReportData } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/reports/inventory?orgId=xxx
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId") || authCtx.organizationId!;

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

    const products = await withRetry(async () => {
      return await db.product.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    }, 2, 500);

    const totalProducts = products.length;
    const totalStockValue = products.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0), 0);
    const lowStockItems = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).length;
    const outOfStockItems = products.filter((p) => Number(p.stock) === 0).length;

    const reportData: ReportData = {
      title: "Inventory Report",
      subtitle: `${org.name} — Stock levels and valuation`,
      period: `As of ${new Date().toLocaleDateString()}`,
      generatedAt: new Date().toISOString(),
      orgName: org.name,
      orgEmail: org.email || undefined,
      brandName: org.name,
      brandColor: org.brandColor || "#D4A73A",
      plan: org.plan,
      stats: [
        { label: "Total Products", value: totalProducts },
        { label: "Stock Value", value: `${sym} ${totalStockValue.toLocaleString()}` },
        { label: "Low Stock (≤ 5)", value: lowStockItems },
        { label: "Out of Stock", value: outOfStockItems },
      ],
      tables: [
        {
          title: "Inventory Detail",
          headers: ["Product", "Category", "Stock", "Price", "Stock Value", "Status"],
          rows: products.slice(0, 50).map((p) => {
            const stock = Number(p.stock) || 0;
            const price = Number(p.price) || 0;
            const status = stock === 0 ? "Out of Stock" : stock <= 5 ? "Low Stock" : "In Stock";
            return [
              p.name || "—",
              p.category || "—",
              stock,
              `${sym} ${price.toLocaleString()}`,
              `${sym} ${(stock * price).toLocaleString()}`,
              status,
            ];
          }),
        },
      ],
      summary: `${totalProducts} products with total stock value of ${sym} ${totalStockValue.toLocaleString()}. ${outOfStockItems} out-of-stock, ${lowStockItems} low-stock.`,
      ...platformInfo,
    };

    const pdfBuffer = await generateReportPDF(reportData);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inventory-report-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: unknown) {
    logger.error("[Inventory Report] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate inventory report" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
