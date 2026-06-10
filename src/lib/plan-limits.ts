// ============================================================================
// Plan-Based Usage Limits Configuration
// ============================================================================
// Defines resource limits for each subscription tier.
// Used by usage-stats API route and UI components to enforce plan restrictions.
//
// Plans (Revised Pricing Strategy 2026 - Mass Market + Setup Fee Model):
//   "starter"       = Rs 7,999/month    + Rs 4,999 one-time setup
//   "growth"         = Rs 14,999/month   + Rs 9,999 one-time setup
//   "professional"   = Rs 24,999/month  + Rs 14,999 one-time setup
//   "enterprise"     = Rs 74,999+/month  + Rs 29,999+ one-time setup
//
// Fixed Monthly Tool Cost: Rs 48,440 (Vercel Pro, Supabase Pro, Resend Pro,
//   Calendly Standard, WhatsApp Business API, Sentry Team, Cloudflare Pro)
//   -> 1 Enterprise client or 2 Professional clients covers full cost
//   -> Setup fees provide immediate upfront revenue per client
//
// All plans include 14-day free trial.
// Annual billing: 20% discount | Quarterly billing: 10% discount
// ============================================================================

// --- Fixed Platform Costs ---

/** Monthly tool cost - Vercel Pro + Supabase Pro + Resend + Calendly + WA API + Sentry + Cloudflare */
export const FIXED_MONTHLY_COST = 48440;

// --- Plan Interface ---

export interface PlanLimits {
  // Team
  teamMembers: number;       // -1 = unlimited

  // Orders & Products
  ordersPerMonth: number;    // -1 = unlimited
  products: number;          // -1 = unlimited
  customers: number;          // -1 = unlimited

  // Marketing
  marketingChannels: number;
  campaigns: number;
  emailsPerMonth: number;
  socialAccounts: number;
  coupons: number;

  // Operations
  tasks: number;
  tickets: number;

  // Integrations
  integrations: number;      // -1 = unlimited

  // Storage
  storageGb: number;         // -1 = unlimited

  // Analytics
  reports: number;           // -1 = unlimited

  // Support & SLA
  supportLevel: 'business_hours' | 'priority_247' | 'dedicated_manager';
  sla: number;               // percentage (99.5, 99.9, 99.99)

  // API & Branding
  apiAccess: 'none' | 'read' | 'full' | 'full_webhooks';
  customBranding: boolean;
  whiteLabel: boolean;

  // Billing
  invoices: number;
  paymentMethods: number;
}

// --- Feature Matrix ---
// A simple boolean map showing which features are unlocked per plan.
// Used by getFeatureAccess() in feature-lock.ts and UI components.

export interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  category: 'marketing' | 'analytics' | 'operations' | 'branding' | 'api' | 'support';
}

export const FEATURE_MATRIX: FeatureFlag[] = [
  // Marketing
  { id: 'marketing-tools', label: 'Marketing Tools', description: 'Campaigns, coupons & loyalty programs', category: 'marketing' },
  { id: 'advanced-reports', label: 'Advanced Reports', description: 'Revenue, traffic & product analytics', category: 'analytics' },
  { id: 'custom-integrations', label: 'Custom Integrations', description: 'Third-party API connections', category: 'branding' },
  { id: 'api-access', label: 'API Access', description: 'REST API for external tools', category: 'api' },
  { id: 'priority-support', label: 'Priority Support', description: '24/7 dedicated account manager', category: 'support' },
  { id: 'advanced-analytics', label: 'Advanced Analytics', description: 'AI insights & predictive analytics', category: 'analytics' },
  { id: 'team-management', label: 'Team Management', description: 'Roles, attendance & payroll', category: 'operations' },
  { id: 'bulk-operations', label: 'Bulk Operations', description: 'Import/export & batch processing', category: 'operations' },
  { id: 'email-marketing', label: 'Email Marketing', description: 'Automated email campaigns & drip sequences', category: 'marketing' },
  { id: 'social-media-management', label: 'Social Media Management', description: 'Post scheduling, analytics & multi-platform management', category: 'marketing' },
  { id: 'seo-tools', label: 'SEO Tools', description: 'Keyword tracking, site audits & SEO optimization', category: 'marketing' },
  { id: 'ad-management', label: 'Ad Management', description: 'Create & manage paid ad campaigns across platforms', category: 'marketing' },
  { id: 'flash-sales', label: 'Flash Sales', description: 'Time-limited promotional sale events', category: 'marketing' },
  { id: 'sla-rules', label: 'SLA Rules', description: 'Service level agreements with automated enforcement', category: 'operations' },
];

// --- Plan Feature Matrix ---
// A clear mapping of each plan to a list of available feature IDs.
// Used by feature-lock.ts, UI components, and welcome notifications.

