"use client";

import { useState } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { cn } from "@/lib/utils";
import { CreditCard, Globe, Shield, Lock } from "lucide-react";
import { PayProSettings } from "./PayProSettings";
import { SafepaySettings as PayoneerSettings } from "./SafepaySettings";

// ── Tab Definition ──

interface GatewayTab {
  id: string;
  label: string;
  icon: any;
  color: { bg: string; active: string; text: string; border: string };
}

const GATEWAY_TABS: GatewayTab[] = [
  {
    id: "paypro",
    label: "PayPro",
    icon: CreditCard,
    color: { bg: "bg-amber-500/10", active: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/30" },
  },
  {
    id: "payoneer",
    label: "Payoneer",
    icon: Globe,
    color: { bg: "bg-emerald-500/10", active: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30" },
  },
];

// ── Main Component ──

export function PaymentGatewaysPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [activeTab, setActiveTab] = useState("paypro");

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className={cn("p-2.5 rounded-xl", isGold ? "bg-amber-500/10" : "bg-amber-500/10")}>
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className={cn("text-lg font-bold", textPrimary)}>Payment Gateways</h2>
            <p className={cn("text-sm", textSecondary)}>
              Configure PayPro and Payoneer gateway integrations
            </p>
          </div>
        </div>
        <div className={cn("mt-3 p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200")}>
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <span className={cn("text-xs", isDark ? "text-amber-300" : "text-amber-700")}>
            Gateway credentials are encrypted and masked in transit. Only platform administrators can view or modify these settings.
          </span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className={cn(
        "flex gap-1 p-1 rounded-xl border",
        isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-100 border-slate-200"
      )}>
        {GATEWAY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const colors = tab.color;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center",
                isActive
                  ? isGold
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md"
                    : cn(colors.bg, colors.text, "border", colors.border)
                  : isDark
                    ? "text-slate-400 hover:text-slate-300 hover:bg-white/[0.05]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {isActive && !isGold && (
                <span className={cn("ml-1 w-1.5 h-1.5 rounded-full", colors.active)} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "paypro" && <PayProSettings />}
      {activeTab === "payoneer" && <PayoneerSettings />}
    </div>
  );
}
