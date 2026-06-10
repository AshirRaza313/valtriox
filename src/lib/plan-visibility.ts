// ============================================================================
// Plan Visibility Control for Valtriox
// ============================================================================
// Determines which plans are visible to which user roles and what actions
// are available (get started, contact us, upgrade).
//
// Plans: starter, growth, professional, enterprise
// All plans are visible by default. Enterprise requires contact_us for
// brand users but get_started for platform admins.
// ============================================================================

export interface PlanVisibility {
  id: string;
  name: string;
  visible: boolean;
  selectable: boolean;
  callToAction: 'get_started' | 'contact_us' | 'upgrade';
  badge?: string; // e.g., "Most Popular", "Enterprise", "Best Value"
}

// Platform-level roles that bypass restrictions
const PLATFORM_ROLES = ["platform_owner", "platform_admin", "owner", "admin", "valtriox_team"];

// All available plans in display order
const ALL_PLANS: PlanVisibility[] = [
  {
    id: "starter",
    name: "Starter",
    visible: true,
    selectable: true,
    callToAction: "get_started",
    badge: undefined,
  },
  {
    id: "growth",
    name: "Growth",
    visible: true,
    selectable: true,
    callToAction: "get_started",
    badge: "Best Value",
  },
  {
    id: "professional",
    name: "Professional",
    visible: true,
    selectable: true,
    callToAction: "get_started",
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    visible: true,
    selectable: true,
    callToAction: "contact_us",
    badge: "Enterprise",
  },
];

/**
 * Get all plans with visibility settings adjusted for the user's role.
 *
 * Rules:
 * - All plans are visible to everyone.
 * - Enterprise is selectable only by platform admins; brand users see "contact_us".
 * - If the user already has a plan, "upgrade" is shown for higher-tier plans.
 * - If the user already has that plan, show "current_plan" context (handled by caller).
 *
 * @param userRole - The user's role string (e.g., "platform_owner", "brand_owner", "member")
 * @param currentPlan - The user's current plan ID (optional)
 */
export function getVisiblePlans(userRole: string, currentPlan?: string): PlanVisibility[] {
  const isPlatformAdmin = PLATFORM_ROLES.includes(userRole);

  return ALL_PLANS.map((plan) => {
    const adjusted = { ...plan };

    // Enterprise: brand users can't self-serve
    if (plan.id === "enterprise") {
      adjusted.selectable = isPlatformAdmin;
      adjusted.callToAction = isPlatformAdmin ? "get_started" : "contact_us";
    }

    // Platform admins always get "get_started" for all plans
    if (isPlatformAdmin) {
      adjusted.callToAction = "get_started";
    }

    // If user already has this plan, show upgrade for higher tiers
    if (currentPlan && plan.id !== currentPlan) {
      const tierOrder = ["starter", "growth", "professional", "enterprise"];
      const currentIndex = tierOrder.indexOf(currentPlan);
      const planIndex = tierOrder.indexOf(plan.id);
      if (planIndex > currentIndex) {
        adjusted.callToAction = "upgrade";
      }
    }

    return adjusted;
  });
}

/**
 * Check if a specific plan is selectable for a given user role.
 *
 * @param planId - The plan ID to check
 * @param userRole - The user's role string
 */
export function isPlanSelectable(planId: string, userRole: string): boolean {
  // Enterprise is only selectable by platform admins
  if (planId === "enterprise") {
    return PLATFORM_ROLES.includes(userRole);
  }
  // All other plans are selectable by everyone
  return true;
}

/**
 * Get the call-to-action label text for a specific plan and user role.
 *
 * @param planId - The plan ID
 * @param userRole - The user's role string
 */
export function getPlanCallToAction(planId: string, userRole: string): string {
  const isPlatformAdmin = PLATFORM_ROLES.includes(userRole);

  if (planId === "enterprise") {
    return isPlatformAdmin ? "Get Started" : "Contact Us";
  }

  // For all other plans
  return "Get Started";
}

/**
 * Get the badge text for a plan (if any).
 *
 * @param planId - The plan ID
 */
export function getPlanBadge(planId: string): string | undefined {
  const plan = ALL_PLANS.find((p) => p.id === planId);
  return plan?.badge;
}

/**
 * Get the tier order for plan comparison.
 * Higher number = higher tier.
 */
export function getPlanTier(planId: string): number {
  const tierOrder: Record<string, number> = {
    starter: 0,
    growth: 1,
    professional: 2,
    enterprise: 3,
  };
  return tierOrder[planId] ?? -1;
}

/**
 * Check if a target plan is a higher tier than the current plan.
 * Used to determine whether to show "Upgrade" vs "Get Started" CTA.
 *
 * @param targetPlanId - The plan the user is considering
 * @param currentPlanId - The user's current plan
 */
export function isHigherTier(targetPlanId: string, currentPlanId: string): boolean {
  return getPlanTier(targetPlanId) > getPlanTier(currentPlanId);
}

/**
 * Check if a plan ID is valid.
 */
export function isValidPlan(planId: string): boolean {
  return ALL_PLANS.some((p) => p.id === planId);
}
