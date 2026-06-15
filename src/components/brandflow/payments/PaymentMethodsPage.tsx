"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCurrentSubscription } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Building2,
  Smartphone,
  Globe,
  Wallet,
  Copy,
  ArrowUpRight,
  Shield,
  Loader2,
  CheckCircle2,
  Banknote,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ── Types ──

interface PaymentMethod {
  name: string;
  type: string;
  supportsRecurring?: boolean;
  currency: string;
  accountNumber?: string;
  bankName?: string;
  title?: string;
}

interface PlatformSettings {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  whatsappNumber?: string;
  paymentMethods: PaymentMethod[];
  currency: string;
}

// ── Icon Map ──
const METHOD_ICONS: Record<string, any> = {
  PayPro: CreditCard,
  "Bank Transfer (HBL)": Building2,
  JazzCash: Smartphone,
  EasyPaisa: Smartphone,
  "SWIFT (International)": Landmark,
  PayPal: Wallet,
  "Wise (TransferWise)": Globe,
  Payoneer: Globe,
};

const METHOD_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  PayPro: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "text-amber-400" },
  "Bank Transfer (HBL)": { bg: "bg-sky-500/10", border: "border-sky-500/20", icon: "text-sky-400" },
  JazzCash: { bg: "bg-red-500/10", border: "border-red-500/20", icon: "text-red-400" },
  EasyPaisa: { bg: "bg-green-500/10", border: "border-green-500/20", icon: "text-green-400" },
  "SWIFT (International)": { bg: "bg-violet-500/10", border: "border-violet-500/20", icon: "text-violet-400" },
  PayPal: { bg: "bg-teal-500/10", border: "border-teal-500/20", icon: "text-teal-400" },
  "Wise (TransferWise)": { bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: "text-indigo-400" },
  Payoneer: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400" },
};

// ── Animation ──
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Currency Labels ──
const currencyLabel: Record<string, { flag: string; name: string }> = {
  PKR: { flag: "🇵🇰", name: "Pakistani Rupee" },
  USD: { flag: "🇺🇸", name: "US Dollar" },
};

// ── Main Component ──

