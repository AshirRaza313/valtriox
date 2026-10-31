"use client";

import { useEffect, useState, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, Mail, Users, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useTranslation } from "@/lib/i18n";

interface AIInsight {
  id: string;
  icon: "trending" | "mail" | "users" | "revenue";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export function AIInsightsWidget() {
  const { organization, appTheme } = useValtrioxStore();
  const t = useTranslation();
  const isGold = appTheme === "premium-dark";
  const isDark = appTheme === "dark" || isGold;

  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    const orgId = organization?.id;
    if (!orgId) {
      setInsights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/dashboard/stats?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        const contextual = generateContextualInsights(data);
        setInsights(contextual);
      } else {
        setInsights([]);
      }
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const cardClass = isGold
    ? "bg-white/[0.03] border-white/[0.06]"
    : isDark
    ? "bg-white/[0.03] border-white/[0.06]"
    : "bg-white border-slate-200";

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-muted-foreground";
  const accentColor = isGold ? "text-amber-400" : "text-amber-500";
  const accentBg = isGold ? "bg-amber-500/10" : "bg-amber-100";

  const getIconForType = (type: string) => {
    switch (type) {
      case "mail": return Mail;
      case "users": return Users;
      case "revenue":
      case "trending": return TrendingUp;
      default: return Sparkles;
    }
  };

  const getImpactStyle = (impact: string) => {
    switch (impact) {
      case "high":
        return isDark
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
          : "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "medium":
        return isDark
          ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
          : "bg-amber-50 text-amber-600 border-amber-200";
      default:
        return isDark
          ? "bg-slate-500/15 text-slate-400 border-slate-500/20"
          : "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  if (loading) {
    return (
      <Card className={cn("transition-all duration-300", cardClass)}>
        <CardContent className="flex items-center justify-center p-6">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4 animate-pulse", accentColor)} />
            <span className={cn("text-xs", textMuted)}>{t("insightsLoading")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("transition-all duration-300", cardClass)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", accentBg)}>
              <Sparkles className={cn("h-4 w-4", accentColor)} />
            </div>
            <div>
              <p className={cn("text-xs font-semibold", textPrimary)}>{t("insightsTitle")}</p>
            </div>
          </div>
          <button
            onClick={fetchInsights}
            className={cn("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-white/[0.06]" : "hover:bg-slate-100")}
          >
            <RefreshCw className={cn("h-3 w-3", textMuted)} />
          </button>
        </div>

        {insights.length === 0 ? (
          <p className={cn("text-xs text-center py-4", textMuted)}>{t("aiUnavailableMessage")}</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {insights.map((insight) => {
              const Icon = getIconForType(insight.icon);
              return (
                <div
                  key={insight.id}
                  className={cn("p-2.5 rounded-lg flex gap-2.5", isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-slate-50")}
                >
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0", accentBg)}>
                    <Icon className={cn("h-3.5 w-3.5", accentColor)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={cn("text-xs font-medium", textPrimary)}>{insight.title}</p>
                      <span className={cn(
                        "text-[9px] px-1.5 py-px rounded-full border font-medium capitalize",
                        getImpactStyle(insight.impact)
                      )}>
                        {insight.impact}
                      </span>
                    </div>
                    <p className={cn("text-[10px] leading-relaxed", textMuted)}>{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function generateContextualInsights(stats: any): AIInsight[] {
  const insights: AIInsight[] = [];

  if (stats?.customerCount > 0 && stats?.conversionRate < 3) {
    insights.push({
      id: "conv-low",
      icon: "trending",
      title: "Low Conversion Rate",
      description: `Your ${stats.conversionRate}% conversion rate is below average. Consider optimizing your checkout flow and product pages.`,
      impact: "high",
    });
  }

  if (stats?.lowStockProducts > 3) {
    insights.push({
      id: "low-stock",
      icon: "revenue",
      title: `${stats.lowStockProducts} Products Low on Stock`,
      description: "Restock soon to avoid missed sales. Low stock items are often best-sellers.",
      impact: "high",
    });
  }

  if (stats?.newCustomers > 0 && stats?.newCustomers < 5) {
    insights.push({
      id: "growth",
      icon: "users",
      title: "Grow Your Customer Base",
      description: "Email campaigns and referral programs are proven ways to acquire new customers cost-effectively.",
      impact: "medium",
    });
  }

  if (stats?.totalRevenue > 0) {
    insights.push({
      id: "revenue-up",
      icon: "mail",
      title: "Email Revenue Opportunity",
      description: "Brands using email marketing see 15-30% higher revenue. Start a weekly newsletter to stay top-of-mind.",
      impact: "medium",
    });
  }

  return insights;
}