"use client";

import { useValtrioxStore } from "@/store/brandflow-store";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface RevenueChartProps {
  data?: Array<{ month: string; revenue: number }>;
}

// Premium tooltip component
function CustomTooltip({ active, payload, label, isDark, isGold }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "px-3 py-2.5 rounded-lg shadow-xl border backdrop-blur-md transition-all",
        isGold
          ? "bg-black/80 border-amber-500/20 shadow-amber-500/10"
          : isDark
          ? "bg-slate-800/95 border-slate-700/50"
          : "bg-white/95 border-slate-200 shadow-slate-200/50"
      )}
    >
      <p className={cn("text-[11px] font-medium mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
        {label}
      </p>
      <p className={cn("text-sm font-bold tabular-nums", isGold ? "text-amber-400" : "text-amber-600")}>
        Rs. {payload[0]?.value?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
      </p>
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";
  const isGold = appTheme === "premium-dark";

  const cardClass = isGold
    ? "bg-white/[0.03] border-white/[0.06]"
    : isDark
    ? "bg-slate-800/50 border-slate-700/50"
    : "bg-white border-slate-200";

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  const hasData = data && data.length > 0 && data.some((d) => d.revenue > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={cn("transition-all duration-300", cardClass)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center",
                isGold ? "bg-amber-500/10" : "bg-amber-100"
              )}>
                <TrendingUp className={cn("w-3.5 h-3.5", isGold ? "text-amber-400" : "text-amber-600")} />
              </div>
              <CardTitle className={cn("text-base font-semibold", textPrimary)}>
                Revenue Trend
              </CardTitle>
            </div>
            {hasData && (
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                isGold ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
              )}>
                Monthly
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isGold ? "#D3A638" : "#f59e0b"} stopOpacity={0.35} />
                      <stop offset="60%" stopColor={isGold ? "#D3A638" : "#f59e0b"} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={isGold ? "#D3A638" : "#f59e0b"} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={isGold ? "#D3A638" : "#f59e0b"} />
                      <stop offset="50%" stopColor={isGold ? "#f5c842" : "#fbbf24"} />
                      <stop offset="100%" stopColor={isGold ? "#D3A638" : "#f59e0b"} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isGold ? "rgba(255,255,255,0.04)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.6)",
                    }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.6)",
                    }}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                    }
                    dx={-4}
                  />
                  <Tooltip
                    content={<CustomTooltip isDark={isDark} isGold={isGold} />}
                    cursor={{
                      stroke: isGold ? "rgba(211,166,56,0.3)" : "rgba(245,158,11,0.3)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="url(#lineGradient)"
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: isGold ? "#D3A638" : "#f59e0b",
                      stroke: isGold ? "#000" : "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <div className="text-center">
                <div className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all",
                  isGold
                    ? "bg-gradient-to-br from-amber-500/10 to-amber-600/5 ring-1 ring-amber-500/10"
                    : isDark
                    ? "bg-slate-800/50"
                    : "bg-slate-100"
                )}>
                  <BarChart3 className={cn(
                    "h-8 w-8",
                    isGold ? "text-amber-400/40" : isDark ? "text-slate-600" : "text-slate-400"
                  )} />
                </div>
                <h3 className={cn("text-sm font-semibold mb-1", textPrimary)}>No revenue data yet</h3>
                <p className={cn("text-xs max-w-[200px] mx-auto leading-relaxed", textMuted)}>
                  Start selling products to see your revenue trends visualized here with live analytics.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
