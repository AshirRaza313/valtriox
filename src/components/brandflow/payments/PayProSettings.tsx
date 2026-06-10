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
  CreditCard,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ── Types ──

interface PayProConfig {
  apiKey: string;
  merchantId: string;
  webhookUrl: string;
  environment: "sandbox" | "live";
  enabled: boolean;
}

interface TransactionRecord {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  customerName: string;
  createdAt: string;
}

// ── Animation ──
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Main Component ──

export function PayProSettings() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<PayProConfig>({
    apiKey: "",
    merchantId: "",
    webhookUrl: "",
    environment: "sandbox",
    enabled: false,
  });
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");

  // Sample transaction history
  const [transactions] = useState<TransactionRecord[]>([]);

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/payment-gateways");
      if (res.ok) {
        const data = await res.json();
        if (data.paypro) {
          setConfig({
            apiKey: data.paypro.apiKey || "",
            merchantId: data.paypro.merchantId || "",
            webhookUrl: data.paypro.webhookUrl || "",
            environment: data.paypro.environment || "sandbox",
            enabled: data.paypro.enabled || false,
          });
          if (data.paypro.enabled) {
            setConnectionStatus("connected");
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch PayPro config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/payment-gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: "paypro",
          config,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("PayPro settings saved successfully");
        setConnectionStatus(config.enabled ? "connected" : "idle");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save PayPro settings");
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
        body: JSON.stringify({ gateway: "paypro" }),
      });

      const data = await res.json();
      if (data.success) {
        setConnectionStatus("connected");
        toast.success("PayPro connection successful!");
      } else {
        setConnectionStatus("failed");
        toast.error(data.message || "PayPro connection failed.");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Could not test PayPro connection.");
    }
    setTesting(false);
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
              <div className={cn("p-2.5 rounded-xl bg-amber-500/10")}>
                <CreditCard className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className={cn("text-base", textPrimary)}>PayPro Gateway</CardTitle>
                <CardDescription className={textSecondary}>
                  Pakistani payment gateway for PKR online payments
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
          {/* API Key */}
          <div className="space-y-2">
            <Label className={cn("text-sm", textSecondary)}>API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your PayPro API key"
                value={config.apiKey}
                onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
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

          {/* Merchant ID + Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("text-sm", textSecondary)}>Merchant ID</Label>
              <Input
                placeholder="Your PayPro Merchant ID"
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

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label className={cn("text-sm", textSecondary)}>Webhook URL</Label>
            <Input
              placeholder="https://your-domain.com/api/admin/payment-gateways/paypro/webhook"
              value={config.webhookUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))}
              className={inputClass}
            />
            <p className={cn("text-xs", textSecondary)}>
              PayPro will send payment notifications to this URL
            </p>
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
              disabled={testing || !config.apiKey}
              className={cn("gap-2", isDark ? "border-white/[0.1]" : "")}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {/* Status Indicator */}
          {connectionStatus === "connected" && (
            <div className={cn("p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200")}>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className={cn("text-xs", isDark ? "text-emerald-300" : "text-emerald-700")}>
                PayPro gateway is connected and ready to process payments
              </span>
            </div>
          )}
          {connectionStatus === "failed" && (
            <div className={cn("p-3 rounded-lg border flex items-center gap-2", isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200")}>
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className={cn("text-xs", isDark ? "text-red-300" : "text-red-700")}>
                Could not connect to PayPro. Check your API key and environment settings.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className={cn(cardBg)}>
        <CardHeader>
          <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
            <Shield className="h-4 w-4 text-amber-400" />
            Recent Transactions
          </CardTitle>
          <CardDescription className={textSecondary}>
            Last 20 transactions processed via PayPro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-10 w-10 mx-auto mb-3 text-slate-500" />
              <p className={cn("text-sm", textSecondary)}>No transactions yet</p>
              <p className={cn("text-xs mt-1", textSecondary)}>
                Transactions will appear here once payments are processed through PayPro
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((tx) => (
                <div key={tx.id} className={cn("p-3 rounded-lg border flex items-center justify-between", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                  <div>
                    <p className={cn("text-sm font-medium", textPrimary)}>{tx.customerName}</p>
                    <p className={cn("text-xs", textSecondary)}>{tx.orderId}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-medium", textPrimary)}>Rs. {tx.amount.toLocaleString()}</p>
                    <Badge className={cn("text-[9px]", tx.status === "completed" ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300")}>
                      {tx.status}
                    </Badge>
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