export const PLAN_FEATURE_MATRIX: Record<string, string[]> = {
  starter: [
    // Core features only - no premium features
    'marketing-tools',
    'team-management',
  ],
  growth: [
    // Growth tier - marketing basics
    'marketing-tools',
    'team-management',
    'email-marketing',
    'social-media-management',
  ],
  professional: [
    // Professional tier - full marketing + analytics + team
    'marketing-tools',
    'advanced-reports',
    'api-access',
    'priority-support',
    'advanced-analytics',
    'team-management',
    'bulk-operations',
    'email-marketing',
    'social-media-management',
    'seo-tools',
    'ad-management',
    'flash-sales',
  ],
  enterprise: [
    // Enterprise tier - everything unlocked
    'marketing-tools',
    'advanced-reports',
    'custom-integrations',
    'api-access',
    'priority-support',
    'advanced-analytics',
    'team-management',
    'bulk-operations',
    'email-marketing',
    'social-media-management',
    'seo-tools',
    'ad-management',
    'flash-sales',
    'sla-rules',
  ],
};

/**
 * Returns a map of feature ID to boolean for a given plan.
 * true = unlocked, false = locked.
 * Drives from PLAN_FEATURE_MATRIX for consistency.
 */
export function getPlanFeatureMatrix(plan: string): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  const allFeatures = FEATURE_MATRIX.map((f) => f.id);
  const unlocked = PLAN_FEATURE_MATRIX[plan] || PLAN_FEATURE_MATRIX.starter;
  const unlockedSet = new Set(unlocked);
  for (const f of allFeatures) {
    m[f] = unlockedSet.has(f);
  }
  return m;
}

/**
 * Returns a FeatureAccess object with all feature flags for a given plan.
 * true = unlocked/available, false = locked.
 * Mirrors the interface from feature-lock.ts but lives in plan-limits.ts
 * as the single source of truth for feature availability.
 */
export function getFeatureAccess(plan: string): Record<string, boolean> {
  return getPlanFeatureMatrix(plan);
}

// --- Plan Tier Definitions ---

const STARTER_LIMITS: PlanLimits = {
  teamMembers: 3,
  ordersPerMonth: 100,
  products: 50,
  customers: 100,
  marketingChannels: 3,
  campaigns: 0,
  emailsPerMonth: 500,
  socialAccounts: 3,
  coupons: 5,
  tasks: 20,
  tickets: 0,
  integrations: 2,
  storageGb: 5,
  reports: 5,
  supportLevel: 'business_hours',
  sla: 99.5,
  apiAccess: 'read',
  customBranding: false,
  whiteLabel: false,
  invoices: 10,
  paymentMethods: 2,
};

const GROWTH_LIMITS: PlanLimits = {
  teamMembers: 8,
  ordersPerMonth: 500,
  products: 200,
  customers: 500,
  marketingChannels: 5,
  campaigns: 5,
  emailsPerMonth: 2000,
  socialAccounts: 5,
  coupons: 15,
  tasks: 100,
  tickets: 3,
  integrations: 5,
  storageGb: 20,
  reports: 20,
  supportLevel: 'business_hours',
  sla: 99.5,
  apiAccess: 'read',
  customBranding: false,
  whiteLabel: false,
  invoices: -1,       // unlimited
  paymentMethods: 3,
};

const PROFESSIONAL_LIMITS: PlanLimits = {
  teamMembers: 15,
  ordersPerMonth: -1,  // unlimited
  products: -1,         // unlimited
  customers: -1,        // unlimited
  marketingChannels: 8,
  campaigns: 10,
  emailsPerMonth: 5000,
  socialAccounts: 8,
  coupons: 25,
  tasks: -1,            // unlimited
  tickets: 5,
  integrations: 10,
  storageGb: 50,
  reports: -1,          // unlimited
  supportLevel: 'priority_247',
  sla: 99.9,
  apiAccess: 'full',
  customBranding: true,
  whiteLabel: false,
  invoices: -1,         // unlimited
  paymentMethods: 5,
};

const ENTERPRISE_LIMITS: PlanLimits = {
  teamMembers: -1,    // unlimited
  ordersPerMonth: -1,
  products: -1,
  customers: -1,
  marketingChannels: -1,
  campaigns: -1,
  emailsPerMonth: -1,
  socialAccounts: -1,
  coupons: -1,
  tasks: -1,
  tickets: -1,
  integrations: -1,
  storageGb: -1,       // unlimited
  reports: -1,
  supportLevel: 'dedicated_manager',
  sla: 99.99,
  apiAccess: 'full_webhooks',
  customBranding: true,
  whiteLabel: true,
  invoices: -1,
  paymentMethods: -1,
};

// --- Plan Registry ---

const PLAN_LIMITS_MAP: Record<string, PlanLimits> = {
  starter: STARTER_LIMITS,
  growth: GROWTH_LIMITS,
  professional: PROFESSIONAL_LIMITS,
  enterprise: ENTERPRISE_LIMITS,
};

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
};

