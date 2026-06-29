import { NextResponse } from "next/server";
import { db, isDbUnavailable } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// POST /api/admin/sync-plans - Update DB plans to match landing page pricing
export const POST = withAuth(async () => {
  try {
    logger.info("[Sync Plans] Starting plan sync to match landing page");
    const plans = [
      {
        name: "starter",
        price: 7999,
        annualPrice: Math.round(7999 * 12 * 0.8),
        quarterlyPrice: Math.round(7999 * 3 * 0.9),
        period: "monthly",
        features: JSON.stringify([
          "Brand Dashboard", "Up to 50 Products", "100 Orders/Month", "Up to 3 Team Members",
          "5 GB Cloud Storage", "3 Marketing Channels", "500 Emails/Month",
          "2 Third-Party Integrations", "Business Hours Support", "Read-Only API Access",
          "14-Day Free Trial",
        ]),
        teamLimit: 3,
        orderLimit: 100,
        productLimit: 50,
        trialDays: 14,
        isActive: true,
      },
      {
        name: "growth",
        price: 14999,
        annualPrice: Math.round(14999 * 12 * 0.8),
        quarterlyPrice: Math.round(14999 * 3 * 0.9),
        period: "monthly",
        features: JSON.stringify([
          "Advanced Brand Dashboard", "Up to 200 Products", "500 Orders/Month", "Up to 8 Team Members",
          "20 GB Cloud Storage", "5 Marketing Channels", "Campaign Management (5)",
          "2,000 Emails/Month", "Coupon Management (15)", "Priority Queue Support",
          "Unlimited Invoices", "14-Day Free Trial",
        ]),
        teamLimit: 8,
        orderLimit: 500,
        productLimit: 200,
        trialDays: 14,
        isActive: true,
      },
      {
        name: "professional",
        price: 24999,
        annualPrice: Math.round(24999 * 12 * 0.8),
        quarterlyPrice: Math.round(24999 * 3 * 0.9),
        period: "monthly",
        features: JSON.stringify([
          "Unlimited Orders & Products", "Up to 15 Team Members", "50 GB Cloud Storage",
          "8 Marketing Channels", "Campaign Management (10)", "5,000 Emails/Month",
          "Full API Access", "Custom Branding", "AI-Powered Insights",
          "SEO & Social Media Tools", "Email Marketing & Ad Manager",
          "Priority 24/7 Support", "14-Day Free Trial",
        ]),
        teamLimit: 15,
        orderLimit: -1,
        productLimit: -1,
        trialDays: 14,
        isActive: true,
      },
      {
        name: "enterprise",
        price: 0,
        annualPrice: 0,
        quarterlyPrice: 0,
        period: "custom",
        features: JSON.stringify([
          "Unlimited Everything", "Full Suite AI Dashboard", "Dedicated Account Manager",
          "White-Label Portal", "Custom Integrations & Development", "Full API + Webhooks",
          "99.99% Uptime SLA", "Warehouse Management", "Audit Log & SLA Engine",
        ]),
        teamLimit: -1,
        orderLimit: -1,
        productLimit: -1,
        trialDays: 14,
        isActive: true,
      },
    ];

    const results: string[] = [];

    for (const plan of plans) {
      const existing = await db.subscriptionPlan.findUnique({ where: { name: plan.name } });

      if (existing) {
        await db.subscriptionPlan.update({
          where: { name: plan.name },
          data: plan,
        });
        results.push(`Updated ${plan.name}`);
      } else {
        await db.subscriptionPlan.create({ data: plan });
        results.push(`Created ${plan.name}`);
      }
    }

    logger.info("[Sync Plans] Plan sync completed", { results });

    return NextResponse.json({
      success: true,
      message: "Plans synced successfully",
      results,
    });
  } catch (error: any) {
    console.error("Sync plans error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to sync plans" }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });
