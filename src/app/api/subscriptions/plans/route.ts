import { NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// Allowed plan names - any plan NOT in this list will be filtered out
const ALLOWED_PLAN_NAMES = ["starter", "growth", "professional", "enterprise"];

// ── Canonical plan definitions (matches landing page Pricing.tsx exactly) ──
const CANONICAL_PLANS: Record<string, {
  price: number; annualPrice: number; quarterlyPrice: number; period: string;
  features: string[]; teamLimit: number; orderLimit: number; productLimit: number; trialDays: number;
}> = {
  starter: {
    price: 7999, annualPrice: Math.round(7999 * 12 * 0.8), quarterlyPrice: Math.round(7999 * 3 * 0.9), period: "monthly",
    features: ["Brand Dashboard", "Up to 50 Products", "100 Orders/Month", "Up to 3 Team Members", "5 GB Cloud Storage", "3 Marketing Channels", "500 Emails/Month", "2 Third-Party Integrations", "Business Hours Support", "Read-Only API Access", "14-Day Free Trial"],
    teamLimit: 3, orderLimit: 100, productLimit: 50, trialDays: 14,
  },
  growth: {
    price: 14999, annualPrice: Math.round(14999 * 12 * 0.8), quarterlyPrice: Math.round(14999 * 3 * 0.9), period: "monthly",
    features: ["Advanced Brand Dashboard", "Up to 200 Products", "500 Orders/Month", "Up to 8 Team Members", "20 GB Cloud Storage", "5 Marketing Channels", "Campaign Management (5)", "2,000 Emails/Month", "Coupon Management (15)", "Priority Queue Support", "Unlimited Invoices", "14-Day Free Trial"],
    teamLimit: 8, orderLimit: 500, productLimit: 200, trialDays: 14,
  },
  professional: {
    price: 24999, annualPrice: Math.round(24999 * 12 * 0.8), quarterlyPrice: Math.round(24999 * 3 * 0.9), period: "monthly",
    features: ["Unlimited Orders & Products", "Up to 15 Team Members", "50 GB Cloud Storage", "8 Marketing Channels", "Campaign Management (10)", "5,000 Emails/Month", "Full API Access", "Custom Branding", "AI-Powered Insights", "SEO & Social Media Tools", "Email Marketing & Ad Manager", "Priority 24/7 Support", "14-Day Free Trial"],
    teamLimit: 15, orderLimit: -1, productLimit: -1, trialDays: 14,
  },
  enterprise: {
    price: 0, annualPrice: 0, quarterlyPrice: 0, period: "custom",
    features: ["Unlimited Everything", "Full Suite AI Dashboard", "Dedicated Account Manager", "White-Label Portal", "Custom Integrations & Development", "Full API + Webhooks", "99.99% Uptime SLA", "Warehouse Management", "Audit Log & SLA Engine"],
    teamLimit: -1, orderLimit: -1, productLimit: -1, trialDays: 14,
  },
};

// Auto-sync DB plans to match canonical definitions
async function syncPlansToLandingPage() {
  for (const [name, canonical] of Object.entries(CANONICAL_PLANS)) {
    const existing = await db.subscriptionPlan.findUnique({ where: { name } });
    const needsUpdate = !existing
      || Number(existing.price) !== canonical.price
      || existing.period !== canonical.period
      || existing.teamLimit !== canonical.teamLimit
      || existing.orderLimit !== canonical.orderLimit
      || existing.productLimit !== canonical.productLimit;

    if (needsUpdate) {
      const data = {
        price: canonical.price,
        annualPrice: canonical.annualPrice,
        quarterlyPrice: canonical.quarterlyPrice,
        period: canonical.period,
        features: JSON.stringify(canonical.features),
        teamLimit: canonical.teamLimit,
        orderLimit: canonical.orderLimit,
        productLimit: canonical.productLimit,
        trialDays: canonical.trialDays,
        isActive: true,
      };
      if (existing) {
        await db.subscriptionPlan.update({ where: { name }, data });
        logger.info(`[Plans] Auto-synced: updated ${name}`);
      } else {
        await db.subscriptionPlan.create({ data });
        logger.info(`[Plans] Auto-synced: created ${name}`);
      }
    }
  }
}

// GET /api/subscriptions/plans - Public: return all active subscription plans
export const GET = withAuth(async () => {
  try {
    logger.info("[Subscriptions Plans] GET request");
    // Auto-cleanup: filter out stale plans (free, basic, etc.)
    try {
      const staleCount = await withRetry(async () => {
        return await db.subscriptionPlan.deleteMany({
        where: { name: { notIn: ALLOWED_PLAN_NAMES } },
      })
      }, 2, 500);
      if (staleCount.count > 0) {
        logger.warn(`[Plans] Auto-cleaned ${staleCount.count} stale plans`);
      }
    } catch (cleanupErr: any) {
      // Non-critical, don't block the response
      console.error("[Plans] Cleanup failed (non-critical):", cleanupErr?.message);
    }

    // Auto-sync: ensure DB plans match landing page pricing (run once)
    try {
      await syncPlansToLandingPage();
    } catch (syncErr: any) {
      console.error("[Plans] Auto-sync failed (non-critical):", syncErr?.message);
    }

    const plans = await withRetry(async () => {
      return await db.subscriptionPlan.findMany({
      where: { isActive: true, name: { in: ALLOWED_PLAN_NAMES } },
      orderBy: { createdAt: "asc" },
    })
    }, 2, 500);

    // Ensure plans are in correct display order (starter, growth, professional, enterprise)
    const planOrder: Record<string, number> = { starter: 0, growth: 1, professional: 2, enterprise: 3 };
    plans.sort((a, b) => (planOrder[a.name] ?? 99) - (planOrder[b.name] ?? 99));

    const formatted = plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      annualPrice: p.annualPrice || 0,
      quarterlyPrice: (p as any).quarterlyPrice || 0,
      period: p.period,
      features: JSON.parse(p.features || "[]"),
      teamLimit: p.teamLimit,
      orderLimit: p.orderLimit,
      productLimit: p.productLimit,
      trialDays: p.trialDays,
      // Calculate savings for annual plan
      annualSavings: p.annualPrice > 0 && p.price > 0
        ? Math.round((1 - p.annualPrice / (p.price * 12)) * 100)
        : 0,
    }));

    return NextResponse.json({ plans: formatted });
  } catch (error: any) {
    console.error("Fetch plans error:", error?.message || error);
    if (isDbUnavailable(error)) {
      // Return default plans when DB is unavailable (Revised Pricing Strategy 2026)
      const defaultPlans = [
        {
          id: "default-starter",
          name: "Starter",
          price: 7999,
          annualPrice: Math.round(7999 * 12 * 0.8),
          quarterlyPrice: Math.round(7999 * 3 * 0.9),
          period: "monthly",
          features: ["Brand Dashboard", "Up to 50 Products", "100 Orders/Month", "Up to 3 Team Members", "5 GB Cloud Storage", "3 Marketing Channels", "500 Emails/Month", "2 Third-Party Integrations", "Business Hours Support", "Read-Only API Access", "14-Day Free Trial"],
          teamLimit: 3,
          orderLimit: 100,
          productLimit: 50,
          trialDays: 14,
          annualSavings: 20,
        },
        {
          id: "default-growth",
          name: "Growth",
          price: 14999,
          annualPrice: Math.round(14999 * 12 * 0.8),
          quarterlyPrice: Math.round(14999 * 3 * 0.9),
          period: "monthly",
          features: ["Advanced Brand Dashboard", "Up to 200 Products", "500 Orders/Month", "Up to 8 Team Members", "20 GB Cloud Storage", "5 Marketing Channels", "Campaign Management (5)", "2,000 Emails/Month", "Coupon Management (15)", "Priority Queue Support", "Unlimited Invoices", "14-Day Free Trial"],
          teamLimit: 8,
          orderLimit: 500,
          productLimit: 200,
          trialDays: 14,
          annualSavings: 20,
        },
        {
          id: "default-professional",
          name: "Professional",
          price: 24999,
          annualPrice: Math.round(24999 * 12 * 0.8),
          quarterlyPrice: Math.round(24999 * 3 * 0.9),
          period: "monthly",
          features: ["Unlimited Orders & Products", "Up to 15 Team Members", "50 GB Cloud Storage", "8 Marketing Channels", "Campaign Management (10)", "5,000 Emails/Month", "Full API Access", "Custom Branding", "AI-Powered Insights", "SEO & Social Media Tools", "Email Marketing & Ad Manager", "Priority 24/7 Support", "14-Day Free Trial"],
          teamLimit: 15,
          orderLimit: -1,
          productLimit: -1,
          trialDays: 14,
          annualSavings: 20,
        },
        {
          id: "default-enterprise",
          name: "Enterprise",
          price: 0,
          annualPrice: 0,
          quarterlyPrice: 0,
          period: "custom",
          features: ["Unlimited Everything", "Full Suite AI Dashboard", "Dedicated Account Manager", "White-Label Portal", "Custom Integrations & Development", "Full API + Webhooks", "99.99% Uptime SLA", "Warehouse Management", "Audit Log & SLA Engine"],
          teamLimit: -1,
          orderLimit: -1,
          productLimit: -1,
          trialDays: 14,
          annualSavings: 0,
        },
      ];
      return NextResponse.json({ plans: defaultPlans, fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}, { allowPublic: true });
