"use client";

import { motion } from "framer-motion";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Calendar, Rocket, PenTool, Zap, Users, BookOpen, Settings,
  DollarSign, Brain, Smartphone, Handshake, ClipboardCheck,
  CheckCircle2, ArrowRight, Target,
} from "lucide-react";

const MONTHS = [
  {
    month: 1,
    title: "Foundation",
    phase: "Setup",
    icon: Rocket,
    color: "from-blue-500 to-cyan-400",
    items: [
      "Finalize brand identity system (logo, colors, typography)",
      "Create & optimize all social media profiles",
      "Implement SEO strategy with target keywords",
      "Launch landing page with A/B testing",
      "Set up analytics tracking (GA4, Mixpanel)",
      "Configure email marketing automation",
    ],
  },
  {
    month: 2,
    title: "Content Pipeline",
    phase: "Build",
    icon: PenTool,
    color: "from-purple-500 to-pink-400",
    items: [
      "Publish 30 social media posts across platforms",
      "Launch blog with 5 SEO-optimized articles",
      "Create keyword strategy for top 50 terms",
      "Produce first batch of short-form video content",
      "Set up content calendar and scheduling tools",
      "Design email drip campaign templates",
    ],
  },
  {
    month: 3,
    title: "Launch",
    phase: "Go Live",
    icon: Zap,
    color: "from-amber-500 to-yellow-400",
    items: [
      "Product Hunt launch (target Top-5 daily)",
      "Outreach to 20+ micro-influencers",
      "Launch first Meta ad campaign (Instagram + Facebook)",
      "Press release distribution to tech media",
      "Activate referral program with rewards",
      "Host launch webinar / live stream event",
    ],
  },
  {
    month: 4,
    title: "Community",
    phase: "Engage",
    icon: Users,
    color: "from-green-500 to-emerald-400",
    items: [
      "Launch Discord community & Slack workspace",
      "Implement email nurture sequence (5-touch)",
      "Referral program beta testing and optimization",
      "First user community event (AMA session)",
      "Collect and implement early user feedback",
      "Create community guidelines and moderation",
    ],
  },
  {
    month: 5,
    title: "Authority",
    phase: "Establish",
    icon: BookOpen,
    color: "from-indigo-500 to-violet-400",
    items: [
      "Publish first detailed customer case study",
      "Launch webinar series (weekly schedule)",
      "Content repurposing across all platforms",
      "Guest posting on 5+ industry publications",
      "Build thought leadership through LinkedIn articles",
      "Create product demo videos and tutorials",
    ],
  },
  {
    month: 6,
    title: "Optimization",
    phase: "Refine",
    icon: Settings,
    color: "from-orange-500 to-red-400",
    items: [
      "Comprehensive analytics review and reporting",
      "Content strategy optimization based on data",
      "Referral program public launch with gamification",
      "SEO performance audit and keyword expansion",
      "Ad campaign optimization and retargeting setup",
      "Conversion funnel analysis and improvements",
    ],
  },
  {
    month: 7,
    title: "Feature Launch",
    phase: "Ship",
    icon: Rocket,
    color: "from-teal-500 to-cyan-400",
    items: [
      "Launch WebSocket real-time engine",
      "Product demo sessions for enterprise leads",
      "Press release for new features",
      "Feature update email campaign to all users",
      "Update onboarding flow with new capabilities",
      "Performance benchmarking and case studies",
    ],
  },
  {
    month: 8,
    title: "Revenue",
    phase: "Monetize",
    icon: DollarSign,
    color: "from-emerald-500 to-green-400",
    items: [
      "Launch payment gateway integration",
      "Publish customer success stories (3+)",
      "Attend and sponsor industry events",
      "Enterprise sales funnel optimization",
      "Annual billing option with discount incentives",
      "Pricing page A/B testing and optimization",
    ],
  },
  {
    month: 9,
    title: "AI & Scale",
    phase: "Innovate",
    icon: Brain,
    color: "from-fuchsia-500 to-purple-400",
    items: [
      "AI-powered features beta launch",
      "Influencer partnership wave 2 (20+ partners)",
      "Community milestone celebrations and rewards",
      "AI content generation tools rollout",
      "Predictive analytics and smart recommendations",
      "Scale infrastructure for 10x growth",
    ],
  },
  {
    month: 10,
    title: "Mobile",
    phase: "Expand",
    icon: Smartphone,
    color: "from-rose-500 to-pink-400",
    items: [
      "Mobile app closed beta launch (iOS + Android)",
      "App store listing optimization (ASO)",
      "User feedback loop and iteration cycle",
      "Cross-platform sync and notification setup",
      "Mobile-specific feature development",
      "Beta user onboarding and support channels",
    ],
  },
  {
    month: 11,
    title: "Expansion",
    phase: "Partner",
    icon: Handshake,
    color: "from-sky-500 to-blue-400",
    items: [
      "Strategic partnership development",
      "Co-marketing campaigns with partners",
      "Mobile app public beta launch",
      "International market research and planning",
      "Multi-language support development",
      "Partner API and integration ecosystem",
    ],
  },
  {
    month: 12,
    title: "Review",
    phase: "Reflect",
    icon: ClipboardCheck,
    color: "from-amber-600 to-amber-400",
    items: [
      "Annual comprehensive review and reporting",
      "2027 strategic roadmap development",
      "Investor update and fundraising preparation",
      "Team performance review and expansion planning",
      "Customer satisfaction survey and analysis",
      "Year-end marketing campaign (holiday season)",
    ],
  },
];

export function MarketLaunchTimelinePage() {
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
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Market Launch Timeline
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              12-Month Execution Plan for Valtriox 2026
            </p>
          </div>
        </div>
      </motion.div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/50 via-amber-500/20 to-transparent hidden sm:block" />

        <div className="space-y-6">
          {MONTHS.map((month, index) => (
            <motion.div
              key={month.month}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div className="hidden sm:flex absolute -left-[2px] top-6 h-4 w-4 rounded-full border-2 border-amber-500 bg-[#0a0a0f] z-10">
                <div className={`absolute inset-0.5 rounded-full bg-gradient-to-br ${month.color}`} />
              </div>

              <div
                className={`sm:ml-12 rounded-2xl border overflow-hidden ${
                  isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
                }`}
              >
                {/* Month Header */}
                <div className={`px-5 py-3 bg-gradient-to-r ${month.color} bg-opacity-10 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                      <month.icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Month {month.month}: {month.title}</h3>
                      <p className="text-[11px] text-white/70">Phase: {month.phase}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    isDark
                      ? "bg-white/10 text-white/90"
                      : "bg-black/10 text-black/70"
                  }`}>
                    M{month.month}
                  </span>
                </div>

                {/* Items */}
                <div className="p-5">
                  <ul className="space-y-2.5">
                    {month.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isDark ? "text-amber-500/70" : "text-amber-500"}`} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
