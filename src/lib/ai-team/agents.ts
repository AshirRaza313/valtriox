// ============================================================================
// AI Workforce Module — Agent Templates (10 Default Agents)
// ============================================================================
// These templates are used by the seed endpoint (/api/ai-team/seed) to create
// agent instances for an organization. The Owner can later customize each
// agent via the dashboard (goals, spending limits, approval requirements).
// ============================================================================

import type { AgentTemplate, AgentKey } from "./types";

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: "ceo",
    name: "CEO Agent",
    role: "Strategic Planning & Owner Liaison",
    description:
      "Summarizes company status for the Owner, prioritizes strategic initiatives, and coordinates all other agents. Escalates critical decisions to the Owner.",
    avatar: "👔",
    defaultGoals:
      "Maintain daily awareness of all business operations. Send the Owner a morning brief and end-of-day summary. Escalate anything that costs more than $500 or affects customer trust.",
    defaultConfig: {
      morningBriefHour: 9,
      endOfDaySummaryHour: 18,
      escalateThreshold: 500,
      coordinationScope: "all_agents",
    },
    defaultSpendingLimits: { daily: 1000, monthly: 10000, perAction: 500 },
    defaultApprovalRequiredActions: [
      "financial_transfer",
      "major_decision",
      "config_change",
    ],
  },
  {
    key: "operations",
    name: "Operations Agent",
    role: "Orders, Inventory & Workflow Management",
    description:
      "Manages order lifecycle, monitors inventory levels, coordinates fulfillment, and creates purchase reminders when stock runs low.",
    avatar: "📦",
    defaultGoals:
      "Process every new order within 5 minutes. Detect low inventory (below 10 units) and create purchase reminders. Notify Support Agent of any delivery delays.",
    defaultConfig: {
      lowStockThreshold: 10,
      orderProcessingTimeout: 300,
      autoCreatePurchaseReminders: true,
    },
    defaultSpendingLimits: { daily: 500, monthly: 5000, perAction: 200 },
    defaultApprovalRequiredActions: ["financial_transfer", "record_deletion"],
  },
  {
    key: "support",
    name: "Customer Support Agent",
    role: "Customer Queries, Tickets & WhatsApp Replies",
    description:
      "Handles incoming customer messages, resolves common questions automatically, escalates angry customers to the Owner immediately.",
    avatar: "🎧",
    defaultGoals:
      "Reply to customer messages within 60 seconds during business hours. Auto-resolve FAQs (shipping, returns, order status). Escalate angry or complex issues to Owner.",
    defaultConfig: {
      autoReplyEnabled: true,
      responseTimeTargetSec: 60,
      escalateKeywords: ["angry", "furious", "lawyer", "sue", "refund now"],
      escalateSentiment: "negative_strong",
    },
    defaultSpendingLimits: { daily: 100, monthly: 1000, perAction: 50 },
    defaultApprovalRequiredActions: ["financial_transfer", "record_deletion"],
  },
  {
    key: "marketing",
    name: "Marketing Agent",
    role: "Posts, Captions, Campaigns & Content Scheduling",
    description:
      "Creates social media posts, ad copy, campaign ideas, hashtags, and schedules content calendars. Coordinates with Analytics for performance.",
    avatar: "📣",
    defaultGoals:
      "Publish 3 social posts per day across channels. Suggest 1 campaign idea per week. Request campaign metrics from Analytics Agent every Monday.",
    defaultConfig: {
      postsPerDay: 3,
      campaignCadenceDays: 7,
      channels: ["instagram", "facebook", "twitter", "linkedin"],
      hashtagResearch: true,
    },
    defaultSpendingLimits: { daily: 200, monthly: 2000, perAction: 100 },
    defaultApprovalRequiredActions: ["financial_transfer", "major_decision"],
  },
  {
    key: "sales",
    name: "Sales Agent",
    role: "Lead Follow-up, Quotations & Upsell",
    description:
      "Follows up on new leads within 15 minutes, prepares quotations, suggests upsells based on customer history, and notifies CEO of high-value opportunities.",
    avatar: "💼",
    defaultGoals:
      "Respond to new leads within 15 minutes. Prepare quotations for any inquiry over $100. Suggest upsells on every order. Notify CEO of opportunities over $1000.",
    defaultConfig: {
      leadResponseTimeMin: 15,
      quotationThreshold: 100,
      highValueOpportunityThreshold: 1000,
      upsellEnabled: true,
    },
    defaultSpendingLimits: { daily: 300, monthly: 3000, perAction: 150 },
    defaultApprovalRequiredActions: ["financial_transfer"],
  },
  {
    key: "finance",
    name: "Finance Agent",
    role: "Revenue, Expenses, Invoices & Profit Estimates",
    description:
      "Tracks daily revenue and expenses, generates invoices, estimates profit margins, and alerts CEO when spending approaches limits.",
    avatar: "💰",
    defaultGoals:
      "Reconcile daily revenue and expenses. Generate invoices within 24 hours of order completion. Alert CEO when any agent's spending exceeds 80% of their daily limit.",
    defaultConfig: {
      invoiceGenerationDelayHrs: 24,
      spendingAlertThreshold: 0.8,
      profitReportCadence: "daily",
    },
    defaultSpendingLimits: { daily: 1000, monthly: 10000, perAction: 500 },
    defaultApprovalRequiredActions: [
      "financial_transfer",
      "record_deletion",
      "external_api_credential_change",
    ],
  },
  {
    key: "analytics",
    name: "Analytics Agent",
    role: "KPIs, Dashboards & Performance Reports",
    description:
      "Monitors all business KPIs in real-time, generates dashboards on demand, and proactively reports anomalies to the CEO.",
    avatar: "📊",
    defaultGoals:
      "Update KPI dashboards every 5 minutes. Detect revenue/traffic anomalies (>20% deviation) and notify CEO immediately. Generate weekly performance report every Monday.",
    defaultConfig: {
      dashboardRefreshSec: 300,
      anomalyThresholdPct: 20,
      weeklyReportDay: "monday",
      kpis: ["revenue", "orders", "conversion", "avg_order_value", "retention"],
    },
    defaultSpendingLimits: { daily: 50, monthly: 500, perAction: 50 },
    defaultApprovalRequiredActions: [],
  },
  {
    key: "content",
    name: "Content Agent",
    role: "Blogs, Product Descriptions & Announcements",
    description:
      "Writes blog posts, product descriptions, company announcements, and email newsletters. Coordinates with Marketing for distribution.",
    avatar: "✍️",
    defaultGoals:
      "Write 1 blog post per week. Generate product descriptions for any new product within 24 hours. Draft company announcements for CEO review.",
    defaultConfig: {
      blogCadenceDays: 7,
      productDescDelayHrs: 24,
      toneOfVoice: "professional_premium",
      maxWordsPerBlog: 1500,
    },
    defaultSpendingLimits: { daily: 50, monthly: 500, perAction: 50 },
    defaultApprovalRequiredActions: ["major_decision"],
  },
  {
    key: "security",
    name: "Security Agent",
    role: "Suspicious Activity & Permission Monitoring",
    description:
      "Monitors for suspicious login attempts, unusual data access patterns, and permission changes. Escalates threats to Owner immediately.",
    avatar: "🛡️",
    defaultGoals:
      "Monitor authentication logs every minute. Alert Owner within 60 seconds of any suspected breach. Audit permission changes daily.",
    defaultConfig: {
      monitorIntervalSec: 60,
      breachEscalationDelaySec: 60,
      auditPermissionsCadence: "daily",
      suspiciousPatterns: [
        "multiple_failed_logins",
        "off_hours_admin_action",
        "bulk_data_export",
      ],
    },
    defaultSpendingLimits: { daily: 0, monthly: 0, perAction: 0 },
    defaultApprovalRequiredActions: [
      "config_change",
      "external_api_credential_change",
    ],
  },
  {
    key: "developer",
    name: "Developer Agent",
    role: "Bug Fixes, Features & Maintenance",
    description:
      "Suggests bug fixes based on error logs, recommends feature improvements based on user feedback, and tracks maintenance tasks.",
    avatar: "🔧",
    defaultGoals:
      "Review error logs hourly. Suggest fixes for any recurring error (>3 occurrences in 24h). Triage user feedback into feature requests weekly.",
    defaultConfig: {
      errorLogReviewCadence: "hourly",
      recurringErrorThreshold: 3,
      feedbackTriageDay: "friday",
      autoCreateBugTasks: true,
    },
    defaultSpendingLimits: { daily: 0, monthly: 0, perAction: 0 },
    defaultApprovalRequiredActions: [
      "config_change",
      "external_api_credential_change",
      "major_decision",
    ],
  },
];

export function getTemplate(key: AgentKey): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.key === key);
}
