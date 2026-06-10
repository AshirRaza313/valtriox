"use client";

import { motion } from "framer-motion";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Map, Zap, CreditCard, Truck, Brain, Workflow, UserCircle,
  Warehouse, Globe, Smartphone, BarChart3, Receipt, Shield,
  Languages, MessageSquare,
} from "lucide-react";

interface FeatureItem {
  name: string;
  priority: string;
  duration: string;
  description: string;
  icon: any;
}

interface Phase {
  phase: string;
  period: string;
  color: string;
  gradient: string;
  features: FeatureItem[];
}

const PHASES: Phase[] = [
  {
    phase: "Phase 1",
    period: "Q3 2026",
    color: "amber",
    gradient: "from-amber-500 to-orange-500",
    features: [
      {
        name: "WebSocket Engine",
        priority: "P0",
        duration: "8 weeks",
        description: "Real-time order tracking, live notifications, team chat, and instant inventory updates via WebSocket protocol.",
        icon: Zap,
      },
      {
        name: "Payment Gateway",
        priority: "P0",
        duration: "6 weeks",
        description: "Stripe, JazzCash, EasyPaisa, and bank transfer integration with automated invoicing and receipt generation.",
        icon: CreditCard,
      },
      {
        name: "Courier API",
        priority: "P0",
        duration: "5 weeks",
        description: "TCS, Leopards, M&P courier integration with automated tracking, rate calculation, and shipment labels.",
        icon: Truck,
      },
    ],
  },
  {
    phase: "Phase 2",
    period: "Q4 2026",
    color: "purple",
    gradient: "from-purple-500 to-pink-500",
    features: [
      {
        name: "AI Inventory Forecasting",
        priority: "P1",
        duration: "10 weeks",
        description: "Machine learning-powered demand prediction, auto-reorder suggestions, and stock optimization algorithms.",
        icon: Brain,
      },
      {
        name: "Workflow Automation",
        priority: "P1",
        duration: "8 weeks",
        description: "Visual workflow builder for automated order processing, status transitions, and team notifications.",
        icon: Workflow,
      },
      {
        name: "CRM Customer 360",
        priority: "P1",
        duration: "7 weeks",
        description: "Complete customer profile with lifetime value, purchase history, communication logs, and segmentation tools.",
        icon: UserCircle,
      },
      {
        name: "Multi-Warehouse",
        priority: "P2",
        duration: "6 weeks",
        description: "Multi-location warehouse management with stock transfers, location-based fulfillment, and capacity planning.",
        icon: Warehouse,
      },
    ],
  },
  {
    phase: "Phase 3",
    period: "Q1-Q2 2027",
    color: "teal",
    gradient: "from-teal-500 to-cyan-500",
    features: [
      {
        name: "E-Commerce Storefront",
        priority: "P1",
        duration: "12 weeks",
        description: "Custom online storefront with product catalog, shopping cart, checkout, and integration with Valtriox backend.",
        icon: Globe,
      },
      {
        name: "Mobile App",
        priority: "P2",
        duration: "14 weeks",
        description: "Native iOS and Android app with offline support, push notifications, barcode scanning, and full dashboard.",
        icon: Smartphone,
      },
      {
        name: "Analytics Builder",
        priority: "P2",
        duration: "10 weeks",
        description: "Custom report builder with drag-and-drop metrics, scheduled exports, and multi-dimensional analysis.",
        icon: BarChart3,
      },
      {
        name: "Accounting",
        priority: "P2",
        duration: "6 weeks",
        description: "Integrated bookkeeping with expense tracking, tax calculations, P&L reports, and bank reconciliation.",
        icon: Receipt,
      },
    ],
  },
  {
    phase: "Phase 4",
    period: "Q3-Q4 2027",
    color: "rose",
    gradient: "from-rose-500 to-red-500",
    features: [
      {
        name: "Multi-Language RTL",
        priority: "P3",
        duration: "10 weeks",
        description: "Full Arabic, Urdu, and RTL language support with automatic content translation and layout mirroring.",
        icon: Languages,
      },
      {
        name: "2FA Authentication",
        priority: "P2",
        duration: "4 weeks",
        description: "Two-factor authentication with SMS, authenticator app, and email verification for enhanced security.",
        icon: Shield,
      },
      {
        name: "Social Commerce",
        priority: "P3",
        duration: "8 weeks",
        description: "Sell directly through Instagram, Facebook, and TikTok with product tagging, in-app checkout, and social analytics.",
        icon: MessageSquare,
      },
    ],
  },
];

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    P0: "bg-red-500/15 text-red-400 border-red-500/25",
    P1: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    P2: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    P3: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[priority] || styles.P2}`}>
      {priority}
    </span>
  );
}

export function FeatureRoadmapPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <Map className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Feature Upgrade Roadmap
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              4-Phase Development Plan - From Real-Time Engine to Global Scale
            </p>
          </div>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: "Total Phases", value: "4", icon: Map },
          { label: "Features", value: "14", icon: Zap },
          { label: "Dev Weeks", value: "104+", icon: Workflow },
          { label: "Timeline", value: "~18 mo", icon: Calendar },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl border ${
              isDark
                ? "bg-white/[0.03] border-white/[0.06]"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-amber-500" />
            </div>
            <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Phases */}
      <div className="space-y-8">
        {PHASES.map((phase, pIndex) => (
          <motion.div
            key={phase.phase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 + pIndex * 0.1 }}
          >
            {/* Phase Header */}
            <div className={`flex items-center gap-4 mb-4`}>
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${phase.gradient} flex items-center justify-center shadow-lg`}>
                <span className="text-white font-black text-lg">{pIndex + 1}</span>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {phase.phase} - {phase.period}
                </h2>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {phase.features.length} features · {phase.features.reduce((sum, f) => sum + parseInt(f.duration), 0)} total weeks
                </p>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {phase.features.map((feature, fIndex) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + pIndex * 0.1 + fIndex * 0.06 }}
                  className={`rounded-xl border p-5 ${
                    isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${phase.gradient} flex items-center justify-center opacity-80`}>
                        <feature.icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{feature.name}</h3>
                        <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{feature.duration}</p>
                      </div>
                    </div>
                    <PriorityBadge priority={feature.priority} />
                  </div>
                  <p className={`text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Need Calendar for the stats
function Calendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
