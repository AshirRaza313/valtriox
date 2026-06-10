import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { getPlanLimits, PLAN_FEATURE_MATRIX, FEATURE_MATRIX, PLAN_NAMES } from "@/lib/plan-limits";
import { FEATURE_LOCKS, PLAN_LEVELS } from "@/lib/feature-lock";

// GET /api/admin/plan-preview?planId=professional
export const GET = withAuth(async (req: NextRequest) => {
  const planId = req.nextUrl.searchParams.get("planId");

  if (!planId || !PLAN_NAMES[planId]) {
    return NextResponse.json(
      { error: "Valid planId is required (starter, growth, professional, enterprise)" },
      { status: 400 }
    );
  }

  // Get plan limits
  const limits = getPlanLimits(planId);

  // Get feature IDs unlocked for this plan (from PLAN_FEATURE_MATRIX)
  const unlockedSet = new Set(PLAN_FEATURE_MATRIX[planId] || []);

  // Map high-level feature matrix flags
  const highLevelFeatures = FEATURE_MATRIX.map((f) => ({
    id: f.id,
    name: f.label,
    description: f.description,
    category: f.category,
    enabled: unlockedSet.has(f.id),
    planRequired: null, // These are binary based on PLAN_FEATURE_MATRIX
  }));

  // Map granular feature locks from FEATURE_LOCKS
  const planLevel = PLAN_LEVELS[planId] ?? 0;
  const granularFeatures = FEATURE_LOCKS.map((lock) => {
    const requiredLevel = PLAN_LEVELS[lock.minPlan] ?? 0;
    const enabled = planLevel >= requiredLevel;
    return {
      id: lock.id,
      name: lock.label,
      description: lock.description,
      category: lock.minPlan === "growth" ? "marketing" : lock.minPlan === "professional" ? "operations" : "enterprise",
      enabled,
      planRequired: lock.minPlan,
    };
  });

  // Combine all features
  const allFeatures = [...highLevelFeatures, ...granularFeatures];

  // Group features by category
  const categories: Record<string, Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    enabled: boolean;
    planRequired: string | null;
  }>> = {};

  allFeatures.forEach((f) => {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
  });

  // Sort features within each category: enabled first, then by name
  Object.values(categories).forEach((items) => {
    items.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  const enabledCount = allFeatures.filter((f) => f.enabled).length;

  return NextResponse.json({
    planId,
    planName: PLAN_NAMES[planId],
    limits,
    features: categories,
    enabledCount,
    totalCount: allFeatures.length,
  });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
