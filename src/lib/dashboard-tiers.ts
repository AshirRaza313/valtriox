// ============================================================================
// Dashboard Tier System - Progressive widget availability per plan
// ============================================================================
// Defines which dashboard widgets/features are available at each plan tier.
// Higher plans inherit all widgets from lower tiers.
//
// Tier hierarchy: starter < growth < professional < enterprise (trial = professional)
// Uses PLAN_LEVELS from feature-lock.ts for comparison.
// ============================================================================

import { PLAN_LEVELS } from "@/lib/feature-lock";

// ─── Widget Registry ─────────────────────────────────────────────────────────

export interface DashboardWidgetDef {
  id: string;
  label: string;
  icon: string;              // Lucide icon name for display
  minTier: "starter" | "growth" | "professional" | "enterprise";
  description: string;
  colSpan?: 1 | 2;          // 1 = normal, 2 = wide (spans 2 columns)
}

/** All dashboard widgets with their tier requirements */
export const ALL_WIDGETS: DashboardWidgetDef[] = [
  // ── Starter (always visible) ──
  { id: "revenue-summary", label: "Revenue Summary", icon: "DollarSign", minTier: "starter", description: "Revenue chart and order status breakdown" },
  { id: "orders-count", label: "Active Orders", icon: "ShoppingBag", minTier: "starter", description: "Order count and daily changes" },
  { id: "customers-count", label: "Customers", icon: "Users", minTier: "starter", description: "Customer count and growth" },
  { id: "recent-orders", label: "Recent Orders", icon: "Clock", minTier: "starter", description: "Latest orders list" },
  { id: "quick-stats", label: "Quick Stats", icon: "BarChart3", minTier: "starter", description: "Business overview metrics" },
  { id: "storage-usage", label: "Storage Usage", icon: "HardDrive", minTier: "starter", description: "Storage usage vs plan limit" },

  // ── Growth adds these ──
  { id: "campaign-performance", label: "Campaign Performance", icon: "Megaphone", minTier: "growth", description: "Active campaigns, reach, conversion" },
  { id: "coupon-analytics", label: "Coupon Analytics", icon: "Ticket", minTier: "growth", description: "Active coupons, redeemed count, avg discount" },
  { id: "task-progress", label: "Task Progress", icon: "ListTodo", minTier: "growth", description: "Task completion and team workload" },
  { id: "email-stats", label: "Email Stats", icon: "Mail", minTier: "growth", description: "Email marketing performance" },
  { id: "team-activity", label: "Team Activity", icon: "Activity", minTier: "growth", description: "Recent team actions" },

  // ── Professional adds these ──
  { id: "seo-metrics", label: "SEO Metrics", icon: "Search", minTier: "professional", description: "Domain authority, keywords, backlinks" },
  { id: "social-analytics", label: "Social Analytics", icon: "Share2", minTier: "professional", description: "Social media engagement stats" },
  { id: "ai-insights", label: "AI Insights", icon: "Sparkles", minTier: "professional", description: "AI-powered business suggestions" },
  { id: "marketing-calendar", label: "Marketing Calendar", icon: "CalendarDays", minTier: "professional", description: "Upcoming marketing events" },
  { id: "custom-reports", label: "Custom Reports", icon: "FileBarChart", minTier: "professional", description: "Custom report widgets" },
  { id: "advanced-charts", label: "Advanced Charts", icon: "AreaChart", minTier: "professional", description: "Advanced data visualizations" },

  // ── Enterprise adds these ──
  { id: "predictive-analytics", label: "Predictive Analytics", icon: "BrainCircuit", minTier: "enterprise", description: "AI-powered revenue forecasting" },
  { id: "sla-monitor", label: "SLA Monitor", icon: "ShieldCheck", minTier: "enterprise", description: "SLA compliance and metrics" },
  { id: "audit-log", label: "Audit Log", icon: "ScrollText", minTier: "enterprise", description: "Recent audit log entries" },
  { id: "warehouse-stats", label: "Warehouse Stats", icon: "Warehouse", minTier: "enterprise", description: "Warehouse inventory and operations" },
  { id: "revenue-forecast", label: "Revenue Forecast", icon: "TrendingUp", minTier: "enterprise", description: "Predicted revenue trends" },
];

// ─── Tier-based grouping for easy reference ────────────────────────────────

export const WIDGETS_BY_TIER = {
  starter: ALL_WIDGETS.filter((w) => w.minTier === "starter"),
  growth: ALL_WIDGETS.filter((w) => w.minTier === "growth"),
  professional: ALL_WIDGETS.filter((w) => w.minTier === "professional"),
  enterprise: ALL_WIDGETS.filter((w) => w.minTier === "enterprise"),
};

// ─── Plan hierarchy for display ───────────────────────────────────────────

export const TIER_ORDER = ["starter", "growth", "professional", "enterprise"] as const;

export const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  starter: { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/30" },
  growth: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  professional: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  enterprise: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
};

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Returns all widgets available for the given plan.
 * Starter gets only starter widgets, growth gets starter+growth, etc.
 */
export function getAvailableWidgets(plan: string): DashboardWidgetDef[] {
  const currentLevel = PLAN_LEVELS[plan] ?? 0;
  return ALL_WIDGETS.filter((w) => (PLAN_LEVELS[w.minTier] ?? 0) <= currentLevel);
}

/**
 * Returns all widgets that are LOCKED for the given plan (higher tier only).
 */
export function getLockedWidgets(plan: string): DashboardWidgetDef[] {
  const currentLevel = PLAN_LEVELS[plan] ?? 0;
  return ALL_WIDGETS.filter((w) => (PLAN_LEVELS[w.minTier] ?? 0) > currentLevel);
}

/**
 * Check if a specific widget is available for the given plan.
 */
export function isWidgetAvailable(plan: string, widgetId: string): boolean {
  const widget = ALL_WIDGETS.find((w) => w.id === widgetId);
  if (!widget) return false;
  const currentLevel = PLAN_LEVELS[plan] ?? 0;
  const requiredLevel = PLAN_LEVELS[widget.minTier] ?? 0;
  return currentLevel >= requiredLevel;
}

/**
 * Get the minimum plan required for a widget.
 */
export function getWidgetMinPlan(widgetId: string): string | undefined {
  const widget = ALL_WIDGETS.find((w) => w.id === widgetId);
  return widget?.minTier;
}

/**
 * Get the next plan tier that would unlock more widgets.
 * Returns null if already at enterprise.
 */
export function getNextPlanTier(currentPlan: string): "growth" | "professional" | "enterprise" | null {
  const currentLevel = PLAN_LEVELS[currentPlan] ?? 0;
  if (currentLevel >= 3) return null; // Already enterprise
  if (currentLevel < 1) return "growth";
  if (currentLevel < 2) return "professional";
  return "enterprise";
}

/**
 * Count how many additional widgets would be unlocked by upgrading to the given plan.
 */
export function countNewWidgetsOnUpgrade(currentPlan: string, targetPlan: string): number {
  const currentLevel = PLAN_LEVELS[currentPlan] ?? 0;
  const targetLevel = PLAN_LEVELS[targetPlan] ?? 0;
  return ALL_WIDGETS.filter(
    (w) => (PLAN_LEVELS[w.minTier] ?? 0) > currentLevel && (PLAN_LEVELS[w.minTier] ?? 0) <= targetLevel
  ).length;
}
