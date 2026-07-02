// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
// ============================================================================
// Subscription-Based Feature Locking System
// ============================================================================

import { PLAN_FEATURE_MATRIX } from "./plan-limits";
// Features available per plan:
//   "starter"       = Rs 7,999/month
//   "growth"         = Rs 14,999/month
//   "professional"  = Rs 24,999/month
//   "enterprise"    = Rs 74,999+/month (Custom)
//   "trial"         = trial (14 days) - same access as professional
// ============================================================================
// Platform Owner (owner / platform_owner / platform_admin) BYPASSES all locks.
// Brand Owner (brand_owner) and their team see locks based on their plan.
//
// IMPORTANT: Team members AUTOMATICALLY inherit the brand owner's plan features.
// The subscription is per-organization, not per-user. When a brand owner buys
// Professional plan, ALL team members in that organization get Professional-level access.
// Team members do NOT need their own subscription. The only limit is the
// number of team members allowed by the plan:
//   Starter: 3 | Growth: 10 | Professional: 25 | Enterprise: unlimited
//
// Feature descriptions explain to users what each locked feature provides,
// helping them understand the value of upgrading.
// ============================================================================

export interface FeatureLock {
  id: string;
  label: string;
  description: string;
  minPlan: "starter" | "growth" | "professional" | "enterprise";
  locked?: boolean; // Admin can toggle this to lock/unlock per feature
}

// Features locked for specific plans
// Each entry includes a clear description of what the feature provides,
// shown to users in the locked overlay and upgrade prompts.
export const FEATURE_LOCKS: FeatureLock[] = [
  // -- Growth-only features --
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Create and manage WhatsApp, email, and SMS marketing campaigns to reach your audience directly",
    minPlan: "growth",
  },
  {
    id: "coupons",
    label: "Coupons & Loyalty",
    description: "Generate discount coupons, manage loyalty tiers, and reward repeat customers automatically",
    minPlan: "growth",
  },

  // -- Professional-only features --
  {
    id: "seo-manager",
    label: "SEO Manager",
    description: "Track keyword rankings, run site audits, and optimize your product pages for search engines",
    minPlan: "professional",
  },
  {
    id: "social-media",
    label: "Social Media",
    description: "Schedule posts, track engagement, and manage all social media accounts from one dashboard",
    minPlan: "professional",
  },
  {
    id: "email-marketing",
    label: "Email Marketing",
    description: "Build automated email drip sequences, manage subscriber lists, and track open/click rates",
    minPlan: "professional",
  },
  {
    id: "ad-manager",
    label: "Ad Manager",
    description: "Create and manage paid advertising campaigns across Facebook, Instagram, and Google platforms",
    minPlan: "professional",
  },
  {
    id: "influencers",
    label: "Influencers",
    description: "Track influencer partnerships, manage collaborations, and measure ROI from influencer campaigns",
    minPlan: "professional",
  },
  {
    id: "affiliates",
    label: "Affiliates",
    description: "Run an affiliate program with tracking links, commission management, and payout automation",
    minPlan: "professional",
  },
  {
    id: "marketing-calendar",
    label: "Marketing Calendar",
    description: "Plan and schedule marketing activities on a visual calendar with team collaboration",
    minPlan: "professional",
  },
  {
    id: "wa-business",
    label: "WA Business API",
    description: "Integrate WhatsApp Business API for automated customer messaging, broadcasts, and chat support",
    minPlan: "professional",
  },
  {
    id: "ai-tools",
    label: "AI Tools",
    description: "AI-powered product descriptions, daily briefings, demand forecasting, and smart reply suggestions",
    minPlan: "professional",
  },
  {
    id: "import-export",
    label: "Import/Export",
    description: "Bulk import products from CSV/Excel, export orders and customer data in multiple formats",
    minPlan: "professional",
  },
  {
    id: "revenue-analytics",
    label: "Revenue Analytics",
    description: "Deep-dive revenue breakdowns, monthly trends, profit margins, and financial forecasting",
    minPlan: "professional",
  },
  {
    id: "traffic-analytics",
    label: "Traffic Analytics",
    description: "Monitor website traffic sources, user behavior, page views, and conversion funnels",
    minPlan: "professional",
  },

  // -- Enterprise-only features --
  {
    id: "integrations",
    label: "Custom Integrations",
    description: "Build custom API connections to third-party services like WooCommerce, accounting tools, and ERPs",
    minPlan: "enterprise",
  },
  {
    id: "sla-engine",
    label: "SLA Engine",
    description: "Define service level agreements with automated compliance tracking, escalation rules, and penalty calculations",
    minPlan: "enterprise",
  },
  {
    id: "support-tickets",
    label: "Support Tickets",
    description: "Full ticketing system with priority queues, SLA tracking, agent assignment, and response metrics",
    minPlan: "enterprise",
  },
  {
    id: "warehouse",
    label: "Warehouse Management",
    description: "Manage warehouse locations, stock transfers, bin tracking, and fulfillment operations",
    minPlan: "enterprise",
  },
  {
    id: "audit-log",
    label: "Audit Log",
    description: "Complete audit trail of all system actions with user, timestamp, and change details for compliance",
    minPlan: "enterprise",
  },
];

