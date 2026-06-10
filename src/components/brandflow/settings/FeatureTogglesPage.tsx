"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Save,
  Loader2,
  ShieldCheck,
  Lock,
  Unlock,
  Zap,
  Building2,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// Feature Definitions
// ============================================================================

interface FeatureDef {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const PROFESSIONAL_FEATURES: FeatureDef[] = [
  { id: "campaigns", label: "Campaigns & Broadcasts", description: "Create and manage marketing campaigns & broadcast messages", icon: Zap },
  { id: "email-marketing", label: "Email Marketing", description: "Email campaign builder, templates, and automation", icon: MailIcon },
  { id: "seo-manager", label: "SEO Manager", description: "SEO analysis, keyword tracking, and optimization tools", icon: SearchIcon },
  { id: "social-media", label: "Social Media Manager", description: "Schedule posts, track engagement across platforms", icon: ShareIcon },
  { id: "ad-manager", label: "Ad Manager", description: "Manage paid ads across Google, Meta, and more", icon: TargetIcon },
  { id: "influencers", label: "Influencer Marketing", description: "Discover, manage, and track influencer partnerships", icon: StarIcon },
  { id: "affiliates", label: "Affiliates & Referrals", description: "Affiliate program management and referral tracking", icon: UsersIcon },
  { id: "revenue-analytics", label: "Revenue Analytics", description: "Revenue breakdown, margins, and financial reports", icon: ChartIcon },
  { id: "traffic-analytics", label: "Traffic Analytics", description: "Visitor analytics, sources, and conversion funnels", icon: GlobeIcon },
  { id: "warehouse", label: "Warehouse Management", description: "Inventory tracking, stock levels, and fulfillment", icon: BoxIcon },
  { id: "integrations", label: "Custom Integrations", description: "Connect with third-party services and platforms", icon: LinkIcon },
  { id: "ai-tools", label: "AI Tools & Assistant", description: "AI-powered writing, analysis, and automation tools", icon: SparkleIcon },
  { id: "import-export", label: "Import/Export", description: "Bulk import and export data in CSV/Excel formats", icon: DownloadIcon },
];

const ENTERPRISE_FEATURES: FeatureDef[] = [
  { id: "sla-engine", label: "SLA Engine", description: "Service level agreements, escalation rules, and deadlines", icon: ShieldIcon },
  { id: "support-tickets", label: "Support Tickets", description: "Customer support ticketing system with priority queues", icon: TicketIcon },
  { id: "wa-business", label: "WhatsApp Business API", description: "Official WhatsApp Business API integration for messaging", icon: MessageIcon },
  { id: "custom-integrations", label: "Custom API Access", description: "REST API access, webhooks, and custom integrations", icon: CodeIcon },
  { id: "audit-log", label: "Audit Log", description: "Comprehensive activity log for security and compliance", icon: FileIcon },
];

// ============================================================================
// Inline SVG Icon Components (to avoid extra dependency imports)
// ============================================================================

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  );
}
function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
  );
}
function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  );
}
function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9.5 12.5 2 2 4-4" />
    </svg>
  );
}
function TicketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  );
}
function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ============================================================================
// Main Component
// ============================================================================

