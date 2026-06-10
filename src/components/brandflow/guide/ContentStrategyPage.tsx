"use client";

import { motion } from "framer-motion";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Video, Zap, Users, Rocket, Gift, TrendingUp, Hash,
  Target, Trophy, ArrowRight, Flame, Star, Crown,
  Megaphone, BarChart3,
} from "lucide-react";

const PLATFORM_STYLES = [
  { platform: "TikTok", duration: "30-60s", style: "Raw, fast-paced, trending sounds, text overlays, jump cuts", engagement: "5.91%" },
  { platform: "YouTube Shorts", duration: "45-60s", style: "Hook in first 3s, tutorial-style, clear CTA, loop ending", engagement: "4.8%" },
  { platform: "IG Reels", duration: "15-30s", style: "Aesthetic, brand-consistent, carousel bridge, save-worthy", engagement: "4.2%" },
  { platform: "Twitter/X", duration: "15-280 chars", style: "Punchy hooks, thread format, poll engagement, hot takes", engagement: "1.2%" },
  { platform: "LinkedIn", duration: "Long-form", style: "Professional storytelling, data-driven, thought leadership", engagement: "2.8%" },
];

const GROWTH_STRATEGIES = [
  {
    title: "Product Hunt Launch",
    icon: Rocket,
    color: "from-orange-500 to-red-500",
    metrics: ["Top-5 Daily Product", "500+ Upvotes", "2,000+ Signups in 48hrs"],
    details: "Launch Valtriox on Product Hunt with an exclusive deal for early adopters. Prepare a compelling product page with demo video, feature list, and maker story. Engage with every comment in the first 6 hours.",
  },
  {
    title: "Beta Access Waitlist",
    icon: Crown,
    color: "from-amber-500 to-yellow-400",
    metrics: ["10,000+ Signups", "Viral Coefficient >1.5", "50% Referral Rate"],
    details: "Create exclusivity with invite-only beta access. Use viral sharing mechanics where users get faster access by referring friends. Showcase waitlist counter on landing page for social proof.",
  },
  {
    title: "Referral Program",
    icon: Gift,
    color: "from-green-500 to-emerald-400",
    metrics: ["30% from Referrals", "60% CAC Reduction", "3x LTV Increase"],
    details: "Double-sided referral rewards: both referrer and referred get premium features or credits. Gamify with leaderboard, milestone rewards, and tiered incentives. Integrate seamlessly into onboarding flow.",
  },
  {
    title: "Influencer Partnerships",
    icon: Star,
    color: "from-purple-500 to-pink-400",
    metrics: ["5M+ Impressions/Month", "3-5% Conversion Rate", "20+ Active Partners"],
    details: "Partner with SaaS micro-influencers and tech YouTubers for product reviews, tutorials, and case studies. Offer long-term ambassador deals with revenue sharing for sustained promotion.",
  },
  {
    title: "Community-Led Growth",
    icon: Users,
    color: "from-blue-500 to-cyan-400",
    metrics: ["50%+ Monthly Engagement", "10K+ Community Members", "NPS >70"],
    details: "Build Discord and Slack communities for power users. Host monthly webinars, weekly office hours, and quarterly product roadmap reviews. Empower community champions with exclusive access.",
  },
];

const HASHTAG_STRATEGIES = [
  {
    category: "Branded",
    icon: Hash,
    hashtags: ["#Valtriox", "#ValtrioxPortal", "#ValtrioxApp", "#ValtrioxTech", "#BuiltWithValtriox"],
  },
  {
    category: "Niche",
    icon: Target,
    hashtags: ["#BrandManagement", "#SaaSPakistan", "#EcommerceTools", "#InventoryManagement", "#BrandGrowth"],
  },
  {
    category: "Trending",
    icon: Flame,
    hashtags: ["#TechStartup", "#ProductLaunch", "#NoCode", "#SaaSGrowth", "#FounderJourney"],
  },
];

export function ContentStrategyPage() {
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
            <Video className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Content Strategy & Viral Growth Playbook
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Short-form dominance, growth hacking, and hashtag strategies
            </p>
          </div>
        </div>
      </motion.div>

      {/* Short-Form Video Dominance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`rounded-2xl border p-6 ${
          isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Short-Form Video Dominance
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              The #1 growth channel for SaaS in 2026
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "Engagement Rate", value: "5.91%", sub: "vs 0.47% static" },
            { label: "Daily Views", value: "200B+", sub: "across all platforms" },
            { label: "Algorithm Boost", value: "3.2x", sub: "reach multiplier" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`p-4 rounded-xl text-center ${
                isDark ? "bg-white/[0.04]" : "bg-slate-50"
              }`}
            >
              <p className={`text-2xl font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>{stat.value}</p>
              <p className={`text-xs font-medium mt-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{stat.label}</p>
              <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stat.sub}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Platform-Specific Content Styles Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className={`rounded-2xl border overflow-hidden ${
          isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            Platform-Specific Content Styles
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Tailored content for maximum platform engagement
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? "bg-white/[0.03]" : "bg-slate-50"}>
                {["Platform", "Duration", "Style", "Engagement"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLATFORM_STYLES.map((row, i) => (
                <tr
                  key={row.platform}
                  className={`border-t ${isDark ? "border-white/[0.04]" : "border-slate-100"}`}
                >
                  <td className={`px-4 py-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {row.platform}
                  </td>
                  <td className={`px-4 py-3 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    {row.duration}
                  </td>
                  <td className={`px-4 py-3 max-w-[300px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {row.style}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"
                    }`}>
                      {row.engagement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Growth Hacking Strategies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}>
          Growth Hacking Strategies
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {GROWTH_STRATEGIES.map((strategy, index) => (
            <motion.div
              key={strategy.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + index * 0.08 }}
              className={`rounded-2xl border p-6 ${
                isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${strategy.color} flex items-center justify-center`}>
                  <strategy.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{strategy.title}</h3>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex flex-wrap gap-2 mb-4">
                {strategy.metrics.map((metric) => (
                  <span
                    key={metric}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      isDark
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <Trophy className="inline h-3 w-3 mr-1" />
                    {metric}
                  </span>
                ))}
              </div>

              <p className={`text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {strategy.details}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Hashtag Strategy */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className={`rounded-2xl border p-6 ${
          isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <Hash className="h-4 w-4 text-white" />
          </div>
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            Hashtag Strategy
          </h2>
        </div>
        <div className="space-y-5">
          {HASHTAG_STRATEGIES.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-3">
                <group.icon className="h-4 w-4 text-amber-500" />
                <p className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  {group.category}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                      isDark
                        ? "bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20"
                        : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