export function PaymentMethodsPage() {
  const { appTheme, organization } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  // ── React Query: deduplicated subscription fetch ──
  const { data: subData, isLoading: subLoading } = useCurrentSubscription(organization?.id);

  const loading = subLoading;
  const platformSettings = (subData?.platformSettings ?? null) as PlatformSettings | null;
  const [processingGateway, setProcessingGateway] = useState<string | null>(null); // "paypro" | "safepay" | null

  // ── Handle "Pay Now" for Online Gateways ──
  const handlePayNow = async (method: PaymentMethod) => {
    const gatewayName = (method.name || "").toLowerCase();
    const gatewayKey = gatewayName === "paypro" ? "paypro" : null;

    if (!gatewayKey) {
      toast.info(`${method.name} payments are processed manually. Please use the account details above.`);
      return;
    }

    setProcessingGateway(gatewayKey);

    try {
      const res = await fetchWithAuth(`/api/subscriptions/${gatewayKey}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: organization?.plan || "starter", // Will be validated server-side
          billingCycle: "monthly",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.paymentUrl) {
        // Redirect to payment gateway
        toast.success(`Redirecting to ${method.name}...`);
        window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(data.error || `Failed to create ${method.name} payment order`);
      }
    } catch (err) {
      console.error(`Pay Now error (${gatewayKey}):`, err);
      toast.error(`Something went wrong. Please try again.`);
    } finally {
      setProcessingGateway(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ── Categorize payment methods ──
  const pkrMethods = (platformSettings?.paymentMethods || []).filter(
    (m) => m.currency === "PKR" || (!m.currency && !m.type?.includes("USD"))
  );
  const usdMethods = (platformSettings?.paymentMethods || []).filter(
    (m) => m.currency === "USD" || m.type?.includes("USD") || m.type?.includes("international") || m.currency?.includes("USD")
  );

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const renderMethodCard = (method: PaymentMethod) => {
    const Icon = METHOD_ICONS[method.name] || CreditCard;
    const colors = METHOD_COLORS[method.name] || { bg: "bg-slate-500/10", border: "border-slate-500/20", icon: "text-slate-400" };

    const isOnlineGateway = method.type === "online_gateway";
    const isOnline = method.type === "online";
    const isPayNowAvailable = (isOnlineGateway || isOnline) && ["paypro"].includes((method.name || "").toLowerCase());
    const isProcessing = processingGateway === (method.name || "").toLowerCase();

    return (
      <motion.div
        key={method.name}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border-2 p-5 transition-all hover:shadow-md",
          colors.border,
          isDark ? "bg-white/[0.02]" : "bg-white"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.icon)} />
            </div>
            <div>
              <h3 className={cn("font-semibold", textPrimary)}>{method.name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                {method.currency?.split(",").map((c) => {
                  const info = currencyLabel[c.trim()];
                  return (
                    <span key={c} className="text-[10px]">
                      {info?.flag || ""} {c.trim()}
                    </span>
                  );
                })}
                {method.supportsRecurring && (
                  <Badge className="text-[8px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Recurring
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account details for bank/wallet */}
        {(method.accountNumber || method.type === "bank_transfer" || method.type === "mobile_wallet") && (
          <div className={cn("mt-2 p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
            <div className="flex items-center justify-between">
              <div>
                {method.accountNumber && (
                  <p className={cn("text-sm font-mono font-medium", textPrimary)}>{method.accountNumber}</p>
                )}
                <div className={cn("flex items-center gap-2 mt-1 text-xs", textSecondary)}>
                  {method.bankName && <span>Bank: {method.bankName}</span>}
                  {method.title && <span>Title: {method.title}</span>}
                </div>
              </div>
              {method.accountNumber && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(method.accountNumber!)}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Online gateway "Pay Now" - Functional with real API */}
        {(isOnlineGateway || isOnline) && (
          <div className="mt-3">
            <Button
              className={cn(
                "w-full gap-2",
                isGold
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              )}
              size="sm"
              disabled={isProcessing}
              onClick={() => isPayNowAvailable ? handlePayNow(method) : undefined}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isPayNowAvailable ? (
                <>
                  <Banknote className="h-4 w-4" />
                  Pay Now
                  <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4" />
                  Pay Now
                  <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* SWIFT/Bank Transfer instructions */}
        {method.type === "bank_transfer" && method.currency === "USD" && (
          <div className={cn("mt-3 p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
            <p className={cn("text-xs", textSecondary)}>
              For international wire transfers, contact our finance team at{" "}
              <span className={cn("font-medium", textPrimary)}>
                {platformSettings?.companyEmail || "ashir@valtriox.com"}
              </span>{" "}
              for SWIFT/BIC code and routing details.
            </p>
          </div>
        )}

        {/* Mobile wallet instructions */}
        {method.type === "mobile_wallet" && (
          <div className={cn("mt-3 p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
            <p className={cn("text-xs", textSecondary)}>
              Send payment to the account number above via{" "}
              <span className={cn("font-medium", textPrimary)}>{method.name}</span> app or agent.
              Share screenshot via WhatsApp at{" "}
              <span className={cn("font-medium", textPrimary)}>
                {platformSettings?.whatsappNumber || platformSettings?.companyPhone || "support"}
              </span>
            </p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className={cn("p-2.5 rounded-xl bg-amber-500/10")}>
            <CreditCard className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className={cn("text-lg font-bold", textPrimary)}>Payment Methods</h2>
            <p className={cn("text-sm", textSecondary)}>
              Choose how you'd like to pay for your subscription
            </p>
          </div>
        </div>
      </div>

      {/* PKR Payment Methods */}
      {pkrMethods.length > 0 && (
        <Card className={cn(cardBg)}>
          <CardHeader>
            <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
              <span className="text-sm">🇵🇰</span> Pakistani Rupee (PKR)
            </CardTitle>
            <CardDescription className={textSecondary}>
              Bank Transfer, JazzCash, EasyPaisa & PayPro for Pakistani clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pkrMethods.map(renderMethodCard)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* USD Payment Methods */}
      {usdMethods.length > 0 && (
        <Card className={cn(cardBg)}>
          <CardHeader>
            <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
              <span className="text-sm">🇺🇸</span> US Dollar (USD) - International
            </CardTitle>
            <CardDescription className={textSecondary}>
              Payoneer, PayPal, Wise & SWIFT for international clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {usdMethods.map(renderMethodCard)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Payment Methods */}
      {!pkrMethods.length && !usdMethods.length && (
        <Card className={cn(cardBg)}>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-slate-500" />
            <p className={cn("text-sm font-medium", textPrimary)}>No payment methods configured</p>
            <p className={cn("text-xs mt-1", textSecondary)}>
              Ask your platform administrator to configure payment methods in Platform Settings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Support Info */}
      {(platformSettings?.companyPhone || platformSettings?.whatsappNumber) && (
        <div className={cn("p-4 rounded-xl border flex items-center gap-3", isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200")}>
          <Shield className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className={cn("text-sm font-medium", isDark ? "text-amber-300" : "text-amber-700")}>
              Need help with payment?
            </p>
            <p className={cn("text-xs mt-0.5", isDark ? "text-amber-400/70" : "text-amber-600")}>
              Contact us via WhatsApp at{" "}
              <span className="font-semibold">{platformSettings?.whatsappNumber || platformSettings?.companyPhone || "support"}</span>{" "}
              or email{" "}
              <span className="font-semibold">{platformSettings?.companyEmail || "ashir@valtriox.com"}</span>
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
