// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Target, Eye, Heart, Globe, Zap, Award, Users, TrendingUp, Shield,
  Linkedin, Mail, Code2, Rocket, Layers, Database, Cloud, Lock,
  Sparkles, Server, Smartphone, GitBranch, Cpu, CheckCircle2, ArrowRight,
} from "lucide-react";
import { usePlatformIdentity } from "@/lib/platform-identity";

/**
 * AboutPage — Full standalone /about route
 * Rich founder story, mission, vision, values, tech stack, journey timeline,
 * and clear CTAs. Designed for SEO and AI-search discoverability.
 */
export function AboutPage() {
  const { identity } = usePlatformIdentity();
  const companyName = identity.companyName;

  // ── Core values ──
  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description:
        "We exist to democratize brand management, giving every business — from startup to enterprise — the tools to command their brand universe from a single dashboard. Operations, marketing, customer relationships, and analytics should live in one place, not ten.",
    },
    {
      icon: Eye,
      title: "Vision-Led",
      description:
        "Our vision is a world where no brand is held back by fragmented tools. We are building the unified operating system that brands deserve — one that scales from a single founder to a multinational team without ever forcing a migration.",
    },
    {
      icon: Heart,
      title: "Customer Obsessed",
      description:
        "Every feature, every pixel, every interaction is crafted with our users in mind. We ship weekly, listen daily, and treat every support ticket as a chance to make the product better for everyone.",
    },
    {
      icon: Globe,
      title: "Pakistan and Beyond",
      description:
        "Built in Pakistan for Pakistani businesses first, with multi-currency (PKR, USD, EUR, GBP) and multi-language (English, Urdu) support baked in. We are expanding across South Asia and the Middle East in 2026.",
    },
    {
      icon: Shield,
      title: "Security First",
      description:
        "Enterprise-grade security from day one. bcrypt password hashing, JWT-based sessions, rate limiting, CSP headers, input sanitization, audit logging, and role-based access control on every endpoint.",
    },
    {
      icon: Zap,
      title: "Performance Obsessed",
      description:
        "Sub-200ms API responses, code-split pages, lazy-loaded components, image optimization, edge-cached static assets, and a 95+ Lighthouse score across Performance, Accessibility, Best Practices, and SEO.",
    },
  ];

  // ── Stats ──
  const stats = [
    { value: "100+", label: "Brands Onboarded", icon: Users },
    { value: "Enterprise", label: "Grade Reliability", icon: Shield },
    { value: "2025", label: "Founded", icon: Zap },
    { value: "Tiered", label: "Support Plans", icon: Award },
  ];

  // ── Tech stack ──
  const techStack = [
    {
      category: "Frontend",
      icon: Code2,
      items: ["Next.js 16 (App Router)", "React 19", "TypeScript 5", "Tailwind CSS 4", "shadcn/ui", "Framer Motion"],
    },
    {
      category: "Backend",
      icon: Server,
      items: ["Node.js API Routes", "Prisma ORM", "PostgreSQL", "NextAuth.js", "JWT + bcrypt", "Rate Limiting"],
    },
    {
      category: "Infrastructure",
      icon: Cloud,
      items: ["Vercel Edge Network", "Supabase Database", "Cloudinary CDN", "Sentry Monitoring", "PWA + Service Workers"],
    },
    {
      category: "Integrations",
      icon: Layers,
      items: ["WhatsApp Business", "PayPro / Safepay", "Calendly", "Email Marketing", "Google Analytics", "Meta Pixel"],
    },
  ];

  // ── Journey / Timeline ──
  const milestones = [
    {
      year: "2024 Q3",
      title: "Conceptualization",
      event:
        "Identified a critical gap in the Pakistani e-commerce ecosystem — brands were juggling 8–12 disconnected tools. The vision for a unified brand operating system was born.",
      icon: Sparkles,
    },
    {
      year: "2025 Q1",
      title: "Foundation Built",
      event:
        "Core architecture designed and built from scratch — multi-tenant database schema, role-based access, order management engine, and the dashboard foundation.",
      icon: Database,
    },
    {
      year: "2025 Q3",
      title: "Beta Launch",
      event:
        "First 20 brands onboarded for closed beta. Iterated weekly based on real-world feedback, refining the UX and adding 40+ feature modules.",
      icon: Rocket,
    },
    {
      year: "2026 Q1",
      title: "Public Launch",
      event:
        "Officially launched in Pakistan with 100+ brands across fashion, food, electronics, and services. Multi-currency and white-label support shipped.",
      icon: TrendingUp,
    },
    {
      year: "2026 Q3",
      title: "Regional Expansion",
      event:
        "Preparing for expansion across South Asia and the Middle East. AI-powered insights, predictive analytics, and advanced marketing automation on the roadmap.",
      icon: Globe,
    },
  ];

  // ── What we built (feature pillars) ──
  const featurePillars = [
    {
      icon: Layers,
      title: "40+ Feature Modules",
      description:
        "Orders, inventory, customers, marketing, analytics, team, expenses, subscriptions, integrations, and more — all in one unified workspace.",
    },
    {
      icon: Smartphone,
      title: "PWA + Mobile First",
      description:
        "Installable as a native app on iOS, Android, and desktop. Offline-capable, push notifications, and a fully responsive experience across all devices.",
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description:
        "Role-based access control (Owner, Admin, Manager, Staff, Viewer), audit logging, data isolation per organization, and GDPR-compliant data handling.",
    },
    {
      icon: Cpu,
      title: "AI-Powered Insights",
      description:
        "Predictive analytics, churn detection, revenue forecasting, and an AI assistant that helps you make smarter business decisions in real time.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(211,166,56,0.10),transparent_60%)]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium tracking-wide">About Valtriox</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              The Universal Brand{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                Operating System
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-3xl mx-auto">
              {companyName} is the all-in-one command center for modern businesses — built from the ground up
              by a single founder to replace fragmented tools with one powerful, intelligent platform.
              Founded in 2025, headquartered in Pakistan, built for the world.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-600/20"
              >
                Get in Touch
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#founder"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 hover:text-white transition-all"
              >
                Meet the Founder
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="relative py-12 border-y border-white/[0.06] bg-[#161B26]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <stat.icon className="h-6 w-6 text-amber-400 mx-auto mb-3" />
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission & Vision ── */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-transparent border border-amber-500/15"
            >
              <Target className="h-10 w-10 text-amber-400 mb-6" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Our Mission</h2>
              <p className="text-slate-400 leading-relaxed">
                To democratize enterprise-grade brand tooling. Every business — regardless of size, location,
                or budget — deserves a command center that lets them run operations, marketing, customer
                relationships, and analytics from a single, beautiful dashboard. We are committed to making
                that power accessible at a price point Pakistani businesses can actually afford, without
                compromising on the features and reliability that global SaaS platforms offer.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/[0.08]"
            >
              <Eye className="h-10 w-10 text-amber-400 mb-6" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Our Vision</h2>
              <p className="text-slate-400 leading-relaxed">
                A world where no brand is held back by fragmented tools. We envision a future where{" "}
                {companyName} is the default operating system for modern brands across South Asia, the
                Middle East, and beyond — a platform that scales from a single founder to a multinational
                team without ever forcing a migration, a re-platform, or a compromise on the user
                experience. We are building the infrastructure for the next generation of digital-first
                businesses.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Core Values ── */}
      <section className="relative py-24 bg-[#161B26]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(211,166,56,0.04),transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Core Values</h2>
            <p className="text-lg text-slate-400">
              The principles that guide every product decision, every line of code, and every customer interaction.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-all duration-300"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 transition-colors">
                  <value.icon className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{value.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Pillars ── */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">What We Built</h2>
            <p className="text-lg text-slate-400">
              A complete platform — not a feature, not a tool, an operating system for your brand.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6">
            {featurePillars.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-start gap-5 p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <pillar.icon className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{pillar.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{pillar.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founder Section ── */}
      <section id="founder" className="relative py-24 bg-[#161B26] scroll-mt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(211,166,56,0.06),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <Code2 className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium tracking-wide">Founder &amp; Lead Developer</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet Muhammad Ashir Raza</h2>
            <p className="text-lg text-slate-400">
              The visionary, architect, and engineer who built {companyName} from the ground up.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-transparent border border-amber-500/15 p-8 sm:p-12"
          >
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />

            <div className="relative grid sm:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Avatar */}
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-5xl font-bold text-white shadow-2xl shadow-amber-600/40">
                  AR
                </div>
                <div className="mt-4 flex justify-center sm:justify-start gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Available
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Muhammad Ashir Raza
                </h3>
                <p className="text-amber-400 font-medium text-sm mb-5">
                  Founder &amp; Lead Developer · {companyName}
                </p>

                <div className="space-y-4 text-slate-400 leading-relaxed text-sm sm:text-base">
                  <p>
                    Muhammad Ashir Raza is the founder, architect, and sole developer behind {companyName}.
                    He designed and built the entire platform from the ground up — every feature, every
                    integration, every line of code reflects a commitment to empowering brands with
                    enterprise-grade tooling at an accessible price point.
                  </p>
                  <p>
                    His journey began with a simple observation: Pakistani businesses were juggling 8–12
                    disconnected tools — WhatsApp for orders, Excel for inventory, separate apps for
                    marketing, analytics, and team coordination. The result was chaos, lost data, and
                    missed opportunities. He set out to build a single, unified command center that would
                    give every business the power to command its brand universe from one beautiful dashboard.
                  </p>
                  <p>
                    His mission: give every business — regardless of size, location, or budget — the power
                    to command its brand universe from a single, intelligent platform. Today, {companyName}{" "}
                    serves 100+ brands across fashion, food, electronics, and services, with regional
                    expansion planned for 2026.
                  </p>
                </div>

                {/* Quick facts */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Code2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>Full-Stack Engineer</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Rocket className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>Founder Since 2025</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Globe className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>Based in Pakistan</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Shield className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>Security-First Mindset</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.linkedin.com/in/muhammad-ashir-raza"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-600 hover:to-amber-700 transition-all"
                  >
                    <Linkedin className="h-4 w-4" />
                    Connect on LinkedIn
                  </a>
                  <a
                    href={`mailto:${identity.companyEmail || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "ashir@valtriox.com"}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/5 hover:text-white transition-all"
                  >
                    <Mail className="h-4 w-4" />
                    Email Founder
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built on Modern Technology</h2>
            <p className="text-lg text-slate-400">
              {companyName} is engineered with a battle-tested, production-grade stack — chosen for
              performance, security, and scalability.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {techStack.map((stack, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-all"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <stack.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{stack.category}</h3>
                </div>
                <ul className="space-y-2">
                  {stack.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Journey Timeline ── */}
      <section className="relative py-24 bg-[#161B26]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(211,166,56,0.04),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Journey</h2>
            <p className="text-lg text-slate-400">From a single idea to a 100+ brand platform.</p>
          </motion.div>
          <div className="relative">
            {milestones.map((milestone, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative pl-12 pb-10 last:pb-0"
              >
                {/* Vertical line */}
                {i < milestones.length - 1 && (
                  <div className="absolute left-[18px] top-12 bottom-0 w-px bg-gradient-to-b from-amber-500/40 via-amber-500/20 to-transparent" />
                )}
                {/* Dot */}
                <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <milestone.icon className="h-4 w-4 text-amber-400" />
                </div>
                <div className="ml-2">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                    {milestone.year}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-1 mb-2">{milestone.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{milestone.event}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-amber-500/[0.10] via-white/[0.02] to-transparent border border-amber-500/20"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Command Your Brand Universe?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Join 100+ brands already running on {companyName}. Get a free consultation, see the platform
              in action, and discover how we can help your business grow.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-600/20"
              >
                Request Free Consultation
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 hover:text-white transition-all"
              >
                Explore Features
              </a>
            </div>
            <p className="mt-8 text-sm text-slate-500">
              Made with <span className="text-amber-400">♥</span> by Muhammad Ashir Raza
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