export const PLAN_PRICING = {
  starter: {
    monthly: 7999,
    quarterly: Math.round(7999 * 3 * 0.9),     // 10% off = 21,597
    annual: Math.round(7999 * 12 * 0.8),       // 20% off = 76,790
    setupFee: 4999,
  },
  growth: {
    monthly: 14999,
    quarterly: Math.round(14999 * 3 * 0.9),     // 10% off = 40,497
    annual: Math.round(14999 * 12 * 0.8),      // 20% off = 143,990
    setupFee: 9999,
  },
  professional: {
    monthly: 24999,
    quarterly: Math.round(24999 * 3 * 0.9),     // 10% off = 67,497
    annual: Math.round(24999 * 12 * 0.8),      // 20% off = 239,990
    setupFee: 14999,
  },
  enterprise: {
    monthly: 74999,
    quarterly: null,                 // custom
    annual: null,                    // custom
    setupFee: 29999,
  },
};

// --- Plan Feature Lists ---
// Human-readable feature lists used in welcome notifications and UI

export const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Up to 3 team members',
    '100 orders per month',
    '50 product listings',
    'Basic analytics dashboard',
    'Email support (business hours)',
    '14-day free trial',
  ],
  growth: [
    'Up to 8 team members',
    '500 orders per month',
    '200 product listings',
    'Marketing tools (campaigns, coupons)',
    'Advanced reporting',
    'Email support (business hours)',
    '14-day free trial',
  ],
  professional: [
    'Up to 15 team members',
    'Unlimited orders',
    'Unlimited products',
    'Full marketing suite',
    'Advanced analytics & AI insights',
    'Custom branding',
    'Priority 24/7 support',
    'Full API access',
    'Bulk operations (import/export)',
    '14-day free trial',
  ],
  enterprise: [
    'Unlimited team members',
    'Unlimited orders & products',
    'All professional features',
    'Custom integrations',
    'White-label branding',
    'Dedicated account manager',
    'Priority 24/7 support',
    'Full API with webhooks',
    'Custom SLA (99.99%)',
    '14-day free trial',
  ],
};

// --- Exported Functions ---

/**
 * Get the plan limits for a given plan name.
 * Falls back to Starter limits for unknown plans.
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS_MAP[plan] || STARTER_LIMITS;
}

/**
 * Check if the current usage is within the plan's limit.
 * Returns true if the usage is within limits (allowed).
 * For unlimited limits (-1), always returns true.
 */
export function checkLimit(usage: number, limit: number): boolean {
  if (limit === -1) return true; // unlimited
  return usage < limit;
}

/**
 * Get usage as a percentage of the limit.
 * Returns 0-100 for limited resources, or -1 for unlimited.
 */
export function getUsagePercent(usage: number, limit: number): number {
  if (limit === -1) return -1; // unlimited
  if (limit === 0) return 100;
  return Math.min(100, Math.round((usage / limit) * 100));
}

/**
 * Get a human-readable label showing usage vs limit.
 * e.g. "50/500", "50/Unlimited"
 */
export function getLimitLabel(usage: number, limit: number): string {
  if (limit === -1) return `${usage}/unlimited`;
  return `${usage}/${limit}`;
}

/**
 * Check if the usage has reached or exceeded the plan limit.
 * Returns true if the user is at or over the limit (blocked).
 */
export function isAtLimit(usage: number, limit: number): boolean {
  if (limit === -1) return false; // unlimited - never at limit
  return usage >= limit;
}

/**
 * Get the display name for a plan.
 */
export function getPlanDisplayName(plan: string): string {
  return PLAN_NAMES[plan] || plan.charAt(0).toUpperCase() + plan.slice(1);
}

/**
 * Check if a role bypasses plan limits (unlimited resources).
 * Platform-level roles get unlimited everything.
 */
export function isUnlimitedRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin" || role === "valtriox_team";
}

/**
 * Get effective plan limits - returns unlimited (-1) for bypass roles.
 */
export function getEffectivePlanLimits(plan: string, role: string): PlanLimits {
  if (isUnlimitedRole(role)) {
    return {
      teamMembers: -1,
      ordersPerMonth: -1,
      products: -1,
      customers: -1,
      marketingChannels: -1,
      campaigns: -1,
      emailsPerMonth: -1,
      socialAccounts: -1,
      coupons: -1,
      tasks: -1,
      tickets: -1,
      integrations: -1,
      storageGb: -1,
      reports: -1,
      supportLevel: 'dedicated_manager',
      sla: 99.99,
      apiAccess: 'full_webhooks',
      customBranding: true,
      whiteLabel: true,
      invoices: -1,
      paymentMethods: -1,
    };
  }
  return getPlanLimits(plan);
}
