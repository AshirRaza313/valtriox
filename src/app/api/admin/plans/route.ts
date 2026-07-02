import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── Plan Seed Data (Valtriox Pricing 2026) ──
const PLAN_SEEDS = [
  {
    name: "starter", price: 7999, annualPrice: Math.round(7999 * 12 * 0.8), quarterlyPrice: Math.round(7999 * 3 * 0.9),
    features: JSON.stringify(["Brand Dashboard (Basic)", "3 Marketing Channels", "Standard Analytics & Reports", "2 Third-Party Integrations", "Up to 3 Team Members", "5 GB Cloud Storage", "Business Hours Support (Mon-Fri, 9AM-6PM)", "Order & Customer Management", "Email Notifications", "99.5% Uptime SLA", "Read-Only API Access"]),
    teamLimit: 3, orderLimit: 100, productLimit: 50, trialDays: 14, period: "monthly", isActive: true,
  },
  {
    name: "growth", price: 14999, annualPrice: Math.round(14999 * 12 * 0.8), quarterlyPrice: Math.round(14999 * 3 * 0.9),
    features: JSON.stringify(["Advanced Brand Dashboard", "5 Marketing Channels", "Campaign Management (5 campaigns)", "5 Third-Party Integrations", "Up to 8 Team Members", "20 GB Cloud Storage", "Business Hours Support (Priority Queue)", "2,000 Emails/Month", "Up to 100 Tasks & 3 Tickets", "Coupon & Loyalty Tracking", "99.5% Uptime SLA"]),
    teamLimit: 8, orderLimit: 500, productLimit: 200, trialDays: 14, period: "monthly", isActive: true,
  },
  {
    name: "professional", price: 24999, annualPrice: Math.round(24999 * 12 * 0.8), quarterlyPrice: Math.round(24999 * 3 * 0.9),
    features: JSON.stringify(["Advanced Brand Dashboard", "8 Marketing Channels (All Platforms)", "Advanced + Custom Analytics", "10 Third-Party Integrations", "Up to 15 Team Members", "50 GB Cloud Storage", "Priority 24/7 Support", "Full API Access", "Custom Branding", "AI-Powered Insights & Automation", "Campaign Management & SEO Tools", "Social Media Management Suite", "Email Marketing & Ad Manager", "99.9% Uptime SLA", "Coupons, Loyalty & Influencer Tracking"]),
    teamLimit: 15, orderLimit: -1, productLimit: -1, trialDays: 14, period: "monthly", isActive: true,
  },
  {
    name: "enterprise", price: 74999, annualPrice: 0, quarterlyPrice: 0,
    features: JSON.stringify(["Full Suite Dashboard (AI-Powered)", "Unlimited Marketing Channels", "AI-Powered Analytics & Predictions", "Unlimited + Custom Integrations", "Unlimited Team Members", "Unlimited Cloud Storage", "Dedicated Account Manager", "Full API Access + Webhooks", "White-Label Portal", "Custom Development & Features", "SLA Guarantee (99.99% Uptime)", "Quarterly Business Reviews", "Priority Feature Requests", "Import/Export, Warehouse, Returns", "Support Tickets & Audit Log", "Automated Reports & SLA Engine"]),
    teamLimit: -1, orderLimit: -1, productLimit: -1, trialDays: 14, period: "custom", isActive: true,
  },
];

// POST /api/admin/plans - Re-sync all plans to latest pricing (platform owner only)
export const POST = withRateLimit(withAuth(async (_request: NextRequest, authCtx) => {
  logger.info("[Admin Plans] POST re-sync request", { userId: authCtx.userId });
  try {
    const results: any[] = [];
    for (const plan of PLAN_SEEDS) {
      const result = await withRetry(async () => {
        return await db.subscriptionPlan.upsert({
          where: { name: plan.name },
          update: {
            price: plan.price,
            annualPrice: plan.annualPrice,
            quarterlyPrice: plan.quarterlyPrice,
            features: plan.features,
            teamLimit: plan.teamLimit,
            orderLimit: plan.orderLimit,
            productLimit: plan.productLimit,
            trialDays: plan.trialDays,
            period: plan.period,
            isActive: plan.isActive,
          },
          create: plan,
        });
      }, 2, 500);
      results.push({ name: result.name, price: result.price, annualPrice: result.annualPrice, quarterlyPrice: result.quarterlyPrice });
    }

    return NextResponse.json({
      success: true,
      message: "Plans re-synced to latest Valtriox pricing",
      plans: results,
    });
  } catch (error) {
    logger.error("Re-sync plans error:", error);
    return NextResponse.json({ error: "Failed to re-sync plans" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// GET /api/admin/plans - List all plans with their pricing (platform owner only)
export const GET = withRateLimit(withAuth(async (_request: NextRequest, authCtx) => {
  logger.info("[Admin Plans] GET request", { userId: authCtx.userId });
  try {
    const plans = await withRetry(async () => {
      return await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    })
    }, 2, 500);

    return NextResponse.json({ plans });
  } catch (error) {
    logger.error("Fetch plans error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// PUT /api/admin/plans - Update plan pricing (platform owner only)
export const PUT = withRateLimit(withAuth(async (request: NextRequest, authCtx) => {
  logger.info("[Admin Plans] PUT request", { userId: authCtx.userId });
  try {
    const body = await request.json();
    const { planId, price, annualPrice, period, teamLimit, orderLimit, productLimit, trialDays, features } = body;

    if (!planId || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updateData: any = { price: Number(price) };
    if (annualPrice !== undefined) updateData.annualPrice = Number(annualPrice);
    if (period) updateData.period = period;
    if (teamLimit !== undefined) updateData.teamLimit = Number(teamLimit);
    if (orderLimit !== undefined) updateData.orderLimit = Number(orderLimit);
    if (productLimit !== undefined) updateData.productLimit = Number(productLimit);
    if (trialDays !== undefined) updateData.trialDays = Number(trialDays);
    if (features) updateData.features = JSON.stringify(features);

    const updated = await withRetry(async () => {
      return await db.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    })
    }, 2, 500);

    return NextResponse.json({ plan: updated, message: "Plan updated successfully" });
  } catch (error) {
    logger.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
