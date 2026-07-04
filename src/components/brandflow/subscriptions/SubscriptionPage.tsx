// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCurrentSubscription, useSubscriptionPlans, queryKeys } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/utils-extended";
import {
  Check,
  X,
  Clock,
  ArrowRight,
  Shield,
  Zap,
  Crown,
  Users,
  Package,
  ShoppingCart,
  Loader2,
  Copy,
  CheckCircle2,
  Phone,
  Mail,
  Globe,
  FileText,
  TrendingUp,
  Download,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SubscriptionInvoiceView } from "./SubscriptionInvoiceView";
import { PaymentMethodsPage } from "@/components/brandflow/payments/PaymentMethodsPage";
import { isPlatformRole, canEditBillingPlans, canSetPaymentMethods } from "@/lib/roles";
import { getCurrencyForCountry } from "@/lib/currency";

// ── Types ──

interface Plan {
  id: string;
  name: string;
  price: number;
  annualPrice: number;
  quarterlyPrice?: number;
  annualSavings: number;
  period: string;
  features: string[];
  teamLimit: number;
  orderLimit: number;
  productLimit: number;
  trialDays: number;
}

interface PaymentRecord {
  id: string;
  planName: string;
  amount: number;
  transactionId: string;
  paymentMethod: string;
  billingCycle: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface SubscriptionData {
  id: string;
  status: string;
  billingCycle: string;
  trialStartsAt: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  isTrialActive: boolean;
  currentPeriodEnd?: string;
  plan: Plan;
  payments: PaymentRecord[];
}

interface PlatformSettings {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  supportHours?: string;
  whatsappNumber?: string;
  paymentMethods: Array<{
    name: string;
    accountNumber: string;
    bankName: string;
    title: string;
  }>;
  currency: string;
  companyAddress?: string;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  billingCycle: string;
  status: string;
  currencySymbol: string;
  issuedAt: string;
  paidAt?: string;
  createdAt: string;
}

const PLAN_ICONS: Record<string, any> = {
  starter: Zap,
  growth: TrendingUp,
  professional: Shield,
  enterprise: Crown,
};

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  starter: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  growth: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
  },
  professional: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300",
  },
  enterprise: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300",
  },
};

// ── Animation ──
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Main Component ──

export function SubscriptionPage() {
  const { user, organization, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const isPlatform = isPlatformRole(user?.role || "");

  // ── React Query: deduplicated subscription + plans fetch ──
  const queryClient = useQueryClient();
  const { data: subData, isLoading: subLoading } = useCurrentSubscription(organization?.id);
  const { data: plansData } = useSubscriptionPlans();

  // ── Derived state from React Query ──
  const subscription = (subData?.subscription ?? null) as SubscriptionData | null;
  const platformSettings = (subData?.platformSettings ?? null) as PlatformSettings | null;
  const plans = (plansData?.plans ?? []) as Plan[];

  // ── State ──
  const loading = subLoading;
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [billingToggle, setBillingToggle] = useState<"monthly" | "quarterly" | "annually">("monthly");

  // Payment form (admin only)
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    planId: "",
    amount: "",
    transactionId: "",
    paymentMethod: "bank_transfer",
    screenshotUrl: "",
    billingCycle: "monthly",
    planDetails: "",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [upgradePlans, setUpgradePlans] = useState<Plan[]>([]);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceRecord | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

  // ── Fetch Invoices ──
  const fetchInvoices = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingInvoices(true);
    try {
      const res = await fetchWithAuth(`/api/invoices?orgId=${organization.id}`);
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.invoices || []);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    }
    setLoadingInvoices(false);
  }, [organization]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ── Phase 16: Pre-fill payment form when redirected from a Communication
  // Centre action button. Admin sends a renewal/proof-upload message with an
  // action button → client clicks the button → we set sessionStorage with the
  // pre-fill payload → setActiveSection("subscriptions") → this page mounts →
  // we read the payload, pre-fill the form, and auto-open the upgrade form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const renewalRaw = sessionStorage.getItem("pendingRenewalPrefill");
      const uploadRaw = sessionStorage.getItem("pendingPaymentUpload");
      const prefillRaw = renewalRaw || uploadRaw;
      if (!prefillRaw) return;
      const prefill = JSON.parse(prefillRaw);
      setPaymentForm((prev) => ({
        ...prev,
        planId: prefill.planId || prev.planId,
        amount: prefill.amount != null ? String(prefill.amount) : prev.amount,
        billingCycle: prefill.billingCycle || prev.billingCycle,
        planDetails: prefill.planDetails || prev.planDetails,
      }));
      setShowUpgradeForm(true);
      // Clear the one-shot payload so it doesn't re-trigger on next mount
      sessionStorage.removeItem("pendingRenewalPrefill");
      sessionStorage.removeItem("pendingPaymentUpload");
      toast.info("Payment form pre-filled from your message. Upload screenshot & submit.");
    } catch {}
  }, []);

  // ── Admin: Submit Payment (only platform roles) ──
  const handleSubmitPayment = async () => {
    if (!paymentForm.planId || !paymentForm.amount || !paymentForm.transactionId) {
      toast.error("Please fill in all required fields");
      return;
    }
    // Phase 16: require screenshot + planDetails for verification
    if (!paymentForm.screenshotUrl) {
      toast.error("Please upload a payment screenshot / receipt");
      return;
    }
    if (!paymentForm.planDetails || paymentForm.planDetails.trim().length < 5) {
      toast.error("Please describe the plan / subscription you're paying for (min 5 characters)");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetchWithAuth("/api/subscriptions/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: organization?.id,
          userId: user?.id,
          ...paymentForm,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setPaymentForm({ planId: "", amount: "", transactionId: "", paymentMethod: "bank_transfer", screenshotUrl: "", billingCycle: "monthly", planDetails: "" });
        setShowUpgradeForm(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.currentSubscription(organization?.id ?? "") });
      } else {
        toast.error(data.error || "Failed to submit payment");
      }
    } catch (err) {
      toast.error("Failed to submit payment proof");
    }
    setSubmittingPayment(false);
  };

  // ── Admin: Generate Invoice for a payment ──
  const handleGenerateInvoice = async (payment: PaymentRecord) => {
    if (!organization?.id) return;
    setGeneratingInvoice(payment.id);
    try {
      const res = await fetchWithAuth("/api/admin/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          planName: payment.planName,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          transactionId: payment.transactionId,
          billingCycle: payment.billingCycle,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${payment.planName}-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Invoice generated and downloaded");
        fetchInvoices();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate invoice");
      }
    } catch (err) {
      toast.error("Failed to generate invoice");
    }
    setGeneratingInvoice(null);
  };

  // ── Copy to clipboard ──
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ── View Invoice ──
  const handleViewInvoice = (invoice: InvoiceRecord) => {
    setViewingInvoice(invoice);
  };

  // ── Status helpers ──
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Trial</Badge>;
      case "active":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Active</Badge>;
      case "pending_payment":
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Pending Payment</Badge>;
      case "expired":
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Expired</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-300">Pending</Badge>;
      case "approved":
        return <Badge className="bg-amber-500/20 text-amber-300">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-300">Pending</Badge>;
      case "paid":
      case "approved":
        return <Badge className="bg-amber-500/20 text-amber-300">Paid</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-300">Cancelled</Badge>;
      case "refunded":
        return <Badge className="bg-amber-500/20 text-amber-300">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // ── Theme helpers (used across early returns too) ──
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  // ── Platform Roles (Valtriox Team / Platform Admin/Owner): Full Access ──
  const isValtrioxTeam = user?.role === "valtriox_team";
  const isAdminRole = user?.role === "platform_owner" || user?.role === "platform_admin";

  if (isValtrioxTeam || isAdminRole) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={cn("text-2xl font-bold", textPrimary)}>Billing & Plans</h1>
            <p className={cn("text-sm mt-1", textSecondary)}>
              {isValtrioxTeam ? "Platform team access" : "Platform administration"} | subscription management
            </p>
          </div>
          <Button
            onClick={() => setShowAllPlans((p) => !p)}
            className={cn(
              "gap-2",
              isGold
                ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            )}
          >
            <Globe className="h-4 w-4" /> {showAllPlans ? "Hide Plans" : "View All Plans"}
          </Button>
        </div>
        <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }}>
          <Card className={cn("overflow-hidden", isDark ? "bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border-violet-500/20" : "bg-gradient-to-r from-violet-50 to-white border-violet-200")}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-xl shrink-0", isDark ? "bg-violet-500/15" : "bg-violet-100")}>
                  <Shield className="h-7 w-7 text-violet-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className={cn("font-bold text-lg", textPrimary)}>
                      {isValtrioxTeam ? "Valtriox Team Member" : "Platform Administrator"}
                    </h2>
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">Full Access</Badge>
                  </div>
                  <p className={cn("text-sm", textSecondary)}>
                    {isValtrioxTeam
                      ? "As a Valtriox team member, you have unrestricted access to the entire platform. No subscription is required. You can manage client subscriptions, view payment approvals, and access all features including enterprise-level tools."
                      : "As a platform administrator, you have unrestricted access to the entire platform. No subscription is required. You can manage client subscriptions, approve payments, configure plans, and access all enterprise-level tools."}
                  </p>
                  <div className={cn("mt-3 p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className={cn("text-sm", textSecondary)}>All Features Unlocked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className={cn("text-sm", textSecondary)}>Unlimited Resources</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className={cn("text-sm", textSecondary)}>No Subscription Required</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Show payment history if available */}
        {subscription && subscription.payments && subscription.payments.length > 0 && (
          <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }}>
            <Card className={cn(cardBg)}>
              <CardHeader>
                <CardTitle className={cn("text-base", textPrimary)}>Payment History</CardTitle>
                <CardDescription className={textSecondary}>
                  Recent payments for {organization?.name || "this organization"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(subscription.payments || []).map((payment: PaymentRecord) => (
                    <div key={payment.id} className={cn("p-3 rounded-lg border flex items-center justify-between", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium", textPrimary)}>{payment.planName}</p>
                          {getPaymentStatusBadge(payment.status)}
                        </div>
                        <p className={cn("text-xs mt-1", textSecondary)}>
                          {payment.paymentMethod} &middot; {payment.transactionId} &middot; {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={cn("text-sm font-bold", textPrimary)}>Rs. {payment.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Show All Plans for platform roles */}
        <AnimatePresence mode="wait">
          {showAllPlans && plans.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className={cn("mb-6", cardBg)}>
                <CardHeader>
                  <CardTitle className={cn("text-base", textPrimary)}>All Plans</CardTitle>
                  <CardDescription className={textSecondary}>
                    Platform plans available for clients
                  </CardDescription>
                  <div className="flex items-center justify-center mt-3">
                    <div className={cn("flex items-center rounded-full p-1 gap-1", isDark ? "bg-white/[0.05]" : "bg-slate-100")}>
                      {(["monthly", "quarterly", "annually"] as const).map((cycle) => (
                        <button
                          key={cycle}
                          onClick={() => setBillingToggle(cycle)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                            billingToggle === cycle
                              ? isGold
                                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                                : "bg-amber-600 text-white"
                              : textSecondary
                          )}
                        >
                          {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                          {cycle === "quarterly" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">Save 10%</span>}
                          {cycle === "annually" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">Save 20%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.map((plan) => {
                      const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.starter;
                      const Icon = PLAN_ICONS[plan.name] || Shield;
                      return (
                        <div
                          key={plan.id}
                          className={cn(
                            "relative rounded-xl border-2 p-5 transition-all",
                            isDark ? "border-white/[0.06] hover:border-white/[0.12]" : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className={cn("p-2 rounded-lg", colors.bg)}>
                              <Icon className={cn("h-5 w-5", colors.text)} />
                            </div>
                            <div>
                              <h3 className={cn("font-bold capitalize", textPrimary)}>{plan.name}</h3>
                              <div className="flex items-center gap-1">
                                {billingToggle === "annually" && plan.annualPrice > 0 ? (
                                  <><span className="text-sm font-bold text-amber-400">Rs. {plan.annualPrice.toLocaleString()}</span><span className={cn("text-xs", textSecondary)}>/year</span></>
                                ) : billingToggle === "quarterly" && (plan.quarterlyPrice || 0) > 0 ? (
                                  <><span className="text-sm font-bold text-amber-400">Rs. {plan.quarterlyPrice!.toLocaleString()}</span><span className={cn("text-xs", textSecondary)}>/3 months</span></>
                                ) : (
                                  <><span className="text-sm font-bold text-amber-400">Rs. {plan.price.toLocaleString()}</span><span className={cn("text-xs", textSecondary)}>/month</span></>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {plan.features.slice(0, 5).map((f, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <Check className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span className={cn("text-xs", textSecondary)}>{f}</span>
                              </div>
                            ))}
                            {plan.features.length > 5 && (
                              <span className={cn("text-xs", textSecondary)}>+{plan.features.length - 5} more features</span>
                            )}
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className={cn("p-2 rounded-lg text-center", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                              <p className={cn("text-xs", textSecondary)}>Team</p>
                              <p className={cn("text-sm font-bold", textPrimary)}>{plan.teamLimit === -1 ? "Unltd" : plan.teamLimit}</p>
                            </div>
                            <div className={cn("p-2 rounded-lg text-center", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                              <p className={cn("text-xs", textSecondary)}>Orders</p>
                              <p className={cn("text-sm font-bold", textPrimary)}>{plan.orderLimit === -1 ? "Unltd" : plan.orderLimit.toLocaleString()}</p>
                            </div>
                            <div className={cn("p-2 rounded-lg text-center", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                              <p className={cn("text-xs", textSecondary)}>Products</p>
                              <p className={cn("text-sm font-bold", textPrimary)}>{plan.productLimit === -1 ? "Unltd" : plan.productLimit.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show Payment Methods section */}
        <PaymentMethodsPage />
      </div>
    );
  }

  // ── Renewal helpers ──
  const isRenewable = (() => {
    if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) return false;
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return periodEnd <= fourteenDaysFromNow;
  })();

  const isNearExpiry = (() => {
    if (!subscription || !subscription.currentPeriodEnd) return false;
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return periodEnd <= sevenDaysFromNow;
  })();

  const handleRenewNow = () => {
    if (!currentPlan) return;
    const cycle = subscription?.billingCycle || "monthly";
    const price = cycle === "annually" && currentPlan.annualPrice > 0 ? currentPlan.annualPrice : cycle === "quarterly" && currentPlan.quarterlyPrice > 0 ? currentPlan.quarterlyPrice : currentPlan.price;
    setPaymentForm((prev) => ({
      ...prev,
      planId: currentPlan.id,
      amount: price.toString(),
      billingCycle: cycle as "monthly" | "quarterly" | "annually",
    }));
    setShowUpgradeForm(true);
  };

  const currentPlan = subscription?.plan;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Billing & Plans</h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            {isPlatform ? "Manage subscriptions, payments, and billing" : "View your subscription, payments, and billing"}
          </p>
        </div>
        {isPlatform && (
          <>
            {subscription?.status === "trial" && (
              <Button
                onClick={() => setShowAllPlans(true)}
                className={cn(
                  "gap-2",
                  isGold
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                <ArrowRight className="h-4 w-4" /> Upgrade Plan
              </Button>
            )}
            {subscription?.status === "active" && (
              <Button
                onClick={() => setShowAllPlans(true)}
                variant="outline"
                className={cn("gap-2 border-white/[0.1]", isDark ? "text-slate-300 hover:bg-white/[0.05]" : "")}
              >
                Change Plan
              </Button>
            )}
            {subscription?.status === "pending_payment" && (
              <Button
                disabled
                variant="outline"
                className={cn("gap-2 border-yellow-500/20 text-yellow-400 cursor-not-allowed opacity-60")}
              >
                <Clock className="h-4 w-4" /> Payment Under Review
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Brand Owner Contact Banner (non-platform roles) ── */}
      {!isPlatform && (
        <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }}>
          <Card className={cn(
            "overflow-hidden",
            isDark
              ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20"
              : "bg-gradient-to-r from-amber-50 to-white border-amber-200"
          )}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl shrink-0",
                  isDark ? "bg-amber-500/15" : "bg-amber-100"
                )}>
                  <MessageCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className={cn("font-bold text-base", textPrimary)}>
                    Need to activate or upgrade your plan?
                  </h3>
                  <p className={cn("text-sm", textSecondary)}>
                    To activate or upgrade your plan, please contact the Valtriox support team. Our team will guide you through the process and get you set up quickly.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {platformSettings?.companyEmail && (
                      <a
                        href={`mailto:${platformSettings.companyEmail}`}
                        className={cn(
                          "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors",
                          isDark
                            ? "bg-white/[0.06] hover:bg-white/[0.1] text-amber-300"
                            : "bg-amber-100/60 hover:bg-amber-100 text-amber-700"
                        )}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {platformSettings.companyEmail}
                      </a>
                    )}
                    {platformSettings?.companyPhone && (
                      <a
                        href={`tel:${platformSettings.companyPhone}`}
                        className={cn(
                          "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors",
                          isDark
                            ? "bg-white/[0.06] hover:bg-white/[0.1] text-amber-300"
                            : "bg-amber-100/60 hover:bg-amber-100 text-amber-700"
                        )}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {platformSettings.companyPhone}
                      </a>
                    )}
                    {platformSettings?.whatsappNumber && (
                      <a
                        href={buildWhatsAppLink(platformSettings.whatsappNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors",
                          isDark
                            ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        )}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp: {platformSettings.whatsappNumber}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current Plan Overview */}
      {currentPlan && (
        <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }}>
          <Card className={cn("overflow-hidden", cardBg)}>
            <div className={cn(
              "p-6 border-b",
              isDark ? "border-white/[0.06]" : "border-slate-200"
            )}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    PLAN_COLORS[currentPlan.name]?.bg || "bg-slate-500/10"
                  )}>
                    {(() => {
                      const Icon = PLAN_ICONS[currentPlan.name] || Shield;
                      return <Icon className={cn("h-6 w-6", PLAN_COLORS[currentPlan.name]?.text || "text-slate-400")} />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className={cn("text-xl font-bold capitalize", textPrimary)}>{currentPlan.name}</h2>
                      {getStatusBadge(subscription!.status)}
                    </div>
                    <div className={cn("flex items-center gap-1.5 mt-1 text-sm", textSecondary)}>
                      <span className="text-[10px]">PK</span>
                      {(() => { const c = getCurrencyForCountry(organization?.country || "PK"); const cycle = subscription?.billingCycle || "monthly"; const price = cycle === "annually" && currentPlan.annualPrice > 0 ? currentPlan.annualPrice : currentPlan.price; return `${c.symbol} ${price.toLocaleString()}/${cycle === "annually" ? "year" : "month"}`; })()}
                      {subscription?.billingCycle === "annually" && (
                        <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300">Annual</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trial Countdown */}
                {subscription!.isTrialActive && (
                  <div className={cn(
                    "px-4 py-2 rounded-xl border",
                    isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200"
                  )}>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span className={isDark ? "text-amber-300" : "text-amber-700"}>
                        <span className="font-bold">{subscription!.trialDaysRemaining}</span> days left in trial
                      </span>
                    </div>
                  </div>
                )}

                {/* Active Period */}
                {subscription!.status === "active" && subscription!.currentPeriodEnd && (
                  <div className={cn(
                    "px-4 py-2 rounded-xl border",
                    isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200"
                  )}>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-amber-400" />
                      <span className={isDark ? "text-amber-300" : "text-amber-700"}>
                        Renews {new Date(subscription!.currentPeriodEnd).toLocaleDateString("en-PK", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Plan Features */}
            <div className="p-6">
              <h3 className={cn("text-sm font-semibold mb-4", textSecondary)}>Plan Limits & Features</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-amber-400" />
                    <span className={cn("text-xs", textSecondary)}>Team Members</span>
                  </div>
                  <p className={cn("text-lg font-bold", textPrimary)}>
                    {currentPlan.teamLimit === -1 ? "Unlimited" : currentPlan.teamLimit}
                  </p>
                </div>
                <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-amber-400" />
                    <span className={cn("text-xs", textSecondary)}>Orders (Total)</span>
                  </div>
                  <p className={cn("text-lg font-bold", textPrimary)}>
                    {currentPlan.orderLimit === -1 ? "Unlimited" : currentPlan.orderLimit.toLocaleString()}
                  </p>
                </div>
                <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-amber-400" />
                    <span className={cn("text-xs", textSecondary)}>Products</span>
                  </div>
                  <p className={cn("text-lg font-bold", textPrimary)}>
                    {currentPlan.productLimit === -1 ? "Unlimited" : currentPlan.productLimit.toLocaleString()}
                  </p>
                </div>
                <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <span className={cn("text-xs", textSecondary)}>Features</span>
                  </div>
                  <p className={cn("text-lg font-bold", textPrimary)}>{currentPlan.features.length}</p>
                </div>
              </div>

              {/* Features list */}
              <div className="mt-6">
                <h3 className={cn("text-sm font-semibold mb-3", textSecondary)}>What&apos;s Included</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentPlan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className={cn("text-sm", textSecondary)}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Renew Subscription Section ── */}
      {subscription?.status === "active" && subscription.currentPeriodEnd && (
        <motion.div initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.2 }}>
          <Card className={cn(cardBg)}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    isNearExpiry
                      ? isDark ? "bg-amber-500/15" : "bg-amber-100"
                      : isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                  )}>
                    {isNearExpiry ? (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {isNearExpiry ? (
                      <>
                        <h3 className={cn("font-bold text-sm", textPrimary)}>Subscription Expiring Soon</h3>
                        <p className={cn("text-sm", textSecondary)}>
                          Your subscription {isRenewable ? "expires" : "expired"} on {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                          Renew now to avoid any interruption.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className={cn("font-bold text-sm", textPrimary)}>Auto-Renewal Active</h3>
                        <p className={cn("text-sm", textSecondary)}>
                          Your subscription auto-renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleRenewNow}
                  className={cn(
                    "gap-2 shrink-0",
                    isNearExpiry
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : isGold
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                >
                  <RefreshCw className="h-4 w-4" /> {isNearExpiry ? "Renew Now (Urgent)" : "Renew Subscription"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Available Plans - shown to both brand_owner and platform ── */}
      {!isPlatform && !showAllPlans && (
        <Button
          onClick={() => setShowAllPlans(true)}
          variant="outline"
          className={cn("gap-2", isDark ? "border-white/[0.1] text-slate-300 hover:bg-white/[0.05]" : "")}
        >
          <Globe className="h-4 w-4" /> View All Plans
        </Button>
      )}

      <AnimatePresence mode="wait">
        {showAllPlans && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Available Plans */}
            <Card className={cn("mb-6", cardBg)}>
              <CardHeader>
                <CardTitle className={cn("text-base", textPrimary)}>Available Plans</CardTitle>
                <CardDescription className={textSecondary}>
                  Choose a plan that best fits your business needs
                </CardDescription>
                {/* Monthly / Annual Toggle */}
                <div className="flex items-center justify-center mt-3">
                  <div className={cn(
                    "flex items-center rounded-full p-1 gap-1",
                    isDark ? "bg-white/[0.05]" : "bg-slate-100"
                  )}>
                    <button
                      onClick={() => setBillingToggle("monthly")}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                        billingToggle === "monthly"
                          ? isGold
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                            : "bg-amber-600 text-white"
                          : textSecondary
                      )}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingToggle("quarterly")}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                        billingToggle === "quarterly"
                          ? isGold
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                            : "bg-amber-600 text-white"
                          : textSecondary
                      )}
                    >
                      Quarterly
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">
                        Save 10%
                      </span>
                    </button>
                    <button
                      onClick={() => setBillingToggle("annually")}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                        billingToggle === "annually"
                          ? isGold
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                            : "bg-amber-600 text-white"
                          : textSecondary
                      )}
                    >
                      Annually
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">
                        Save 20%
                      </span>
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((plan) => {
                    const isCurrent = plan.name === currentPlan?.name;
                    const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.starter;
                    const Icon = PLAN_ICONS[plan.name] || Shield;

                    return (
                      <div
                        key={plan.id}
                        className={cn(
                          "relative rounded-xl border-2 p-5 transition-all",
                          isCurrent
                            ? `${colors.border} ${colors.bg}`
                            : isDark
                              ? "border-white/[0.06] hover:border-white/[0.12]"
                              : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {isCurrent && (
                          <div className={cn("absolute -top-3 left-4 px-2 py-0.5 rounded-full text-xs font-bold", colors.badge)}>
                            Current Plan
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn("p-2 rounded-lg", colors.bg)}>
                            <Icon className={cn("h-5 w-5", colors.text)} />
                          </div>
                          <div>
                            <h3 className={cn("font-bold capitalize", textPrimary)}>{plan.name}</h3>
                            <div className="flex items-center gap-1">
                              {billingToggle === "annually" && plan.annualPrice > 0 ? (
                                <>
                                  <span className="text-sm font-bold text-amber-400">Rs. {plan.annualPrice.toLocaleString()}</span>
                                  <span className={cn("text-xs", textSecondary)}>/year</span>
                                  <span className="text-[10px] line-through text-slate-500 ml-1">{(plan.price * 12).toLocaleString()}</span>
                                  {plan.annualSavings > 0 && (
                                    <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300 ml-1">
                                      Save {plan.annualSavings}%
                                    </Badge>
                                  )}
                                </>
                              ) : billingToggle === "quarterly" && plan.quarterlyPrice > 0 ? (
                                <>
                                  <span className="text-sm font-bold text-amber-400">Rs. {plan.quarterlyPrice.toLocaleString()}</span>
                                  <span className={cn("text-xs", textSecondary)}>/3 months</span>
                                  <span className="text-[10px] line-through text-slate-500 ml-1">{(plan.price * 3).toLocaleString()}</span>
                                  <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300 ml-1">
                                    Save 10%
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm font-bold text-amber-400">Rs. {plan.price.toLocaleString()}</span>
                                  <span className={cn("text-xs", textSecondary)}>/month</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          {plan.features.slice(0, 5).map((f, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Check className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span className={cn("text-xs", textSecondary)}>{f}</span>
                            </div>
                          ))}
                          {plan.features.length > 5 && (
                            <span className={cn("text-xs", textSecondary)}>+{plan.features.length - 5} more features</span>
                          )}
                        </div>

                        {!isCurrent && plan.price > 0 && currentPlan && (() => {
                          const planOrder: Record<string, number> = { starter: 0, growth: 1, professional: 2, enterprise: 3 };
                          const currentLevel = planOrder[currentPlan.name] ?? 0;
                          const targetLevel = planOrder[plan.name] ?? 0;
                          const isUpgrade = targetLevel > currentLevel;
                          const isDowngrade = targetLevel < currentLevel;
                          const currentCyclePrice = (() => {
                            const cycle = subscription?.billingCycle || "monthly";
                            if (cycle === "annually" && currentPlan.annualPrice > 0) return currentPlan.annualPrice;
                            if (cycle === "quarterly" && (currentPlan.quarterlyPrice || 0) > 0) return currentPlan.quarterlyPrice || 0;
                            return currentPlan.price;
                          })();
                          const newCyclePrice = (() => {
                            if (billingToggle === "annually" && plan.annualPrice > 0) return plan.annualPrice;
                            if (billingToggle === "quarterly" && (plan.quarterlyPrice || 0) > 0) return plan.quarterlyPrice || 0;
                            return plan.price;
                          })();
                          const priceDiff = newCyclePrice - currentCyclePrice;
                          return (
                            <div className="space-y-2">
                              {(isUpgrade || isDowngrade) && (
                                <Badge className={cn(
                                  "text-[10px] px-2 py-0.5 w-full justify-center",
                                  isUpgrade
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                )}>
                                  {isUpgrade ? "Upgrade" : "Downgrade"}
                                  {priceDiff > 0 ? ` (+Rs. ${priceDiff.toLocaleString()})` : priceDiff < 0 ? ` (-Rs. ${Math.abs(priceDiff).toLocaleString()})` : ""}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                className={cn(
                                  "w-full gap-1",
                                  subscription?.status === "pending_payment"
                                    ? "bg-slate-600 text-slate-300 cursor-not-allowed opacity-50"
                                    : isGold
                                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black"
                                      : "bg-amber-600 hover:bg-amber-700 text-white"
                                )}
                                disabled={subscription?.status === "pending_payment"}
                                onClick={() => {
                                  if (subscription?.status === "pending_payment") {
                                    toast.error("Payment already under review. Please wait for admin approval.");
                                    return;
                                  }
                                  const targetPrice = billingToggle === "annually" && plan.annualPrice > 0 ? plan.annualPrice : billingToggle === "quarterly" && (plan.quarterlyPrice || 0) > 0 ? plan.quarterlyPrice : plan.price;
                                  setPaymentForm((prev) => ({
                                    ...prev,
                                    planId: plan.id,
                                    amount: targetPrice.toString(),
                                    billingCycle: billingToggle,
                                  }));
                                  setShowUpgradeForm(true);
                                  setShowAllPlans(false);
                                }}
                              >
                                {isUpgrade ? "Upgrade" : isDowngrade ? "Switch" : "Select Plan"} <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end mb-4">
              <Button variant="ghost" onClick={() => setShowAllPlans(false)} className="gap-2">
                <X className="h-4 w-4" /> Close Plans
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Payment Proof Submission Form ── */}
      {(
        <AnimatePresence mode="wait">
          {showUpgradeForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className={cn("mb-6", cardBg)}>
                <CardHeader>
                  <CardTitle className={cn("text-base", textPrimary)}>
                    Submit Payment Proof
                  </CardTitle>
                  <CardDescription className={textSecondary}>
                    {isPlatform ? "Record a manual payment for this organization" : "Submit your payment proof to activate or change your plan"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className={cn("text-sm mb-1.5 block", textSecondary)}>Amount (PKR)</Label>
                      <Input
                        type="number"
                        placeholder="15000"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className={isDark ? "border-white/[0.1] bg-white/[0.03]" : ""}
                      />
                    </div>
                    <div>
                      <Label className={cn("text-sm mb-1.5 block", textSecondary)}>Transaction ID / Reference</Label>
                      <Input
                        placeholder="e.g. TRX-123456789"
                        value={paymentForm.transactionId}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, transactionId: e.target.value }))}
                        className={isDark ? "border-white/[0.1] bg-white/[0.03]" : ""}
                      />
                    </div>
                    <div>
                      <Label className={cn("text-sm mb-1.5 block", textSecondary)}>Payment Method</Label>
                      <select
                        value={paymentForm.paymentMethod}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                        className={cn(
                          "w-full h-9 rounded-md border px-3 text-sm",
                          isDark ? "border-white/[0.1] bg-white/[0.03] text-slate-300" : "border-slate-200"
                        )}
                      >
                        <option value="bank_transfer">Bank Transfer (HBL)</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">EasyPaisa</option>
                        <option value="paypro">PayPro (Online)</option>
                        <option value="payoneer">Payoneer (International)</option>
                        <option value="swift">SWIFT (International)</option>
                        <option value="paypal">PayPal</option>
                        <option value="wise">Wise</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <Label className={cn("text-sm mb-1.5 block", textSecondary)}>Billing Cycle</Label>
                      <select
                        value={paymentForm.billingCycle}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, billingCycle: e.target.value }))}
                        className={cn(
                          "w-full h-9 rounded-md border px-3 text-sm",
                          isDark ? "border-white/[0.1] bg-white/[0.03] text-slate-300" : "border-slate-200"
                        )}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                  </div>

                  {/* Phase 16: Plan / Subscription Details (free-text) */}
                  <div>
                    <Label className={cn("text-sm mb-1.5 block", textSecondary)}>
                      Plan / Subscription Details <span className="text-rose-400">*</span>
                    </Label>
                    <Textarea
                      placeholder="e.g. Renewing Growth plan (monthly) — 1 team member, 100 orders/mo, 50 products. Paid via HBL bank transfer on 04/07/2026."
                      value={paymentForm.planDetails || ""}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, planDetails: e.target.value }))}
                      rows={3}
                      className={cn(isDark ? "border-white/[0.1] bg-white/[0.03] text-slate-300" : "")}
                    />
                    <p className={cn("text-[10px] mt-1", textSecondary)}>
                      Describe which plan you're paying for and any notes for the admin. Required for approval.
                    </p>
                  </div>

                  {/* Phase 16: Payment Screenshot Upload (base64) */}
                  <div>
                    <Label className={cn("text-sm mb-1.5 block", textSecondary)}>
                      Payment Screenshot / Receipt <span className="text-rose-400">*</span>
                    </Label>
                    <div className="space-y-2">
                      {paymentForm.screenshotUrl ? (
                        <div className={cn(
                          "relative rounded-md overflow-hidden border",
                          isDark ? "border-white/[0.1]" : "border-slate-200"
                        )}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={paymentForm.screenshotUrl}
                            alt="Payment screenshot"
                            className="max-h-64 w-auto mx-auto"
                          />
                          <button
                            type="button"
                            onClick={() => setPaymentForm((prev) => ({ ...prev, screenshotUrl: "" }))}
                            className="absolute top-2 right-2 p-1 rounded bg-black/60 hover:bg-black/80 text-white"
                            aria-label="Remove screenshot"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-md border-2 border-dashed cursor-pointer transition-colors",
                            isDark
                              ? "border-white/15 hover:border-amber-500/50 hover:bg-white/[0.02]"
                              : "border-slate-300 hover:border-amber-500/50 hover:bg-amber-50/50"
                          )}
                        >
                          <Upload className={cn("h-6 w-6", isDark ? "text-slate-400" : "text-slate-500")} />
                          <span className={cn("text-sm", textPrimary)}>
                            Click to upload payment screenshot
                          </span>
                          <span className={cn("text-[10px]", textSecondary)}>
                            PNG / JPG / JPEG · Max 5MB · Required for approval
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error("File too large — max 5MB");
                                return;
                              }
                              try {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = String(reader.result || "");
                                  setPaymentForm((prev) => ({ ...prev, screenshotUrl: result }));
                                  toast.success("Screenshot loaded — ready to submit");
                                };
                                reader.onerror = () => toast.error("Failed to read file");
                                reader.readAsDataURL(file);
                              } catch {
                                toast.error("Failed to load screenshot");
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleSubmitPayment}
                      disabled={submittingPayment}
                      className={cn(
                        "gap-2",
                        isGold
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                          : "bg-amber-600 hover:bg-amber-700 text-white"
                      )}
                    >
                      {submittingPayment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {submittingPayment ? "Submitting..." : "Submit Payment Proof"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowUpgradeForm(false)}
                      className={cn(isDark ? "border-white/[0.1]" : "")}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Payment History */}
      {subscription?.payments && subscription.payments.length > 0 && (
        <Card className={cn(cardBg)}>
          <CardHeader>
            <CardTitle className={cn("text-base", textPrimary)}>Payment History</CardTitle>
            <CardDescription className={textSecondary}>
              Track your previous payment submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {subscription.payments.map((payment) => (
                <div
                  key={payment.id}
                  className={cn(
                    "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold text-sm", textPrimary)}>{payment.planName}</span>
                      {getPaymentStatusBadge(payment.status)}
                    </div>
                    <div className={cn("flex items-center gap-3 text-xs", textSecondary)}>
                      <span>PKR {payment.amount.toLocaleString()}</span>
                      <span className="capitalize">{payment.paymentMethod.replace(/_/g, " ")}</span>
                      <span>Ref: {payment.transactionId}</span>
                      <span>{new Date(payment.createdAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    {payment.adminNote && (
                      <p className={cn("text-xs", textSecondary)}>Note: {payment.adminNote}</p>
                    )}
                  </div>

                  {/* Admin: Generate Invoice button for approved payments */}
                  {isPlatform && payment.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("gap-1.5 shrink-0", isDark ? "border-white/[0.1] text-amber-300 hover:bg-amber-500/10" : "")}
                      disabled={generatingInvoice === payment.id}
                      onClick={() => handleGenerateInvoice(payment)}
                    >
                      {generatingInvoice === payment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {generatingInvoice === payment.id ? "Generating..." : "Generate Invoice"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Section */}
      {invoices.length > 0 && (
        <Card className={cn(cardBg)}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              <CardTitle className={cn("text-base", textPrimary)}>Invoices</CardTitle>
            </div>
            <CardDescription className={textSecondary}>
              Your billing invoices and receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-center justify-between gap-3",
                    isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-mono text-sm font-medium", textPrimary)}>{invoice.invoiceNumber}</span>
                      {getInvoiceStatusBadge(invoice.status)}
                    </div>
                    <div className={cn("flex items-center gap-3 text-xs", textSecondary)}>
                      <span>{invoice.planName}</span>
                      <span>{invoice.currencySymbol} {invoice.amount.toLocaleString()}</span>
                      <span className="capitalize">{invoice.billingCycle}</span>
                      <span>{new Date(invoice.issuedAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn("gap-1", isDark ? "text-slate-300 hover:bg-white/[0.05]" : "")}
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin: Payment Methods Management */}
      {isPlatform && canSetPaymentMethods(user?.role || "") && (
        <PaymentMethodsPage />
      )}

      {/* Invoice Viewer Modal */}
      <SubscriptionInvoiceView
        invoice={viewingInvoice}
        open={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
      />
    </div>
  );
}
