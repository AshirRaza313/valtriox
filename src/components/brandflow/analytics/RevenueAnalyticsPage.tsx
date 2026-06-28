"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  Activity,
  BarChart3,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  Receipt,
  Repeat,
  PieChart as PieChartIcon,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { EmptyState } from "@/components/brandflow/shared/EmptyState";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────

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

interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ServiceRevenue {
  service: string;
  revenue: number;
  count: number;
}

interface TopClient {
  name: string;
  revenue: number;
  orders: number;
  plan: string;
}

interface RecentPayment {
  id: string;
  clientName: string;
  amount: number;
  method: string;
  status: string;
  date: string;
}

interface ExpenseCategory {
  category: string;
  amount: number;
}

interface RevenueData {
  summary: RevenueSummary;
  revenueByMonth: MonthlyRevenue[];
  revenueByService: ServiceRevenue[];
  topClients: TopClient[];
  recentPayments: RecentPayment[];
  expensesByCategory: ExpenseCategory[];
}

// ─── Constants ──────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#D3A638",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#6366f1",
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  approved: { icon: CheckCircle, color: "text-emerald-500", label: "Approved" },
  pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
  paid: { icon: CheckCircle, color: "text-emerald-500", label: "Paid" },
  cancelled: { icon: XCircle, color: "text-slate-400", label: "Cancelled" },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Skeleton Loader ───────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="border-slate-200 dark:border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
              <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-white/10 animate-pulse" />
            </div>
            <div className="h-8 w-32 bg-slate-200 dark:bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-white/[0.06]">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="h-[320px] bg-slate-100 dark:bg-white/5 rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ─── KPI Card Component ────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  gradientClass?: string;
  iconColorClass?: string;
  index: number;
}

