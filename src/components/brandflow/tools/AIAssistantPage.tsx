"use client";

import { useValtrioxStore } from "@/store/brandflow-store";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Sparkles, Package, FileText, Users } from "lucide-react";
import { EmptyState } from "@/components/brandflow/shared/EmptyState";
import { useTranslation } from "@/lib/i18n";

export function AIAssistantPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-6">
      <div>
        <h1 className={isDark ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900"}>{t("aiAssistant")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("aiUnavailableMessage")}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: "chat", label: "Chat" },
          { id: "descriptions", label: t("productDescriptionsTitle") },
          { id: "insights", label: "Customer Insights" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={isDark ? `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-amber-600 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-300"}` : `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-amber-600 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "chat" && (
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <p className="text-sm font-medium">{t("aiAssistant")}</p>
            <p className="text-xs text-slate-500 mt-2">{t("aiUnavailableMessage")}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "descriptions" && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-amber-600" /> {t("productDescriptionsTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">Product Name</label><Input placeholder="e.g., Vitamin C Brightening Serum" disabled /></div>
            <div><label className="text-sm font-medium mb-1 block">Key Features (comma separated)</label><Input placeholder="e.g., Brightens skin, Reduces dark spots" disabled /></div>
            <div><label className="text-sm font-medium mb-1 block">Tone</label>
              <div className="flex gap-2">
                {["Professional", "Friendly", "Luxury", "Playful"].map((toneName) => (
                  <button key={toneName} disabled className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 opacity-50 cursor-not-allowed">{toneName}</button>
                ))}
              </div>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700" disabled title={t("comingSoonLabel")}><Sparkles className="mr-2 h-4 w-4" /> Generate Description</Button>
            <p className="text-xs text-slate-500 pt-2">{t("aiUnavailableMessage")}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "insights" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /> Customer Behavior</CardTitle></CardHeader>
            <CardContent><EmptyState icon={Users} title={t("aiAssistant")} description={t("aiUnavailableMessage")} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-5 w-5 text-amber-500" /> Product Insights</CardTitle></CardHeader>
            <CardContent><EmptyState icon={Package} title={t("aiAssistant")} description={t("aiUnavailableMessage")} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}