"use client";

import { motion } from "framer-motion";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Instagram, Tv, Youtube, Linkedin, Twitter, Facebook, MessageCircle,
  Hash, Clock, TrendingUp, Users, Zap, Target, ArrowRight,
} from "lucide-react";

const PLATFORMS = [
  {
    name: "Instagram",
    handle: "@valtriox.app",
    frequency: "5-7 posts/week + daily Stories",
    contentTypes: ["Reels", "Carousels", "Stories", "Guides"],
    color: "from-pink-500 via-purple-500 to-orange-400",
    icon: Instagram,
    strategy: [
      "Behind-the-scenes product dev content",
      "Educational carousels on brand management",
      "UGC showcasing customer results",
      "SaaS influencer collaborations",
    ],
    growth: [
      "15-20 targeted hashtags per post",
      "DM automation for lead capture",
      "Aggressive Reels strategy (3-5/week)",
      "Cross-platform content sharing",
    ],
  },
  {
    name: "TikTok",
    handle: "@valtriox.app",
    frequency: "4-6 posts/week",
    contentTypes: ["30-60s Tutorials", "Trending Sounds", "Behind-the-Scenes"],
    color: "from-slate-800 via-pink-500 to-cyan-400",
    icon: Tv,
    strategy: [
      "Quick tutorial walkthroughs",
      "Trending sound integration",
      "Founder/team behind-the-scenes",
      "Day-in-the-life content",
    ],
    growth: [
      "Trending sound monitoring (daily)",
      "Peak posting 7-9 PM PKT",
      "Cross-promote Reels to Instagram",
      "Engage comments within first hour",
    ],
  },
  {
    name: "YouTube",
    handle: "Valtriox",
    frequency: "2-3 videos/week + Shorts",
    contentTypes: ["10-20min Tutorials", "Testimonials", "Q&A", "Live Events"],
    color: "from-red-600 to-red-500",
    icon: Youtube,
    strategy: [
      "In-depth product tutorials",
      "Customer success story testimonials",
      "Live Q&A sessions and AMAs",
      "Product launch event recordings",
    ],
    growth: [
      "SEO-optimized titles & descriptions",
      "Consistent upload schedule",
      "Tech YouTuber collaborations",
      "YouTube Shorts for discovery",
    ],
  },
  {
    name: "LinkedIn",
    handle: "/company/valtriox",
    frequency: "3-5 posts/week",
    contentTypes: ["B2B Thought Leadership", "Product Updates", "Hiring", "Articles"],
    color: "from-blue-700 to-blue-500",
    icon: Linkedin,
    strategy: [
      "B2B thought leadership content",
      "Product milestone announcements",
      "Team culture & hiring posts",
      "Long-form industry articles",
    ],
    growth: [
      "Active engagement in SaaS groups",
      "Employee advocacy program",
      "LinkedIn Ads for lead generation",
      "Comment on industry leaders' posts",
    ],
  },
  {
    name: "Twitter/X",
    handle: "@valtrioxapp",
    frequency: "5-10 tweets/week",
    contentTypes: ["Quick Updates", "Threads", "Polls", "Community Engagement"],
    color: "from-gray-900 to-gray-600",
    icon: Twitter,
    strategy: [
      "Quick product updates & announcements",
      "Educational threads on brand building",
      "Community polls and engagement",
      "Real-time industry commentary",
    ],
    growth: [
      "SaaS community engagement",
      "Twitter Spaces AMAs (bi-weekly)",
      "Hashtag participation in #SaaS",
      "Quote-tweet and engage influencers",
    ],
  },
  {
    name: "Facebook",
    handle: "/valtriox.app",
    frequency: "3-4 posts/week",
    contentTypes: ["Community Group", "Long-Form", "Events", "Reviews"],
    color: "from-blue-600 to-blue-400",
    icon: Facebook,
    strategy: [
      "Active community group management",
      "Long-form educational content",
      "Event promotion and live streams",
      "Customer review showcases",
    ],
    growth: [
      "Active community moderation",
      "Facebook Ads retargeting campaigns",
      "UGC encouragement & contests",
      "Facebook Shop integration",
    ],
  },
  {
    name: "WhatsApp Channel",
    handle: "Valtriox Updates",
    frequency: "2-3 updates/week",
    contentTypes: ["Announcements", "Screenshots", "Tips", "Beta Invites"],
    color: "from-green-600 to-green-400",
    icon: MessageCircle,
    strategy: [
      "Product announcement broadcasts",
      "Feature screenshot reveals",
      "Quick tips and tricks",
      "Exclusive beta access invites",
    ],
    growth: [
      "Channel link in email signatures",
      "QR code promotion on all content",
      "Cross-promote from other platforms",
      "Exclusive updates drive follows",
    ],
  },
];

export function SocialMediaGuidePage() {
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
            <Hash className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Social Media Setup Guide
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Valtriox Complete Social Media Strategy 2026
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
          { label: "Platforms", value: "7", icon: Users },
          { label: "Weekly Posts", value: "25-35", icon: Zap },
          { label: "Content Types", value: "20+", icon: Target },
          { label: "Growth Tactics", value: "28+", icon: TrendingUp },
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

      {/* Platform Cards */}
      <div className="space-y-6">
        {PLATFORMS.map((platform, index) => (
          <motion.div
            key={platform.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className={`rounded-2xl border overflow-hidden ${
              isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-white"
            }`}
          >
            {/* Platform Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${platform.color} bg-opacity-10`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <platform.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{platform.name}</h3>
                    <p className="text-xs text-white/80">{platform.handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-white/70" />
                  <span className="text-xs text-white/90 font-medium">{platform.frequency}</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Content Types */}
              <div className="mb-5">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  Content Types
                </p>
                <div className="flex flex-wrap gap-2">
                  {platform.contentTypes.map((ct) => (
                    <span
                      key={ct}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        isDark
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {ct}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* Strategy */}
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    Strategy
                  </p>
                  <ul className="space-y-2">
                    {platform.strategy.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ArrowRight className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${isDark ? "text-amber-500" : "text-amber-600"}`} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Growth Tactics */}
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    Growth Tactics
                  </p>
                  <ul className="space-y-2">
                    {platform.growth.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <TrendingUp className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${isDark ? "text-amber-500" : "text-amber-600"}`} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
