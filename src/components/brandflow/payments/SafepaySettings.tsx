"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Globe,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  Eye,
  EyeOff,
  RefreshCw,
  Link2,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ── Types ──

interface SafepayConfig {
  payoneerEmail: string;
  secretKey: string;
  merchantId: string;
  webhookSecret: string;
  webhookUrl: string;
  environment: "sandbox" | "live";
  enabled: boolean;
}

interface PlanMapping {
  planId: string;
  planName: string;
  payoneerTierId: string;
  linked: boolean;
}

interface SubscriptionClient {
  id: string;
  orgName: string;
  plan: string;
  status: string;
  nextBilling: string;
}

// ── Animation ──
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Main Component ──

export function SafepaySettings() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");

  const [config, setConfig] = useState<SafepayConfig>({
    payoneerEmail: "",
    secretKey: "",
    merchantId: "",
    webhookSecret: "",
    webhookUrl: "",
    environment: "sandbox",
    enabled: false,
  });

  // Plan linking
  const [planMappings, setPlanMappings] = useState<PlanMapping[]>([
    { planId: "starter", planName: "Starter", payoneerTierId: "", linked: false },
    { planId: "growth", planName: "Growth", payoneerTierId: "", linked: false },
    { planId: "professional", planName: "Professional", payoneerTierId: "", linked: false },
    { planId: "enterprise", planName: "Enterprise", payoneerTierId: "", linked: false },
  ]);

  // Sample client subscription status
  const [clientSubs] = useState<SubscriptionClient[]>([]);

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/payment-gateways");
      if (res.ok) {
        const data = await res.json();
        if (data.safepay) {
          setConfig({
            payoneerEmail: data.safepay.apiKey || data.safepay.payoneerEmail || "",
            secretKey: data.safepay.secretKey || "",
            merchantId: data.safepay.merchantId || "",
            webhookSecret: data.safepay.webhookSecret || "",
            webhookUrl: data.safepay.webhookUrl || "",
            environment: data.safepay.environment || "sandbox",
            enabled: data.safepay.enabled || false,
          });
          // Restore saved plan mappings
          if (data.safepay.planMappings && Array.isArray(data.safepay.planMappings)) {
            setPlanMappings(data.safepay.planMappings);
          }
          if (data.safepay.enabled) {
            setConnectionStatus("connected");
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch Payoneer config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Save (includes plan mappings) ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/payment-gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: "safepay",
          config: {
            ...config,
            planMappings, // Persist plan mappings with the config
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Payoneer settings saved successfully");
        setConnectionStatus(config.enabled ? "connected" : "idle");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save Payoneer settings");
    }
    setSaving(false);
  };

  // ── Test Connection (Server-Side to avoid CORS) ──
  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const res = await fetchWithAuth("/api/admin/payment-gateways/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: "safepay" }),
      });

      const data = await res.json();
      if (data.success) {
        setConnectionStatus("connected");
        toast.success("Payoneer connection successful!");
      } else {
        setConnectionStatus("failed");
        toast.error(data.message || "Payoneer connection failed.");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Could not test Payoneer connection.");
    }
    setTesting(false);
  };

  // ── Update plan mapping ──
  const updatePlanMapping = (planId: string, tierId: string) => {
    setPlanMappings((prev) =>
      prev.map((pm) =>
        pm.planId === planId
          ? { ...pm, payoneerTierId: tierId, linked: tierId.length > 0 }
          : pm
      )
    );
  };

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = isDark ? "border-white/[0.1] bg-white/[0.03]" : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header Card */}
      <Card className={cn(cardBg)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl bg-emerald-500/10")}>
                <Globe className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className={cn("text-base", textPrimary)}>Payoneer Gateway</CardTitle>
                <CardDescription className={textSecondary}>
                  Best for Pakistani SaaS - supports recurring subscriptions & international USD payments
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={cn(
                connectionStatus === "connected" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                connectionStatus === "failed" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                "bg-slate-500/20 text-slate-400 border-slate-500/30"
              )}>
                <Activity className="h-3 w-3 mr-1" />
                {connectionStatus === "connected" ? "Connected" : connectionStatus === "failed" ? "Failed" : "Idle"}
              </Badge>
              <div className="flex items-center gap-2">
                <Label className={cn("text-sm", textSecondary)}>Enabled</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* API Key + Secret Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="your-business@payoneer.com"
                  value={config.payoneerEmail}
                  onChange={(e) => setConfig((prev) => ({ ...prev, payoneerEmail: e.target.value }))}
                  className={cn("pr-10", inputClass)}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Secret Key</Label>
              <div className="relative">
                <Input
                  type={showSecretKey ? "text" : "password"}
                  placeholder="Payoneer secret key"
                  value={config.secretKey}
                  onChange={(e) => setConfig((prev) => ({ ...prev, secretKey: e.target.value }))}
                  className={cn("pr-10", inputClass)}
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Merchant ID + Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Merchant ID</Label>
              <Input
                placeholder="Your Payoneer Merchant ID"
                value={config.merchantId}
                onChange={(e) => setConfig((prev) => ({ ...prev, merchantId: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Environment</Label>
              <Select
                value={config.environment}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, environment: v as "sandbox" | "live" }))}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400" /> Sandbox
                    </span>
                  </SelectItem>
                  <SelectItem value="live">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" /> Live
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Webhook Secret + Webhook URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Webhook Secret</Label>
              <Input
                placeholder="Payoneer webhook secret for signature verification"
                value={config.webhookSecret}
                onChange={(e) => setConfig((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Webhook URL</Label>
              <Input
                placeholder="https://your-domain.com/api/admin/payment-gateways/safepay/webhook"
                value={config.webhookUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <Separator className={isDark ? "bg-white/[0.06]" : "bg-slate-200"} />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "gap-2",
                isGold
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config.payoneerEmail}
              className={cn("gap-2", isDark ? "border-white/[0.1]" : "")}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {/* Status */}
          {connectionStatus === "connected" && (
            <div className={cn("p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200")}>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className={cn("text-xs", isDark ? "text-emerald-300" : "text-emerald-700")}>
                Payoneer gateway is connected. Recurring billing and international payments are ready.
              </span>
            </div>
          )}
          {connectionStatus === "failed" && (
            <div className={cn("p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200")}>
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className={cn("text-xs", isDark ? "text-red-300" : "text-red-700")}>
                Could not connect to Payoneer. Check your API key and environment settings.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Plan Linking */}
      <Card className={cn(cardBg)}>
        <CardHeader>
          <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
            <Link2 className="h-4 w-4 text-emerald-400" />
            Subscription Plan Linking
          </CardTitle>
          <CardDescription className={textSecondary}>
            Map each Valtriox plan to a Payoneer subscription tier for automated recurring billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {planMappings.map((pm) => (
              <div key={pm.planId} className={cn(
                "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold capitalize",
                    pm.linked
                      ? isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                      : isDark ? "bg-slate-500/20 text-slate-400" : "bg-slate-100 text-slate-500"
                  )}>
                    {pm.planName}
                  </div>
                  <Badge className={cn("text-[9px]", pm.linked ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400")}>
                    {pm.linked ? "Linked" : "Unlinked"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Payoneer tier ID"
                    value={pm.payoneerTierId}
                    onChange={(e) => updatePlanMapping(pm.planId, e.target.value)}
                    className={cn("text-sm h-8", inputClass)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={cn("mt-4 p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200")}>
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <span className={cn("text-xs", isDark ? "text-amber-300" : "text-amber-700")}>
              Plan linking is saved as part of the gateway configuration. Save changes to apply.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Client Subscription Status */}
      <Card className={cn(cardBg)}>
        <CardHeader>
          <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
            <Users className="h-4 w-4 text-amber-400" />
            Client Subscription Status
          </CardTitle>
          <CardDescription className={textSecondary}>
            View Payoneer subscription status for each client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientSubs.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-10 w-10 mx-auto mb-3 text-slate-500" />
              <p className={cn("text-sm", textSecondary)}>No client subscriptions yet</p>
              <p className={cn("text-xs mt-1", textSecondary)}>
                Client subscription data will appear here once Payoneer recurring billing is active
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clientSubs.map((client) => (
                <div key={client.id} className={cn("p-3 rounded-lg border flex items-center justify-between", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                  <div>
                    <p className={cn("text-sm font-medium", textPrimary)}>{client.orgName}</p>
                    <p className={cn("text-xs", textSecondary)}>{client.plan}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={cn("text-[9px]",
                      client.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                      client.status === "past_due" ? "bg-red-500/20 text-red-300" :
                      "bg-yellow-500/20 text-yellow-300"
                    )}>
                      {client.status === "active" ? "Active" : client.status === "past_due" ? "Past Due" : "Trial"}
                    </Badge>
                    <p className={cn("text-xs mt-1", textSecondary)}>{client.nextBilling}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
