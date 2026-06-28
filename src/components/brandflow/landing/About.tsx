"use client";

import { motion } from "framer-motion";
import { Target, Eye, Heart, Globe, Zap, Award, Users, TrendingUp, Shield } from "lucide-react";
import { usePlatformIdentity } from "@/lib/platform-identity";

export function About() {
  const { identity } = usePlatformIdentity();
  const companyName = identity.companyName;

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We exist to democratize brand management, giving every business, from startup to enterprise, the tools to command their brand universe from a single dashboard.",
    },
    {
      icon: Eye,
      title: "Vision-Led",
      description: "Our vision is a world where no brand is held back by fragmented tools. We build the unified operating system that brands deserve.",
    },
    {
      icon: Heart,
      title: "Customer Obsessed",
      description: "Every feature, every pixel, every interaction is crafted with our users in mind. Your success is our only metric that matters.",
    },
    {
      icon: Globe,
      title: "Pakistan and Beyond",
      description: "Built for Pakistani businesses with multi-currency and multi-language support. We're growing rapidly and expanding to serve brands across the region.",
    },
  ];

  const stats = [
    { value: "100+", label: "Brands Onboarded", icon: Users },
    { value: "Enterprise", label: "Grade Reliability", icon: Shield },
    { value: "Pakistan", label: "Starting Market", icon: Globe },
    { value: "Tiered", label: "Support Plans", icon: Award },
  ];

  const milestones = [
    { year: "2024", event: "Conceptualized as the ultimate brand management platform", icon: Zap },
    { year: "2026", event: "Officially launched in Pakistan, empowering brands to command their operations", icon: TrendingUp },
  ];

  return (
    <section id="about" className="relative bg-[#151A26] py-24 sm:py-32">
      {/* Background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(211,166,56,0.04),transparent_70%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <span className="text-sm text-amber-300 font-medium">About Us</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            The Story Behind{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
              {companyName}
            </span>
          </h2>
          <p className="mt-5 text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            We&apos;re on a mission to transform how brands operate. {companyName} is the
            all-in-one platform that replaces your scattered tools with one powerful,
            intelligent command center.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-20"
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-colors"
            >
              <stat.icon className="h-5 w-5 text-amber-400 mx-auto mb-3" />
              <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Values Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-10">
            Our Core Values
          </h3>
          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            {values.map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <value.icon className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white mb-2">{value.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{value.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-20"
        >
          <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-10">
            Our Journey
          </h3>
          <div className="max-w-2xl mx-auto">
            {milestones.map((milestone, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className="relative pl-10 pb-8 last:pb-0"
              >
                {/* Timeline line */}
                {i < milestones.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-amber-500/30 to-transparent" />
                )}
                {/* Timeline dot */}
                <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <milestone.icon className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="ml-1">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{milestone.year}</span>
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">{milestone.event}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
