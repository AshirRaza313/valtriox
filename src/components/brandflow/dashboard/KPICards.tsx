"use client";

import { motion } from "framer-motion";
import { DollarSign, ShoppingCart, Users, Star, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useValtrioxStore } from "@/store/brandflow-store";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function TrendBadge({ trend, change, isDark }: { trend: string; change: string; isDark: boolean }) {
  const isUp = trend === "up";
  const isNeutral = trend === "neutral";

  if (isNeutral) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
        isUp
          ? isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
          : isDark ? "text-rose-400 bg-rose-500/10" : "text-rose-500 bg-rose-50"
      }`}
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {change}
    </span>
  );
}

export function KPICards() {
  const { appTheme } = useValtrioxStore();
  const isGold = appTheme === "premium-dark";
  const isDark = appTheme === "dark" || appTheme === "premium-dark";

  const kpis = [
    {
      label: "Total Revenue",
      value: "Rs. 0.00",
      change: "0%",
      trend: "neutral" as const,
      icon: DollarSign,
      iconBg: isGold ? "bg-amber-500/10" : "bg-amber-100",
      iconColor: isGold ? "text-amber-400" : "text-amber-600",
    },
    {
      label: "Active Orders",
      value: "0",
      change: "0",
      trend: "neutral" as const,
      icon: ShoppingCart,
      iconBg: isGold ? "bg-amber-500/10" : "bg-amber-100",
      iconColor: isGold ? "text-amber-400" : "text-amber-600",
    },
    {
      label: "Customers",
      value: "0",
      change: "0",
      trend: "neutral" as const,
      icon: Users,
      iconBg: isGold ? "bg-amber-500/10" : "bg-blue-100",
      iconColor: isGold ? "text-amber-400" : "text-blue-600",
    },
    {
      label: "Satisfaction",
      value: "-",
      change: "No data",
      trend: "neutral" as const,
      icon: Star,
      iconBg: isGold ? "bg-amber-500/10" : "bg-amber-100",
      iconColor: isGold ? "text-amber-400" : "text-amber-600",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {kpis.map((kpi) => (
        <motion.div
          key={kpi.label}
          variants={cardVariants}
          whileHover={{ scale: 1.03, y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {isGold ? (
            <div className="relative rounded-xl p-px bg-gradient-to-br from-amber-500/30 via-transparent to-amber-500/20 group">
              <Card
                className={`kpi-gold-shimmer overflow-hidden transition-all duration-300 bg-white/[0.03] border-0 border-t-2 border-t-amber-500/30 backdrop-blur-sm hover:bg-white/[0.06] hover:shadow-[0_4px_24px_rgba(212,160,23,0.12)]`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center bg-gradient-to-br from-amber-500/15 to-amber-600/5`}>{
                      <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                    }</div>
                    <TrendBadge trend={kpi.trend} change={kpi.change} isDark={isDark} />
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-slate-900"}`}>{kpi.value}</p>
                  <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{kpi.label}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card
              className={`kpi-gold-shimmer overflow-hidden transition-all duration-300 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
                  : "bg-white border-slate-200 hover:shadow-lg hover:shadow-slate-200/60 hover:border-slate-300"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center`}>{
                    <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                  }</div>
                  <TrendBadge trend={kpi.trend} change={kpi.change} isDark={isDark} />
                </div>
                <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-slate-900"}`}>{kpi.value}</p>
                <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{kpi.label}</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
