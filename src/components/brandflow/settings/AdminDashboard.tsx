"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  DollarSign,
  ShoppingBag,
  Shield,
  Search,
  TrendingUp,
  AlertTriangle,
  Building2,
  RefreshCw,
  BarChart3,
  Settings,
  CreditCard,
  ChevronRight,
  Activity,
  Clock,
  Lock,
  Unlock,
  Save,
  ToggleLeft,
  ToggleRight,
  Receipt,
  Wallet,
  Percent,
  Repeat,
  ArrowDownLeft,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isPlatformRole } from "@/lib/roles";
import { FEATURE_LOCKS, getFeaturesByPlan, getPlanDisplayName } from "@/lib/feature-lock";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────

interface ClientData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  plan: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string; role: string } | null;
  memberCount: number;
  productCount: number;
  orderCount: number;
  customerCount: number;
  expenseCount: number;
  revenueTotal: number;
  ordersThisMonth: number;
  lastActivity: string;
}

interface SummaryData {
  totalClients: number;
  newThisMonth: number;
  totalRevenue: number;
  totalOrders: number;
  planDistribution: Record<string, number>;
}

interface RevenueSummary {
  totalRevenue: number;
  monthlyRecurring: number;
  pendingPayments: number;
  paidThisMonth: number;
  paidThisYear: number;
  averageOrderValue: number;
  proposalConversionRate: number;
  activeSubscriptions: number;
  totalExpenses: number;
  netProfitMargin: number;
}

interface RevenueData {
  summary: RevenueSummary;
  revenueByMonth: { month: string; revenue: number; expenses: number; profit: number }[];
  revenueByService: { service: string; revenue: number; count: number }[];
  topClients: { name: string; revenue: number; orders: number; plan: string }[];
  recentPayments: { id: string; clientName: string; amount: number; method: string; status: string; date: string }[];
}

// ─── Colors ─────────────────────────────────────────────────────────────

const PIE_COLORS = ["#D4A73A", "#D4A73A", "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b"];

// ─── Access Denied Component ────────────────────────────────────────────