export function FeatureTogglesPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockedProfessional, setLockedProfessional] = useState<string[]>([]);
  const [lockedEnterprise, setLockedEnterprise] = useState<string[]>([]);

  // ── Theme Helpers ───────────────────────────────────────────────────────

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200";
  const accentClass = "text-amber-400 bg-amber-500/10";
  const accentBtn = "bg-amber-600 text-white hover:bg-amber-700";
  const accentBorder = "border-amber-500";
  const accentText = "text-amber-400";
  const mutedBg = isDark ? "bg-white/[0.02]" : "bg-slate-50";
  const dividerColor = isDark ? "border-white/[0.06]" : "border-slate-200";

  // ============================================================================
  // Fetch Feature Toggles
  // ============================================================================

  const fetchToggles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/feature-toggles");
      if (res.ok) {
        const data = await res.json();
        setLockedProfessional(data.lockedGrowth || []);
        setLockedEnterprise(data.lockedEnterprise || []);
      } else {
        toast.error("Failed to load feature toggles");
      }
    } catch (err) {
      console.error("Failed to fetch feature toggles:", err);
      toast.error("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  // ============================================================================
  // Toggle Handlers
  // ============================================================================

  const toggleProfessionalFeature = (featureId: string) => {
    setLockedProfessional((prev) =>
      prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId]
    );
  };

  const toggleEnterpriseFeature = (featureId: string) => {
    setLockedEnterprise((prev) =>
      prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId]
    );
  };

  // ============================================================================
  // Save
  // ============================================================================

  const saveToggles = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/feature-toggles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedGrowth: lockedProfessional, lockedEnterprise }),
      });
      if (res.ok) {
        toast.success("Feature toggles saved!");
      } else {
        toast.error("Failed to save feature toggles");
      }
    } catch {
      toast.error("Failed to save feature toggles");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Stats
  // ============================================================================

  const professionalUnlocked = PROFESSIONAL_FEATURES.length - lockedProfessional.length;
  const professionalLocked = lockedProfessional.length;
  const enterpriseUnlocked = ENTERPRISE_FEATURES.length - lockedEnterprise.length;
  const enterpriseLocked = lockedEnterprise.length;

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-64 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className="grid gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className={cn("rounded-xl p-6 space-y-4", cardBg)}>
              <div className="h-6 w-48 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
              {[...Array(i === 0 ? 5 : 3)].map((_, j) => (
                <div key={j} className="h-14 bg-slate-200 dark:bg-white/[0.06] rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Feature Row Component
  // ============================================================================

  const FeatureRow = ({
    feature,
    isLocked,
    onToggle,
  }: {
    feature: FeatureDef;
    isLocked: boolean;
    onToggle: () => void;
  }) => {
    const IconComp = feature.icon;
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg transition-colors",
          isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              isLocked
                ? isDark
                  ? "bg-red-500/10"
                  : "bg-red-50"
                : isDark
                  ? "bg-amber-500/10"
                  : "bg-amber-50"
            )}
          >
            <IconComp
              className={cn(
                "h-5 w-5",
                isLocked
                  ? isDark
                    ? "text-red-400"
                    : "text-red-500"
                  : isDark
                    ? "text-amber-400"
                    : "text-amber-600"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", textPrimary)}>{feature.label}</span>
              {isLocked ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    isDark
                      ? "border-red-500/30 text-red-400 bg-red-500/10"
                      : "border-red-200 text-red-600 bg-red-50"
                  )}
                >
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  Locked
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    isDark
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-emerald-200 text-emerald-600 bg-emerald-50"
                  )}
                >
                  <Unlock className="h-2.5 w-2.5 mr-0.5" />
                  Unlocked
                </Badge>
              )}
            </div>
            <p className={cn("text-xs mt-0.5 truncate", textSecondary)}>{feature.description}</p>
          </div>
        </div>
        <Switch
          checked={!isLocked}
          onCheckedChange={onToggle}
          className="ml-4 shrink-0"
          aria-label={`Toggle ${feature.label}`}
        />
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-3", textPrimary)}>
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                isDark ? "bg-amber-500/10" : "bg-amber-50"
              )}
            >
              <ShieldCheck className={cn("h-5 w-5", accentText)} />
            </div>
            Feature Toggles
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Manage which features are available for each subscription plan. Locked features are hidden from brand owners.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchToggles}
            disabled={saving}
            variant="outline"
            className={cn("gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10")}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={saveToggles}
            disabled={saving}
            className={cn("gap-2", accentBtn)}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Professional Unlocked</p>
          <p className={cn("text-2xl font-bold mt-1", accentText)}>{professionalUnlocked}</p>
          <p className={cn("text-[10px] mt-0.5", textSecondary)}>of {PROFESSIONAL_FEATURES.length} features</p>
        </div>
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Professional Locked</p>
          <p className={cn("text-2xl font-bold mt-1", isDark ? "text-red-400" : "text-red-500")}>{professionalLocked}</p>
          <p className={cn("text-[10px] mt-0.5", textSecondary)}>features hidden</p>
        </div>
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Enterprise Unlocked</p>
          <p className={cn("text-2xl font-bold mt-1", accentText)}>{enterpriseUnlocked}</p>
          <p className={cn("text-[10px] mt-0.5", textSecondary)}>of {ENTERPRISE_FEATURES.length} features</p>
        </div>
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Enterprise Locked</p>
          <p className={cn("text-2xl font-bold mt-1", isDark ? "text-red-400" : "text-red-500")}>{enterpriseLocked}</p>
          <p className={cn("text-[10px] mt-0.5", textSecondary)}>features hidden</p>
        </div>
      </div>

      {/* ── Professional Plan Features ─────────────────────────────────── */}
      <Card className={cardBg}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  isDark ? "bg-amber-500/10" : "bg-amber-50"
                )}
              >
                <Zap className={cn("h-4.5 w-4.5", accentText)} />
              </div>
              <div>
                <CardTitle className={cn("text-base", textPrimary)}>
                  Professional Plan Features
                </CardTitle>
                <CardDescription className={textSecondary}>
                  13 features available for Professional and above subscribers
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs", accentClass)}>
              PROFESSIONAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {PROFESSIONAL_FEATURES.map((feature) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              isLocked={lockedProfessional.includes(feature.id)}
              onToggle={() => toggleProfessionalFeature(feature.id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* ── Enterprise Plan Features ────────────────────────────────────────── */}
      <Card className={cardBg}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  isDark ? "bg-amber-500/10" : "bg-amber-50"
                )}
              >
                <Building2 className={cn("h-4.5 w-4.5", accentText)} />
              </div>
              <div>
                <CardTitle className={cn("text-base", textPrimary)}>
                  Enterprise Plan Features
                </CardTitle>
                <CardDescription className={textSecondary}>
                  5 premium features exclusive to Enterprise subscribers
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs", accentClass)}>
              ENTERPRISE
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {ENTERPRISE_FEATURES.map((feature) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              isLocked={lockedEnterprise.includes(feature.id)}
              onToggle={() => toggleEnterpriseFeature(feature.id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* ── Bottom Save Bar ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "sticky bottom-0 rounded-xl p-4 flex items-center justify-between",
          cardBg,
          isDark ? "backdrop-blur-xl bg-white/[0.06] border border-white/[0.08]" : "backdrop-blur-xl bg-white/80 border border-slate-200 shadow-lg"
        )}
      >
        <p className={cn("text-sm", textSecondary)}>
          <span className={cn("font-medium", textPrimary)}>
            {professionalUnlocked + enterpriseUnlocked}
          </span>{" "}
          of {PROFESSIONAL_FEATURES.length + ENTERPRISE_FEATURES.length} features unlocked across all plans
        </p>
        <Button
          onClick={saveToggles}
          disabled={saving}
          className={cn("gap-2", accentBtn)}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </motion.div>
  );
}