function KPICard({ title, value, icon: Icon, trend, gradientClass, iconColorClass, index }: KPICardProps) {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <Card className={cn(
        "transition-all hover:shadow-md",
        isDark ? "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1]" : "bg-white border-slate-200 hover:border-slate-300"
      )}>
        <CardContent className="p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium uppercase tracking-wider mb-1.5",
                isDark ? "text-slate-400" : "text-slate-500"
              )}>
                {title}
              </p>
              <p className={cn("text-2xl lg:text-3xl font-bold truncate",
                isDark ? "text-white" : "text-slate-900"
              )}>
                {value}
              </p>
              {trend !== undefined && (
                <div className={cn("flex items-center gap-1 mt-1.5 text-xs font-medium",
                  trend >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {trend >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  <span>{Math.abs(trend).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
              gradientClass || (isGold ? "bg-amber-500/10" : "bg-amber-100")
            )}>
              <Icon className={cn("h-5 w-5",
                iconColorClass || (isGold ? "text-amber-400" : "text-amber-600")
              )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── CSV Export Helper ──────────────────────────────────────────────────

function exportCSV(data: RevenueData) {
  try {
    const lines: string[] = [];

    // Summary
    lines.push("Revenue Analytics Summary");
    lines.push("Metric,Value");
    lines.push(`Total Revenue,${data.summary.totalRevenue}`);
    lines.push(`Monthly Recurring Revenue,${data.summary.monthlyRecurring}`);
    lines.push(`Pending Payments,${data.summary.pendingPayments}`);
    lines.push(`Paid This Month,${data.summary.paidThisMonth}`);
    lines.push(`Paid This Year,${data.summary.paidThisYear}`);
    lines.push(`Average Order Value,${data.summary.averageOrderValue}`);
    lines.push(`Proposal Conversion Rate,${data.summary.proposalConversionRate}%`);
    lines.push(`Active Subscriptions,${data.summary.activeSubscriptions}`);
    lines.push(`Total Expenses,${data.summary.totalExpenses}`);
    lines.push(`Net Profit Margin,${data.summary.netProfitMargin}%`);
    lines.push("");

    // Monthly Revenue
    lines.push("Monthly Revenue Trends");
    lines.push("Month,Revenue,Expenses,Profit");
    data.revenueByMonth.forEach((m) => {
      lines.push(`${m.month},${m.revenue},${m.expenses},${m.profit}`);
    });
    lines.push("");

    // Revenue by Service
    lines.push("Revenue by Service");
    lines.push("Service,Revenue,Count");
    data.revenueByService.forEach((s) => {
      lines.push(`${s.service},${s.revenue},${s.count}`);
    });
    lines.push("");

    // Top Clients
    lines.push("Top Clients");
    lines.push("Client,Revenue,Orders,Plan");
    data.topClients.forEach((c) => {
      lines.push(`${c.name},${c.revenue},${c.orders},${c.plan}`);
    });
    lines.push("");

    // Recent Payments
    lines.push("Recent Payments");
    lines.push("Client,Amount,Method,Status,Date");
    data.recentPayments.forEach((p) => {
      lines.push(`${p.clientName},${p.amount},${p.method},${p.status},${p.date}`);
    });
    lines.push("");

    // Expenses
    lines.push("Expenses by Category");
    lines.push("Category,Amount");
    data.expensesByCategory.forEach((e) => {
      lines.push(`${e.category},${e.amount}`);
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenue-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Revenue report exported as CSV");
  } catch {
    toast.error("Failed to export report");
  }
}

// ─── Main Component ────────────────────────────────────────────────────

export function RevenueAnalyticsPage() {
  const { appTheme, setActiveSection } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("year");

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/revenue?period=${period}&year=${new Date().getFullYear()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch revenue data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── KPI Cards Config ──────────────────────────────────────────────
  const kpiCards = data ? [
    {
      title: "Total Revenue",
      value: formatPKR(data.summary.totalRevenue),
      icon: DollarSign,
      trend: data.summary.paidThisYear > 0 ? 12.5 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-amber-500/20 to-yellow-600/20" : "bg-amber-100",
      iconColorClass: isGold ? "text-amber-400" : "text-amber-600",
    },
    {
      title: "Monthly Recurring (MRR)",
      value: formatPKR(data.summary.monthlyRecurring),
      icon: Repeat,
      trend: data.summary.monthlyRecurring > 0 ? 8.3 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-emerald-500/20 to-teal-600/20" : "bg-emerald-100",
      iconColorClass: isGold ? "text-emerald-400" : "text-emerald-600",
    },
    {
      title: "Pending Payments",
      value: formatPKR(data.summary.pendingPayments),
      icon: Clock,
      trend: data.summary.pendingPayments > 0 ? -3.2 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-orange-500/20 to-amber-600/20" : "bg-orange-100",
      iconColorClass: isGold ? "text-orange-400" : "text-orange-600",
    },
    {
      title: "Paid This Month",
      value: formatPKR(data.summary.paidThisMonth),
      icon: CreditCard,
      trend: data.summary.paidThisMonth > 0 ? 5.7 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20" : "bg-cyan-100",
      iconColorClass: isGold ? "text-cyan-400" : "text-cyan-600",
    },
    {
      title: "Avg. Order Value",
      value: formatPKR(data.summary.averageOrderValue),
      icon: BarChart3,
      gradientClass: isGold ? "bg-gradient-to-br from-violet-500/20 to-purple-600/20" : "bg-violet-100",
      iconColorClass: isGold ? "text-violet-400" : "text-violet-600",
    },
    {
      title: "Conversion Rate",
      value: `${data.summary.proposalConversionRate}%`,
      icon: Percent,
      trend: data.summary.proposalConversionRate > 0 ? 2.1 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-pink-500/20 to-rose-600/20" : "bg-pink-100",
      iconColorClass: isGold ? "text-pink-400" : "text-pink-600",
    },
    {
      title: "Active Subscriptions",
      value: data.summary.activeSubscriptions.toString(),
      icon: Users,
      trend: data.summary.activeSubscriptions > 0 ? 10.0 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-sky-500/20 to-blue-600/20" : "bg-sky-100",
      iconColorClass: isGold ? "text-sky-400" : "text-sky-600",
    },
    {
      title: "Net Profit Margin",
      value: `${data.summary.netProfitMargin}%`,
      icon: TrendingUp,
      trend: data.summary.netProfitMargin > 20 ? 4.2 : data.summary.netProfitMargin > 0 ? -1.5 : undefined,
      gradientClass: isGold ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20" : "bg-amber-100",
      iconColorClass: isGold ? "text-amber-400" : "text-amber-600",
    },
  ] : [];

  // ─── Chart Theme Colors ────────────────────────────────────────────
  const chartGridColor = isDark ? "#334155" : "#e2e8f0";
  const chartTickColor = isDark ? "#64748b" : "#94a3b8";
  const chartTooltipStyle = {
    borderRadius: "10px",
    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#1e293b",
    fontSize: "12px",
    boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.3)" : "0 10px 25px rgba(0,0,0,0.1)",
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>
            Revenue Analytics
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Comprehensive revenue tracking, profit analysis, and forecasting
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className={cn(
              "h-9 w-[140px] text-sm",
              isDark ? "bg-white/[0.05] border-white/[0.1]" : ""
            )}>
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => data && exportCSV(data)}
            disabled={!data || loading}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto">
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && !data ? (
        <div className="space-y-6">
          <KPISkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      ) : data ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* ── KPI Cards (2x4 grid) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi, i) => (
              <KPICard key={kpi.title} {...kpi} index={i} />
            ))}
          </div>

          {/* ── Revenue Trends Chart + Service Revenue Chart ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Revenue Trends - Area Chart (3/5 width) */}
            <Card className={cn("lg:col-span-3", cardBg)}>
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Revenue Trends
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Monthly revenue vs expenses over the past 12 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.revenueByMonth.length > 0 ? (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.revenueByMonth} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isGold ? "#D3A638" : "#D3A638"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isGold ? "#D3A638" : "#D3A638"} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={chartTickColor} />
                        <YAxis tick={{ fontSize: 11 }} stroke={chartTickColor} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: number, name: string) => {
                            const label = name === "revenue" ? "Revenue" : name === "expenses" ? "Expenses" : "Profit";
                            return [formatPKR(value), label];
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            if (value === "revenue") return "Revenue";
                            if (value === "expenses") return "Expenses";
                            return "Profit";
                          }}
                          wrapperStyle={{ fontSize: "12px" }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={isGold ? "#D3A638" : "#D3A638"} fill="url(#revenueGradient)" strokeWidth={2} />
                        <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profitGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center h-[320px]", textSecondary)}>
                    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No revenue trend data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expense Breakdown - Pie Chart (2/5 width) */}
            <Card className={cn("lg:col-span-2", cardBg)}>
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <PieChartIcon className="h-4 w-4 text-amber-500" />
                  Expense Breakdown
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Category-wise expense distribution
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {data.expensesByCategory.length > 0 ? (
                  <>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.expensesByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="amount"
                            nameKey="category"
                          >
                            {data.expensesByCategory.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(value: number) => [formatPKR(value), "Amount"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 gap-y-1.5 mt-3 text-xs w-full px-2">
                      {data.expensesByCategory.map((e, i) => (
                        <div key={e.category} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className={cn("truncate", textSecondary)}>{e.category}</span>
                          </div>
                          <span className={cn("font-medium flex-shrink-0", textPrimary)}>{formatPKR(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center h-[280px]", textSecondary)}>
                    <PieChartIcon className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No expense data recorded</p>
                    <p className="text-xs mt-1">Expenses will appear once tracked in the Expenses module</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Revenue by Service Type - Horizontal Bar Chart ── */}
          {data.revenueByService.length > 0 && (
            <Card className={cardBg}>
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  Revenue by Service
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Revenue breakdown by service category and proposal type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenueByService} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke={chartTickColor} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} stroke={chartTickColor} width={150} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number, name: string) => {
                          if (name === "revenue") return [formatPKR(value), "Revenue"];
                          return [value, "Count"];
                        }}
                      />
                      <Bar dataKey="revenue" fill={isGold ? "#D3A638" : "#D3A638"} radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Top Clients + Recent Payments ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Clients Table */}
            <Card className={cardBg}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <Users className="h-4 w-4 text-amber-500" />
                  Top Clients
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Top 10 revenue-generating clients
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data.topClients.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                          <TableHead className="text-xs">Client</TableHead>
                          <TableHead className="text-xs text-right">Revenue</TableHead>
                          <TableHead className="text-xs text-right hidden sm:table-cell">Orders</TableHead>
                          <TableHead className="text-xs">Plan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topClients.map((client, i) => (
                          <TableRow
                            key={i}
                            className={cn(
                              "transition-colors",
                              isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                            )}
                          >
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                                  isGold ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-amber-500 to-amber-700"
                                )}>
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={cn("text-sm font-medium truncate max-w-[120px]", textPrimary)}>
                                  {client.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={cn("text-sm font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                                {formatPKR(client.revenue)}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right hidden sm:table-cell">
                              <span className={cn("text-sm", textPrimary)}>{client.orders}</span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold",
                                  isGold
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-amber-100 text-amber-700 border-amber-200"
                                )}
                              >
                                {client.plan}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center py-12", textSecondary)}>
                    <Users className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No active clients yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Payments */}
            <Card className={cardBg}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-base font-semibold flex items-center gap-2", textPrimary)}>
                  <Receipt className="h-4 w-4 text-amber-500" />
                  Recent Payments
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Latest 10 payment activities
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentPayments.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                          <TableHead className="text-xs">Client</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Method</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentPayments.map((payment) => {
                          const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                          const StatusIcon = statusCfg.icon;
                          return (
                            <TableRow
                              key={payment.id}
                              className={cn(
                                "transition-colors",
                                isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                              )}
                            >
                              <TableCell className="py-2.5">
                                <span className={cn("text-sm font-medium truncate max-w-[120px] block", textPrimary)}>
                                  {payment.clientName}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <span className={cn("text-sm font-semibold", textPrimary)}>
                                  {formatPKR(payment.amount)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                <span className={cn("text-xs", textSecondary)}>{payment.method}</span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div className={cn("flex items-center gap-1.5", statusCfg.color)}>
                                  <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="text-xs font-medium">{statusCfg.label}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 hidden md:table-cell">
                                <span className="text-xs text-slate-400">{formatDate(payment.date)}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className={cn("flex flex-col items-center justify-center py-12", textSecondary)}>
                    <CreditCard className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No payment records yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Quick Actions Row ── */}
          <Card className={cn(cardBg)}>
            <CardContent className="p-4">
              <p className={cn("text-xs font-medium uppercase tracking-wider mb-3", textSecondary)}>
                Quick Actions
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveSection("payment-approvals")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30"
                      : "border-slate-200 hover:shadow-sm hover:border-amber-300"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isGold ? "bg-amber-500/10" : "bg-amber-100"
                  )}>
                    <CheckCircle className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-amber-600")} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", textPrimary)}>Payment Approvals</p>
                    <p className="text-[11px] text-slate-400 truncate">Review proofs</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ml-auto", textSecondary)} />
                </button>
                <button
                  onClick={() => setActiveSection("invoice-management")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30"
                      : "border-slate-200 hover:shadow-sm hover:border-amber-300"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isGold ? "bg-amber-500/10" : "bg-cyan-100"
                  )}>
                    <FileText className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-cyan-600")} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", textPrimary)}>Invoice Management</p>
                    <p className="text-[11px] text-slate-400 truncate">View invoices</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ml-auto", textSecondary)} />
                </button>
                <button
                  onClick={() => setActiveSection("subscription-management")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30"
                      : "border-slate-200 hover:shadow-sm hover:border-amber-300"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isGold ? "bg-amber-500/10" : "bg-violet-100"
                  )}>
                    <Repeat className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-violet-600")} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", textPrimary)}>Subscriptions</p>
                    <p className="text-[11px] text-slate-400 truncate">Manage plans</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ml-auto", textSecondary)} />
                </button>
                <button
                  onClick={() => setActiveSection("proposals")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30"
                      : "border-slate-200 hover:shadow-sm hover:border-amber-300"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isGold ? "bg-amber-500/10" : "bg-emerald-100"
                  )}>
                    <Activity className={cn("h-4.5 w-4.5", isGold ? "text-amber-400" : "text-emerald-600")} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", textPrimary)}>Proposals</p>
                    <p className="text-[11px] text-slate-400 truncate">View proposals</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ml-auto", textSecondary)} />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Empty state when no data */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className={cardBg}>
            <CardContent className="p-8">
              <EmptyState
                icon={TrendingUp}
                title="No revenue data yet"
                description="Revenue data will appear here once you start receiving payments and tracking expenses. Connect with clients, send proposals, and manage subscriptions to begin tracking."
                actionLabel="View Admin Dashboard"
                onAction={() => setActiveSection("admin-dashboard")}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