function AccessDenied() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className={cn("max-w-md w-full", isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200")}>
        <CardContent className="flex flex-col items-center text-center p-8">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>
            Access Denied
          </h2>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            This page is restricted to administrators only. Contact your system admin if you believe this is an error.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export function AdminDashboard() {
  const { user, appTheme, setActiveSection } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [clients, setClients] = useState<ClientData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "revenue" | "orders" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Feature toggle states (platform owner can lock/unlock professional & enterprise features)
  const [lockedProfessionalFeatures, setLockedProfessionalFeatures] = useState<Set<string>>(new Set());
  const [lockedEnterpriseFeatures, setLockedEnterpriseFeatures] = useState<Set<string>>(new Set());
  const [featureTogglesSaving, setFeatureTogglesSaving] = useState(false);

  // Revenue & Financial Overview data
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const revenueSectionRef = useRef<HTMLDivElement>(null);

  const professionalFeatures = getFeaturesByPlan("professional");
  const enterpriseFeatures = getFeaturesByPlan("enterprise");

  // Fetch revenue data from /api/admin/revenue
  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const res = await fetchWithAuth("/api/admin/revenue");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch revenue data");
      }
      const data = await res.json();
      setRevenueData(data);
    } catch (err) {
      setRevenueError(err instanceof Error ? err.message : "Failed to load revenue data");
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  // Scroll to revenue section
  const scrollToRevenue = () => {
    revenueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Load saved feature toggles from API on mount
  useEffect(() => {
    async function loadToggles() {
      try {
        const res = await fetchWithAuth("/api/admin/feature-toggles");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.lockedGrowth)) {
            setLockedProfessionalFeatures(new Set(data.lockedGrowth));
          }
          if (Array.isArray(data.lockedEnterprise)) {
            setLockedEnterpriseFeatures(new Set(data.lockedEnterprise));
          }
        }
      } catch (err) {
        console.error("[AdminDashboard] Failed to load feature toggles:", err);
      }
    }
    loadToggles();
  }, []);

  const toggleProfessionalFeature = (featureId: string) => {
    setLockedProfessionalFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const toggleEnterpriseFeature = (featureId: string) => {
    setLockedEnterpriseFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const saveFeatureToggles = async () => {
    setFeatureTogglesSaving(true);
    try {
      // Persist to API (for now, just show success)
      const res = await fetchWithAuth("/api/admin/feature-toggles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockedGrowth: Array.from(lockedProfessionalFeatures),
          lockedEnterprise: Array.from(lockedEnterpriseFeatures),
        }),
      });
      if (res.ok) {
        // Also update the FEATURE_LOCKS array in memory
        FEATURE_LOCKS.forEach((f) => {
          f.locked = lockedProfessionalFeatures.has(f.id) || lockedEnterpriseFeatures.has(f.id);
        });
        toast.success("Feature toggles saved successfully");
      } else {
        toast.error("Failed to save feature toggles");
      }
    } catch (err) {
      console.error("[AdminDashboard] Failed to save feature toggles:", err);
      toast.error("Failed to save feature toggles");
    } finally {
      setFeatureTogglesSaving(false);
    }
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/clients?userId=${user?.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch");
      }
      const data = await res.json();
      setClients(data.clients || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filter & Sort
  const filteredClients = clients
    .filter((c) => {
      if (planFilter !== "all" && c.plan !== planFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.owner?.email || "").toLowerCase().includes(q) ||
          (c.owner?.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name) * dir;
        case "revenue": return (a.revenueTotal - b.revenueTotal) * dir;
        case "orders": return (a.orderCount - b.orderCount) * dir;
        case "date": return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        default: return 0;
      }
    });

  // Chart data
  const revenueByClient = filteredClients
    .filter((c) => c.revenueTotal > 0)
    .slice(0, 10)
    .map((c) => ({ name: c.name.length > 15 ? c.name.slice(0, 15) + "..." : c.name, revenue: Math.round(c.revenueTotal) }));

  const planPieData = summary
    ? Object.entries(summary.planDistribution).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    : [];

  const formatPKR = (amount: number) => `Rs. ${amount.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });

  // ─── Access check - only platform roles can access admin dashboard ────
  if (!user?.role || !isPlatformRole(user.role)) {
    return <AccessDenied />;
  }

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const cardHover = isDark ? "hover:bg-white/[0.06]" : "hover:bg-slate-50";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Admin Dashboard</h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Monitor all clients, revenue, and platform health
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => { fetchClients(); fetchRevenue(); }}
          disabled={loading || revenueLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", (loading || revenueLoading) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && !error ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className={cn(cardBg)}>
              <CardContent className="p-5">
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-3" />
                <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <motion.div>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                        <Building2 className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                      </div>
                      <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Total Clients</p>
                    </div>
                    <p className={cn("text-3xl font-bold", textPrimary)}>{summary.totalClients}</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-blue-100")}>
                        <UserPlus className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-blue-600")} />
                      </div>
                      <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>New This Month</p>
                    </div>
                    <p className={cn("text-3xl font-bold", textPrimary)}>{summary.newThisMonth}</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                        <DollarSign className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                      </div>
                      <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Total Revenue</p>
                    </div>
                    <p className={cn("text-3xl font-bold", textPrimary)}>{formatPKR(summary.totalRevenue)}</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                        <ShoppingBag className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                      </div>
                      <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Total Orders</p>
                    </div>
                    <p className={cn("text-3xl font-bold", textPrimary)}>{summary.totalOrders.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <motion.div>
              <button
                onClick={() => setActiveSection("platform-settings")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-amber-500/10"
                )}>
                  <Settings className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-500")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>Platform Settings</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Brand, payments & more</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
            <motion.div>
              <button
                onClick={() => setActiveSection("payment-approvals")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-amber-100"
                )}>
                  <Clock className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>Pending Payments</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Review & approve proofs</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
            <motion.div>
              <button
                onClick={() => setActiveSection("user-management")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-blue-100"
                )}>
                  <Users className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-blue-600")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>User Management</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Roles & permissions</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
            <motion.div>
              <button
                onClick={() => setActiveSection("audit-log")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-amber-100"
                )}>
                  <Activity className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>Audit Log</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Activity tracking</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
            <motion.div>
              <button
                onClick={() => setActiveSection("documents")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-amber-100"
                )}>
                  <FileText className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>Documents</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Templates & legal</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
            <motion.div>
              <button
                onClick={scrollToRevenue}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all group",
                  isDark
                    ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  isGold ? "bg-amber-500/10" : "bg-amber-100"
                )}>
                  <Receipt className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                </div>
                <p className={cn("text-sm font-semibold", textPrimary)}>Revenue Stats</p>
                <p className={cn("text-[11px] mt-0.5", textSecondary)}>Financial overview</p>
                <ChevronRight className={cn("h-4 w-4 mt-2 transition-transform group-hover:translate-x-0.5", textSecondary)} />
              </button>
            </motion.div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Bar Chart */}
            <Card className={cn("lg:col-span-2", cardBg)}>
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Revenue by Client
                </CardTitle>
                <CardDescription className={textSecondary}>Top 10 clients by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueByClient.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByClient} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={isDark ? "#64748b" : "#94a3b8"} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} stroke={isDark ? "#64748b" : "#94a3b8"} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
                            backgroundColor: isDark ? "#1e293b" : "#fff",
                            color: isDark ? "#e2e8f0" : "#1e293b",
                            fontSize: "12px",
                          }}
                          formatter={(v: number) => [`Rs. ${v.toLocaleString()}`, "Revenue"]}
                        />
                        <Bar dataKey="revenue" fill={isGold ? "#D4A73A" : "#D4A73A"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center h-[280px]", textSecondary)}>
                    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No revenue data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan Distribution Pie Chart */}
            <Card className={cardBg}>
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-base font-semibold", textPrimary)}>Plan Distribution</CardTitle>
                <CardDescription className={textSecondary}>Client subscription breakdown</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {planPieData.length > 0 ? (
                  <>
                    <div className="h-[180px] w-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={planPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            {planPieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              fontSize: "12px",
                              backgroundColor: isDark ? "#1e293b" : "#fff",
                              color: isDark ? "#e2e8f0" : "#1e293b",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
                      {planPieData.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className={textSecondary}>{p.name}: {p.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center h-[200px]", textSecondary)}>
                    <Users className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No client data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ Revenue & Financial Overview ═══ */}
          <div ref={revenueSectionRef} className="space-y-4">
            <motion.div>
              <h2 className={cn("text-lg font-bold flex items-center gap-2", textPrimary)}>
                <Receipt className={cn("h-5 w-5", isGold ? "text-amber-400" : "text-amber-500")} />
                Revenue & Financial Overview
              </h2>
              <p className={cn("text-xs mt-0.5", textSecondary)}>Comprehensive revenue analytics across all sources</p>
            </motion.div>

            {revenueError && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-red-700">Revenue data: {revenueError}</p>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={fetchRevenue}>Retry</Button>
                </CardContent>
              </Card>
            )}

            {revenueLoading && !revenueData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className={cn(cardBg)}>
                    <CardContent className="p-5">
                      <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-3" />
                      <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : revenueData ? (
              <>
                {/* Revenue Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <motion.div>
                    <Card className={cn(cardBg)}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                            <DollarSign className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                          </div>
                          <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Total Revenue</p>
                        </div>
                        <p className={cn("text-2xl font-bold", textPrimary)}>{formatPKR(revenueData.summary.totalRevenue)}</p>
                        <p className={cn("text-[10px] mt-1", textSecondary)}>+{formatPKR(revenueData.summary.paidThisMonth)} this month</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div>
                    <Card className={cn(cardBg)}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                            <Repeat className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                          </div>
                          <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Monthly Recurring</p>
                        </div>
                        <p className={cn("text-2xl font-bold", textPrimary)}>{formatPKR(revenueData.summary.monthlyRecurring)}</p>
                        <p className={cn("text-[10px] mt-1", textSecondary)}>{revenueData.summary.activeSubscriptions} active subs</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div>
                    <Card className={cn(cardBg)}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                            <Clock className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                          </div>
                          <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Pending Payments</p>
                        </div>
                        <p className={cn("text-2xl font-bold", textPrimary)}>{formatPKR(revenueData.summary.pendingPayments)}</p>
                        <p className={cn("text-[10px] mt-1", textSecondary)}>Awaiting approval</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div>
                    <Card className={cn(cardBg)}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                            <Percent className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                          </div>
                          <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Net Profit Margin</p>
                        </div>
                        <p className={cn("text-2xl font-bold", textPrimary)}>{revenueData.summary.netProfitMargin}%</p>
                        <p className={cn("text-[10px] mt-1", textSecondary)}>
                          Expenses: {formatPKR(revenueData.summary.totalExpenses)}
                          {revenueData.summary.fixedMonthlyCost && (
                            <span className="text-amber-400 ml-1">(incl. Rs. 48,440 fixed tools)</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Revenue by Month Chart & Revenue by Service Type */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Revenue by Month (Area Chart) */}
                  <Card className={cn("lg:col-span-2", cardBg)}>
                    <CardHeader className="pb-2">
                      <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                        <TrendingUp className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-500")} />
                        Revenue Trend (12 Months)
                      </CardTitle>
                      <CardDescription className={textSecondary}>Monthly revenue, expenses & profit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {revenueData.revenueByMonth.length > 0 ? (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData.revenueByMonth} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                              <defs>
                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={isGold ? "#D4A73A" : "#D4A73A"} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={isGold ? "#D4A73A" : "#D4A73A"} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={isDark ? "#64748b" : "#94a3b8"} angle={-30} textAnchor="end" height={55} />
                              <YAxis tick={{ fontSize: 10 }} stroke={isDark ? "#64748b" : "#94a3b8"} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: "8px",
                                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
                                  backgroundColor: isDark ? "#1e293b" : "#fff",
                                  color: isDark ? "#e2e8f0" : "#1e293b",
                                  fontSize: "11px",
                                }}
                                formatter={(v: number, name: string) => [`Rs. ${v.toLocaleString()}`, name === "revenue" ? "Revenue" : name === "profit" ? "Profit" : "Expenses"]}
                              />
                              <Area type="monotone" dataKey="revenue" stroke={isGold ? "#D4A73A" : "#D4A73A"} fill="url(#revenueGradient)" strokeWidth={2} />
                              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profitGradient)" strokeWidth={2} />
                              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className={cn("flex flex-col items-center justify-center h-[280px]", textSecondary)}>
                          <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                          <p className="text-sm">No monthly revenue data</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Revenue by Service Type (Horizontal Bar) */}
                  <Card className={cardBg}>
                    <CardHeader className="pb-2">
                      <CardTitle className={cn("text-base font-semibold", textPrimary)}>Revenue by Service</CardTitle>
                      <CardDescription className={textSecondary}>Breakdown by proposal type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {revenueData.revenueByService.length > 0 ? (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData.revenueByService.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 10 }} stroke={isDark ? "#64748b" : "#94a3b8"} />
                              <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} stroke={isDark ? "#64748b" : "#94a3b8"} width={100} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  backgroundColor: isDark ? "#1e293b" : "#fff",
                                  color: isDark ? "#e2e8f0" : "#1e293b",
                                }}
                                formatter={(v: number) => [`Rs. ${v.toLocaleString()}`, "Revenue"]}
                              />
                              <Bar dataKey="revenue" fill={isGold ? "#D4A73A" : "#D4A73A"} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className={cn("flex flex-col items-center justify-center h-[280px]", textSecondary)}>
                          <Wallet className="h-10 w-10 mb-2 opacity-30" />
                          <p className="text-sm">No service breakdown data</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top Clients by Revenue & Recent Payments */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top Clients by Revenue */}
                  <Card className={cardBg}>
                    <CardHeader className="pb-2">
                      <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                        <Building2 className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-500")} />
                        Top Clients by Revenue
                      </CardTitle>
                      <CardDescription className={textSecondary}>Top 5 revenue-generating clients</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                            <TableHead className="text-xs">Client</TableHead>
                            <TableHead className="text-xs text-right">Revenue</TableHead>
                            <TableHead className="text-xs text-right">Orders</TableHead>
                            <TableHead className="text-xs">Plan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {revenueData.topClients.slice(0, 5).map((client, i) => (
                            <TableRow
                              key={i}
                              className={cn(
                                "border-b",
                                isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                              )}
                            >
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white",
                                    i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600" :
                                    i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                                    i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                                    isGold ? "bg-amber-500/20 text-amber-400" : "bg-slate-100 text-slate-500"
                                  )}>
                                    {i + 1}
                                  </div>
                                  <span className={cn("text-sm font-medium truncate max-w-[120px]", textPrimary)}>{client.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <span className={cn("text-sm font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                                  {formatPKR(client.revenue)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <span className={cn("text-sm", textPrimary)}>{client.orders}</span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] font-semibold",
                                    isGold ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-100 text-amber-700 border-amber-200"
                                  )}
                                >
                                  {client.plan}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Recent Payments Table */}
                  <Card className={cardBg}>
                    <CardHeader className="pb-2">
                      <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                        <ArrowDownLeft className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-500")} />
                        Recent Payments
                      </CardTitle>
                      <CardDescription className={textSecondary}>Last 5 payments received</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                            <TableHead className="text-xs">Client</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Method</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {revenueData.recentPayments.slice(0, 5).map((payment) => (
                            <TableRow
                              key={payment.id}
                              className={cn(
                                "border-b",
                                isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                              )}
                            >
                              <TableCell className="py-2.5">
                                <span className={cn("text-sm font-medium truncate max-w-[100px]", textPrimary)}>{payment.clientName}</span>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <span className={cn("text-sm font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                                  {formatPKR(payment.amount)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className={cn("text-xs", textSecondary)}>{payment.method}</span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] font-semibold",
                                    payment.status === "approved"
                                      ? "bg-green-500/10 text-green-600 border-green-200"
                                      : payment.status === "rejected"
                                      ? "bg-red-500/10 text-red-600 border-red-200"
                                      : "bg-amber-500/10 text-amber-600 border-amber-200"
                                  )}
                                >
                                  {payment.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="text-xs text-slate-400">{formatDate(payment.date)}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                          {revenueData.recentPayments.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className={cn("text-center py-8", textSecondary)}>
                                No recent payments
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </div>

          {/* Feature Toggles - Lock/Unlock Professional & Enterprise Features */}
          <Card className={cn(cardBg)}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                    <ToggleRight className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-500")} />
                    Feature Toggles
                  </CardTitle>
                  <CardDescription className={textSecondary}>
                    Lock or unlock features for Professional and Enterprise plans. Platform Owner always has full access.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={saveFeatureToggles}
                  disabled={featureTogglesSaving}
                  className={cn(
                    "gap-2",
                    isGold
                      ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                >
                  <Save className="h-3.5 w-3.5" />
                  {featureTogglesSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Professional Plan Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={cn("text-xs font-semibold bg-amber-500/10 text-amber-600 border-amber-200")}>
                    Professional Plan
                  </Badge>
                  <span className={cn("text-[11px]", textSecondary)}>
                    {professionalFeatures.length} features - {lockedProfessionalFeatures.size} locked
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {professionalFeatures.map((feature) => {
                    const isLocked = lockedProfessionalFeatures.has(feature.id);
                    return (
                      <div
                        key={feature.id}
                        onClick={() => toggleProfessionalFeature(feature.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none",
                          isLocked
                            ? isDark
                              ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
                              : "border-red-200 bg-red-50 hover:border-red-300"
                            : isDark
                              ? "border-white/[0.06] bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/5"
                              : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isLocked
                            ? <Lock className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            : <Unlock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          }
                          <span className={cn("text-xs font-medium truncate", isLocked ? "text-slate-500" : textPrimary)}>
                            {feature.label}
                          </span>
                        </div>
                        <div className={cn(
                          "h-5 w-9 rounded-full transition-colors flex-shrink-0 relative",
                          isLocked ? "bg-red-500/30" : isGold ? "bg-amber-500" : "bg-amber-500"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                            isLocked ? "left-0.5" : "left-[18px]"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enterprise Plan Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={cn("text-xs font-semibold bg-amber-500/10 text-amber-600 border-amber-200")}>
                    Enterprise Plan
                  </Badge>
                  <span className={cn("text-[11px]", textSecondary)}>
                    {enterpriseFeatures.length} features - {lockedEnterpriseFeatures.size} locked
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {enterpriseFeatures.map((feature) => {
                    const isLocked = lockedEnterpriseFeatures.has(feature.id);
                    return (
                      <div
                        key={feature.id}
                        onClick={() => toggleEnterpriseFeature(feature.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none",
                          isLocked
                            ? isDark
                              ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
                              : "border-red-200 bg-red-50 hover:border-red-300"
                            : isDark
                              ? "border-white/[0.06] bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/5"
                              : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isLocked
                            ? <Lock className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            : <Unlock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          }
                          <span className={cn("text-xs font-medium truncate", isLocked ? "text-slate-500" : textPrimary)}>
                            {feature.label}
                          </span>
                        </div>
                        <div className={cn(
                          "h-5 w-9 rounded-full transition-colors flex-shrink-0 relative",
                          isLocked ? "bg-red-500/30" : "bg-amber-500"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                            isLocked ? "left-0.5" : "left-[18px]"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client List */}
          <Card className={cn(cardBg)}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className={cn("text-base font-semibold", textPrimary)}>Client Directory</CardTitle>
                  <CardDescription className={textSecondary}>
                    Showing {filteredClients.length} of {clients.length} clients
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9 w-full sm:w-[200px] text-sm"
                    />
                  </div>
                  {/* Plan filter */}
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="h-9 w-[130px] text-sm">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Sort */}
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="h-9 w-[130px] text-sm">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Latest</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="orders">Orders</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  >
                    {sortDir === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                      <TableHead className="text-xs">Client</TableHead>
                      <TableHead className="text-xs">Plan</TableHead>
                      <TableHead className="text-xs">Owner</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                      <TableHead className="text-xs text-right">Orders</TableHead>
                      <TableHead className="text-xs text-right">Products</TableHead>
                      <TableHead className="text-xs">Members</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                      <TableHead className="text-xs">Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredClients.map((client, i) => (
                        <tr
                          key={client.id}
                          className={cn(
                            "border-b transition-colors",
                            isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          <TableCell className="font-medium py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white",
                                isGold ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-amber-500 to-amber-700"
                              )}>
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("text-sm font-medium truncate max-w-[150px]", textPrimary)}>{client.name}</p>
                                <p className="text-xs text-slate-400 truncate max-w-[150px]">{client.email || "-"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] font-semibold",
                                client.plan === "enterprise"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : client.plan === "professional"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className={cn("text-sm", textPrimary)}>{client.owner?.name || "-"}</p>
                            <p className="text-xs text-slate-400">{client.owner?.email || ""}</p>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <p className={cn("text-sm font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                              {formatPKR(client.revenueTotal)}
                            </p>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <p className={cn("text-sm", textPrimary)}>{client.orderCount}</p>
                            {client.ordersThisMonth > 0 && (
                              <p className="text-[10px] text-amber-500">+{client.ordersThisMonth} this month</p>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <p className={cn("text-sm", textPrimary)}>{client.productCount}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className={cn("text-sm", textPrimary)}>{client.memberCount}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="text-xs text-slate-400">{formatDate(client.createdAt)}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="text-xs text-slate-400">{formatDate(client.lastActivity)}</p>
                          </TableCell>
                        </tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                {filteredClients.length === 0 && (
                  <div className={cn("flex flex-col items-center justify-center py-16", textSecondary)}>
                    <Users className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No clients found</p>
                  </div>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-4 space-y-3">
                {filteredClients.map((client) => (
                  <div key={client.id} className={cn("p-4 rounded-xl border", isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-slate-50/50")}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white",
                          isGold ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-amber-500 to-amber-700"
                        )}>
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={cn("text-sm font-medium", textPrimary)}>{client.name}</p>
                          <p className="text-xs text-slate-400">{client.owner?.name || "-"}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-semibold",
                          client.plan === "enterprise"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : client.plan === "professional"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                      <div>
                        <p className={cn("text-xs", textSecondary)}>Revenue</p>
                        <p className={cn("text-sm font-bold", isGold ? "text-amber-400" : "text-amber-600")}>{formatPKR(client.revenueTotal)}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs", textSecondary)}>Orders</p>
                        <p className={cn("text-sm font-bold", textPrimary)}>{client.orderCount}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs", textSecondary)}>Products</p>
                        <p className={cn("text-sm font-bold", textPrimary)}>{client.productCount}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                      <p className="text-[11px] text-slate-400">Joined {formatDate(client.createdAt)}</p>
                      <p className="text-[11px] text-slate-400">Last active {formatDate(client.lastActivity)}</p>
                    </div>
                  </div>
                ))}
                {filteredClients.length === 0 && (
                  <div className={cn("flex flex-col items-center justify-center py-16", textSecondary)}>
                    <Users className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No clients found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