// Plan hierarchy - higher number = more features unlocked
export const PLAN_LEVELS: Record<string, number> = {
  starter: 0,
  growth: 1,
  professional: 2,
  enterprise: 3,
  trial: 2, // Trial has professional-level access
};

// Roles that bypass ALL feature locks (platform-level roles only).
// Brand-level roles (brand_owner, brand_admin) are restricted by their plan.
// Valtriox team members bypass all feature locks (full portal access).
const BYPASS_ROLES = new Set(["platform_owner", "platform_admin", "valtriox_team"]);

/** Check if a role bypasses feature locks (is a platform-level role) */
export function isPlatformBypassRole(roleName: string): boolean {
  return BYPASS_ROLES.has(roleName);
}

/** Check if a specific feature is available for the given plan (no role check) */
export function isFeatureAvailable(featureId: string, currentPlan: string): boolean {
  const lock = FEATURE_LOCKS.find((f) => f.id === featureId);
  if (!lock) return true; // Not locked = always available

  const currentLevel = PLAN_LEVELS[currentPlan] ?? 0;
  const requiredLevel = PLAN_LEVELS[lock.minPlan] ?? 0;

  return currentLevel >= requiredLevel;
}

/**
 * Role-aware feature check - platform roles bypass ALL locks.
 * Use this in UI components where user role is available.
 */
export function isFeatureAvailableForRole(
  featureId: string,
  currentPlan: string,
  userRole: string
): boolean {
  // Platform roles bypass ALL feature locks
  if (BYPASS_ROLES.has(userRole)) return true;
  return isFeatureAvailable(featureId, currentPlan);
}

/** Get the feature lock definition for a feature ID */
export function getFeatureLock(featureId: string): FeatureLock | undefined {
  return FEATURE_LOCKS.find((f) => f.id === featureId);
}

/** Get all features locked for a given plan */
export function getLockedFeatures(currentPlan: string): FeatureLock[] {
  const currentLevel = PLAN_LEVELS[currentPlan] ?? 0;
  return FEATURE_LOCKS.filter((f) => (PLAN_LEVELS[f.minPlan] ?? 0) > currentLevel);
}

/** Get features by plan tier */
export function getFeaturesByPlan(plan: "growth" | "professional" | "enterprise"): FeatureLock[] {
  return FEATURE_LOCKS.filter((f) => f.minPlan === plan);
}

/** Get human-readable plan name */
export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    professional: "Professional",
    enterprise: "Enterprise",
    trial: "Trial",
  };
  return names[plan] || plan;
}

/** Check if a feature is available considering admin overrides */
export function isFeatureAvailableWithOverrides(
  featureId: string,
  currentPlan: string,
  userRole: string,
  adminLockedFeatures?: Set<string>
): boolean {
  // Platform roles bypass ALL locks
  if (BYPASS_ROLES.has(userRole)) return true;

  // Admin-locked features are locked for everyone except platform roles
  if (adminLockedFeatures?.has(featureId)) return false;

  return isFeatureAvailable(featureId, currentPlan);
}

// ============================================================================
// Feature Access Map - Comprehensive feature flags per plan
// Uses PLAN_FEATURE_MATRIX from plan-limits.ts as the single source of truth
// for which features are unlocked per plan.
// ============================================================================

export interface FeatureAccess {
  marketingTools: boolean;
  advancedReports: boolean;
  customIntegrations: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  teamManagement: boolean;
  bulkOperations: boolean;
  emailMarketing: boolean;
  socialMediaManagement: boolean;
  seoTools: boolean;
  adManagement: boolean;
  flashSales: boolean;
  slaRules: boolean;
}

/**
 * Returns all feature flags for a given plan.
 * true = unlocked/available, false = locked.
 * Platform roles should use isPlatformBypassRole() before calling this.
 *
 * Drives from PLAN_FEATURE_MATRIX in plan-limits.ts for consistency,
 * ensuring both modules agree on what each plan includes.
 */
export function getFeatureAccess(plan: string): FeatureAccess {
  const unlocked = new Set(PLAN_FEATURE_MATRIX[plan] || PLAN_FEATURE_MATRIX.starter || []);

  return {
    marketingTools: unlocked.has("marketing-tools"),
    advancedReports: unlocked.has("advanced-reports"),
    customIntegrations: unlocked.has("custom-integrations"),
    apiAccess: unlocked.has("api-access"),
    prioritySupport: unlocked.has("priority-support"),
    advancedAnalytics: unlocked.has("advanced-analytics"),
    teamManagement: unlocked.has("team-management"),
    bulkOperations: unlocked.has("bulk-operations"),
    emailMarketing: unlocked.has("email-marketing"),
    socialMediaManagement: unlocked.has("social-media-management"),
    seoTools: unlocked.has("seo-tools"),
    adManagement: unlocked.has("ad-management"),
    flashSales: unlocked.has("flash-sales"),
    slaRules: unlocked.has("sla-rules"),
  };
}

/**
 * Check a single high-level feature flag for a plan.
 */
export function hasFeature(plan: string, feature: keyof FeatureAccess): boolean {
  const access = getFeatureAccess(plan);
  return access[feature] ?? false;
}
