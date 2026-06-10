"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, FileBarChart, Brain, Users, Settings, Zap } from "lucide-react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { cn } from "@/lib/utils";

interface ActionCategory {
  label: string;
  actions: {
    label: string;
    icon: any;
    section: string;
    iconBg: string;
    iconColor: string;
    hoverBg: string;
    hoverText: string;
  }[];
}

const actionCategories: ActionCategory[] = [
  {
    label: "Sell",
    actions: [
      {
        label: "New Order",
        icon: ShoppingCart,
        section: "orders",
        iconBg: "bg-gradient-to-br from-amber-100 to-amber-50",
        iconColor: "text-amber-600",
        hoverBg: "hover:bg-amber-600 hover:border-amber-600",
        hoverText: "hover:text-white",
      },
      {
        label: "Add Product",
        icon: Plus,
        section: "add-product",
        iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
        iconColor: "text-emerald-600",
        hoverBg: "hover:bg-emerald-600 hover:border-emerald-600",
        hoverText: "hover:text-white",
      },
    ],
  },
  {
    label: "Manage",
    actions: [
      {
        label: "Team",
        icon: Users,
        section: "team-management",
        iconBg: "bg-gradient-to-br from-sky-100 to-sky-50",
        iconColor: "text-sky-600",
        hoverBg: "hover:bg-sky-600 hover:border-sky-600",
        hoverText: "hover:text-white",
      },
      {
        label: "Settings",
        icon: Settings,
        section: "settings",
        iconBg: "bg-gradient-to-br from-slate-100 to-slate-50",
        iconColor: "text-slate-600",
        hoverBg: "hover:bg-slate-600 hover:border-slate-600",
        hoverText: "hover:text-white",
      },
    ],
  },
  {
    label: "Insights",
    actions: [
      {
        label: "View Reports",
        icon: FileBarChart,
        section: "sales-reports",
        iconBg: "bg-gradient-to-br from-violet-100 to-violet-50",
        iconColor: "text-violet-600",
        hoverBg: "hover:bg-violet-600 hover:border-violet-600",
        hoverText: "hover:text-white",
      },
      {
        label: "AI Assistant",
        icon: Brain,
        section: "ai-assistant",
        iconBg: "bg-gradient-to-br from-amber-100 to-orange-50",
        iconColor: "text-amber-600",
        hoverBg: "hover:bg-amber-600 hover:border-amber-600",
        hoverText: "hover:text-white",
      },
    ],
  },
];

export function QuickActions() {
  const { setActiveSection, appTheme } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";
  const isGold = appTheme === "premium-dark";

  const cardClass = isGold
    ? "bg-white/[0.03] border-white/[0.06]"
    : isDark
    ? "bg-slate-800/50 border-slate-700/50"
    : "bg-white border-slate-200";

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={cn("transition-all duration-300", cardClass)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center",
              isGold ? "bg-amber-500/10" : "bg-amber-100"
            )}>
              <Zap className={cn("w-3.5 h-3.5", isGold ? "text-amber-400" : "text-amber-600")} />
            </div>
            <CardTitle className={cn("text-base font-semibold", textPrimary)}>
              Quick Actions
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionCategories.map((category) => (
            <div key={category.label}>
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-2", textMuted)}>
                {category.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {category.actions.map((action) => (
                  <motion.div
                    key={action.label}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Button
                      variant="outline"
                      className={cn(
                        "h-auto py-3 px-3 flex-col gap-2.5 w-full transition-all duration-200 border",
                        isGold
                          ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]"
                          : isDark
                          ? "bg-white/[0.02] border-slate-700/50 hover:bg-white/[0.05]"
                          : "",
                        action.hoverBg,
                        action.hoverText,
                      )}
                      onClick={() => setActiveSection(action.section)}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                        action.iconBg,
                        action.iconColor
                      )}>
                        <action.icon className="w-4 h-4" />
                      </div>
                      <span className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-700")}>
                        {action.label}
                      </span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
