"use client";

import { useState } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Rocket, Building2, Star, Sparkles } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "7,999",
    period: "/month",
    setupFee: "4,999",
    icon: Rocket,
    color: "from-emerald-500 to-teal-600",
    features: [
      "Brand Dashboard (Basic)",
      "3 Marketing Channels",
      "Up to 3 Team Members",
      "100 Orders/Month",
      "50 Products",
      "5 GB Storage",
      "Business Hours Support",
      "99.5% Uptime SLA",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "14,999",
    period: "/month",
    setupFee: "9,999",
    icon: Star,
    popular: true,
    color: "from-amber-500 to-orange-600",
    features: [
      "Advanced Brand Dashboard",
      "5 Marketing Channels",
      "Up to 8 Team Members",
      "500 Orders/Month",
      "200 Products",
      "20 GB Storage",
      "Campaign Management",
      "Coupon & Loyalty Tracking",
      "Priority Support Queue",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "24,999",
    period: "/month",
    setupFee: "14,999",
    icon: Building2,
    color: "from-purple-500 to-indigo-600",
    features: [
      "Full Suite Dashboard",
      "8 Marketing Channels",
      "Up to 15 Team Members",
      "Unlimited Orders & Products",
      "50 GB Storage",
      "Full API Access",
      "Custom Branding",
      "AI-Powered Insights",
      "Priority 24/7 Support",
      "99.9% Uptime SLA",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "74,999",
    period: "/month",
    setupFee: "29,999",
    icon: Crown,
    color: "from-yellow-500 to-amber-600",
    features: [
      "AI-Powered Full Suite",
      "Unlimited Everything",
      "Dedicated Account Manager",
      "Full API + Webhooks",
      "White-Label Portal",
      "Custom Development",
      "99.99% Uptime SLA",
      "Quarterly Business Reviews",
    ],
  },
];

interface PlanSelectionOverlayProps {
  onComplete: () => void;
}

export function PlanSelectionOverlay({ onComplete }: PlanSelectionOverlayProps) {
  const { user, organization } = useValtrioxStore();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPlatformRole = user?.role === "platform_owner" || user?.role === "platform_admin";

  const handleSelectPlan = async () => {
    if (!selectedPlan || !organization?.id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/subscriptions/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: selectedPlan, orgId: organization.id }),
      });
      if (!res.ok) throw new Error("Failed to activate plan");
      onComplete();
    } catch (err) {
      console.error("Plan selection error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" /> Welcome to Valtriox
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Choose Your Plan
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Select the plan that best fits your brand. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isSelected
                    ? "ring-2 ring-amber-500 shadow-lg shadow-amber-500/20"
                    : "hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600"
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2 pt-5">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center mb-2`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">Rs. {plan.price}</span>
                    <span className="text-sm text-slate-500">{plan.period}</span>
                  </div>
                  <p className="text-xs text-slate-500">Rs. {plan.setupFee} one-time setup</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 mt-8">
          {isPlatformRole && (
            <Button variant="outline" onClick={handleSkip} className="px-8">
              Skip (Platform Access)
            </Button>
          )}
          <Button
            onClick={handleSelectPlan}
            disabled={!selectedPlan || loading}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Activating..." : `Start 14-Day Free Trial`}
          </Button>
        </div>
      </div>
    </div>
  );
}
