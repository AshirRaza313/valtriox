"use client";

import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export function AIInsightsWidget() {
  const { appTheme } = useValtrioxStore();
  const t = useTranslation();
  const isGold = appTheme === "premium-dark";
  const isDark = appTheme === "dark" || isGold;

  const cardClass = isGold
    ? "bg-white/[0.03] border-white/[0.06]"
    : isDark
    ? "bg-white/[0.03] border-white/[0.06]"
    : "bg-white border-slate-200";

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-muted-foreground";
  const accentColor = isGold ? "text-amber-400" : "text-amber-500";
  const accentBg = isGold ? "bg-amber-500/10" : "bg-amber-100";

  return (
    <Card className={cn("transition-all duration-300", cardClass)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", accentBg)}>
            <Sparkles className={cn("h-4 w-4", accentColor)} />
          </div>
          <div>
            <p className={cn("text-xs font-semibold", textPrimary)}>{t("insightsTitle")}</p>
          </div>
        </div>
        <p className={cn("text-xs text-center py-4", textMuted)}>{t("aiUnavailableMessage")}</p>
      </CardContent>
    </Card>
  );
}