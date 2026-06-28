import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";

// Allow up to 30 seconds for DB operations on Vercel serverless
export const maxDuration = 30;

// ============================================================================
// Default document templates - seeded on first GET if no documents exist
// ============================================================================

const DEFAULT_DOCUMENTS: Array<{
  key: string;
  title: string;
  type: string;
  content: string;
}> = [
  {
    key: "document_valtriox_intro",
    title: "Welcome to Valtriox - COMMEND YOUR BRAND UNIVERSE",
    type: "overview",
    content: `# Welcome to Valtriox - COMMEND YOUR BRAND UNIVERSE

## About Valtriox
Valtriox is COMMEND YOUR BRAND UNIVERSE, designed to transform how businesses operate in the digital age. Built with enterprise-grade technology and a deep understanding of local market needs, Valtriox provides a comprehensive platform that handles everything from order management to AI-powered insights.

## What Makes Valtriox Different?

### Built in Pakistan, for Pakistani Brands
Valtriox understands the unique challenges faced by Pakistani businesses, from local payment methods (JazzCash, EasyPaisa) to WhatsApp-first communication preferences. Every feature is designed with the local market in mind.

### 8 Powerful Modules in One Platform
- **Order Management**: Real-time tracking, SLA monitoring, priority scoring, and automated status updates
- **Inventory & Products**: Complete catalog management, stock alerts, pricing rules, and multi-variant support
- **Team Collaboration**: 8+ role-based permissions, task boards, attendance tracking, and payroll management
- **Marketing Hub**: AI content writer, campaign scheduling, WhatsApp integration, and social media management
- **AI-Powered Insights**: Daily briefings, sales forecasts, demand prediction, and smart recommendations
- **Customer Management**: CRM capabilities, loyalty programs, WhatsApp integration, and customer analytics
- **Analytics Dashboard**: Revenue tracking, expense reports, performance leaderboards, and traffic analytics
- **Settings & Integrations**: White-label customization, third-party integrations, lead management, and proposal generation

### Enterprise-Grade Infrastructure
- 99.9% uptime guarantee
- Bank-grade security with encrypted data
- Scalable architecture that grows with your business
- Real-time data synchronization across all modules

## Subscription Plans
Valtriox offers flexible pricing to match your business stage:

### Starter Plan - Rs. 7,999/month
Perfect for small businesses getting started with digital operations. Includes 3 team members, 100 orders/month, and core features like order tracking and basic analytics.

### Growth Plan - Rs. 14,999/month
For growing businesses that need more power. Includes 8 team members, 500 orders/month, AI insights, marketing hub, and advanced analytics.

### Professional Plan - Rs. 24,999/month
For established brands that demand the best. Includes 15 team members, unlimited orders, all modules unlocked, and priority support.

### Enterprise Plan - Rs. 74,999/month
For large organizations with custom needs. Everything in Professional plus custom development, dedicated account manager, SLA-backed support, and enterprise security.

## Getting Started
1. Log in to your Valtriox account
2. Complete your brand profile and company information
3. Invite your team members and assign roles
4. Start managing your operations with powerful dashboards
5. Enable integrations with your existing tools
6. Schedule your free onboarding call with our team

## Support & Resources
Our dedicated support team is available 24/7 to help you succeed with Valtriox. We provide:
- Free onboarding and training sessions
- Comprehensive documentation and video guides
- Priority support for Professional and Enterprise plans
- Regular platform updates with new features
`,
  },
  {
    key: "document_service_agreement",
    title: "Service Agreement / Terms of Service",
    type: "legal",
    content: `# Service Agreement - Terms of Service

**Last Updated**: {{date}}
**Effective Date**: {{date}}

---

## 1. Acceptance of Terms

By accessing or using the Valtriox platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.

## 2. Description of Service

Valtriox provides a cloud-based brand management platform including order management, product catalog, marketing tools, analytics, team management, and related services as described in your subscription plan.

## 3. Account Registration

You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.

## 4. Subscription Plans & Payment

- Subscription fees are billed monthly, quarterly, or annually as selected
- All plans include a 14-day free trial period
- Setup fees are charged one-time at the time of registration
- Prices are subject to change with 30 days written notice
- Refund requests must be submitted within 7 days of billing

## 5. Acceptable Use

You agree not to use the Service for any unlawful purpose, to distribute malware, to attempt unauthorized access to systems, or to violate any intellectual property rights.

## 6. Data & Privacy

We collect, process, and store your data in accordance with our Privacy Policy. You retain ownership of your content. We may use anonymized data for service improvement.

## 7. Service Availability

We strive for 99.9% uptime but do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance.

## 8. Limitation of Liability

Valtriox shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Service.

## 9. Termination

Either party may terminate with 30 days written notice. Upon termination, your data will be available for export for 30 days before permanent deletion.

## 10. Contact

For questions about these Terms, contact: legal@valtriox.com
`,
  },
  {
    key: "document_privacy_policy",
    title: "Privacy Policy",
    type: "legal",
    content: `# Privacy Policy

**Last Updated**: {{date}}

---

## 1. Information We Collect

We collect information you provide directly (name, email, company details) and information generated through your use of the Service (usage data, analytics, device information).

## 2. How We Use Your Information

- To provide and maintain the Service
- To process transactions and send notifications
- To improve the Service and develop new features
- To communicate with you about updates and support
- To comply with legal obligations

## 3. Data Security

We implement industry-standard security measures including encryption at rest and in transit, access controls, and regular security audits.

## 4. Data Sharing

We do not sell your personal data. We may share data with service providers who assist in operating the platform, and when required by law.

## 5. Your Rights

You have the right to access, correct, delete, and export your personal data. Contact privacy@valtriox.com to exercise these rights.

## 6. Data Retention

We retain your data for as long as your account is active. Upon account deletion, data is removed within 30 days.

## 7. Contact

For privacy-related inquiries: privacy@valtriox.com
`,
  },
  {
    key: "document_brand_guidelines",
    title: "Brand Guidelines Template",
    type: "template",
    content: `# Brand Guidelines Template

**Brand Name**: {{company_name}}
**Prepared for**: {{client_name}}
**Date**: {{date}}

---

## Brand Identity

### Logo Usage
- Minimum size: [specify minimum pixels]
- Clear space: [specify padding around logo]
- Color variations: Full color, monochrome, reversed
- Do not: stretch, rotate, add effects, or alter the logo

### Color Palette
- **Primary Color**: [Hex code]
- **Secondary Color**: [Hex code]
- **Accent Color**: [Hex code]
- **Text Color**: [Hex code]
- **Background Color**: [Hex code]

### Typography
- **Heading Font**: [Font name and weight]
- **Body Font**: [Font name and weight]
- **Minimum font size**: [specify]

## Brand Voice
- **Tone**: [professional, friendly, authoritative]
- **Language**: [formal/casual, local/global]
- **Key phrases**: [brand-specific phrases to use]

## Visual Style
- Photography style: [describe]
- Illustration style: [describe]
- Iconography: [describe]

## Applications
- Website: [specifics]
- Social Media: [specifics]
- Print Materials: [specifics]
- Packaging: [specifics]
`,
  },
  {
    key: "document_consultation_report",
    title: "Consultation Report Template",
    type: "report",
    content: `# Consultation Report

**Client**: {{client_name}}
**Company**: {{company_name}}
**Date**: {{date}}
**Consultant**: {{consultant_name}}

---

## Executive Summary

[Provide a brief overview of the consultation findings and key recommendations.]

## Current State Analysis

### Brand Position
[Assessment of current brand positioning and market perception]

### Digital Presence
[Analysis of website, social media, and online visibility]

### Operations
[Review of current operational processes and efficiency]

## Key Findings

1. **Finding 1**: [Description and impact assessment]
2. **Finding 2**: [Description and impact assessment]
3. **Finding 3**: [Description and impact assessment]

## Recommendations

### Short-term (1-3 months)
- [ ] [Recommendation with expected outcome]
- [ ] [Recommendation with expected outcome]

### Medium-term (3-6 months)
- [ ] [Recommendation with expected outcome]
- [ ] [Recommendation with expected outcome]

### Long-term (6-12 months)
- [ ] [Recommendation with expected outcome]
- [ ] [Recommendation with expected outcome]

## Next Steps

[Outline the agreed-upon action items and timeline.]

## Appendix

[Any supporting documents, data, or references.]
`,
  },
  {
    key: "document_setup_checklist",
    title: "Account Setup Checklist",
    type: "checklist",
    content: `# Account Setup Checklist

**Brand**: {{company_name}}
**Owner**: {{client_name}}
**Date**: {{date}}

---

## Essential Setup (Complete within 24 hours)

- [ ] Log in to your dashboard
- [ ] Update brand name and tagline
- [ ] Upload brand logo
- [ ] Set brand colors (primary, secondary)
- [ ] Configure business hours and timezone
- [ ] Add contact information (email, phone)
- [ ] Set up payment methods
- [ ] Add team members and assign roles

## Product Setup (Complete within 3 days)

- [ ] Create product categories
- [ ] Add first 10 products with images
- [ ] Set up pricing rules
- [ ] Configure shipping zones and rates
- [ ] Set up inventory tracking

## Marketing Setup (Complete within 1 week)

- [ ] Connect social media accounts
- [ ] Set up email marketing templates
- [ ] Create first promotional campaign
- [ ] Configure SEO settings
- [ ] Set up customer loyalty program

## Operations (Complete within 2 weeks)

- [ ] Configure order status workflow
- [ ] Set up return and refund policies
- [ ] Configure notification preferences
- [ ] Set up SLA rules (if applicable)
- [ ] Integrate with accounting tools

## Advanced Features (Optional)

- [ ] Configure white-label settings
- [ ] Set up API integrations
- [ ] Configure advanced analytics
- [ ] Set up automated workflows
`,
  },
  {
    key: "document_monthly_report",
    title: "Monthly Report Template",
    type: "report",
    content: `# Monthly Performance Report

**Company**: {{company_name}}
**Period**: {{date}}
**Prepared by**: {{consultant_name}}

---

## Key Metrics Summary

| Metric | This Month | Last Month | Change |
|--------|-----------|-----------|--------|
| Revenue | Rs. 0 | Rs. 0 | - |
| Orders | 0 | 0 | - |
| New Customers | 0 | 0 | - |
| Avg Order Value | Rs. 0 | Rs. 0 | - |

## Revenue Analysis

[Breakdown of revenue sources and trends]

## Order Analysis

[Order volume, status distribution, and fulfillment metrics]

## Customer Insights

[New vs returning customers, top customers, customer segments]

## Marketing Performance

[Campaign results, channel performance, conversion rates]

## Product Performance

[Top sellers, low stock alerts, category breakdown]

## Recommendations

1. [Based on this month's data, what actions should be taken]
2. [Focus areas for next month]
3. [Long-term strategic suggestions]

## Next Month Goals

- [ ] [Goal 1]
- [ ] [Goal 2]
- [ ] [Goal 3]
`,
  },
  {
    key: "document_proposal_cover",
    title: "Proposal Cover Letter Template",
    type: "template",
    content: `# Proposal Cover Letter

**Date**: {{date}}

**To**: {{client_name}}
{{company_name}}
{{client_email}}

**From**: Valtriox Team
ashir@valtriox.com

---

Dear {{client_name}},

Thank you for choosing Valtriox as your brand management partner. We are excited to work with {{company_name}} and help you achieve your business goals.

## About This Proposal

This proposal outlines our recommended approach for setting up and managing your brand on the Valtriox platform. It includes:

- **Platform Configuration**: Tailored setup based on your specific industry and needs
- **Feature Roadmap**: Phased rollout of platform features
- **Training Plan**: Comprehensive onboarding for your team
- **Support Structure**: Ongoing support and consultation

## Why Valtriox

We understand that every brand is unique. Our platform is designed to be flexible and scalable, adapting to your specific requirements as your business grows. With our comprehensive suite of tools, you can manage everything from orders and inventory to marketing and analytics in one place.

## Next Steps

1. Review this proposal and provide your feedback
2. Schedule a kickoff meeting to discuss timeline and priorities
3. Complete the account setup checklist
4. Begin the onboarding process

We look forward to a successful partnership.

Warm regards,

The Valtriox Team
ashir@valtriox.com
`,
  },
];

// ============================================================================
// GET - Fetch all documents, seeding defaults if empty
// ============================================================================

export const GET = withAuth(async (req: NextRequest, authCtx) => {
  const { data: result, error } = await safeDbQuery(async () => {
    // Fetch all document settings
    const settings = await db.systemSetting.findMany({
      where: { category: "documents" },
      orderBy: { key: "asc" },
    });

    // If no documents exist, seed defaults
    if (settings.length === 0) {
      const seeded: any[] = [];
      for (const doc of DEFAULT_DOCUMENTS) {
        const created = await db.systemSetting.create({
          data: {
            key: doc.key,
            value: JSON.stringify({
              title: doc.title,
              type: doc.type,
              content: doc.content,
              updatedAt: new Date().toISOString(),
            }),
            category: "documents",
          },
        });
        seeded.push({
          key: created.key,
          title: doc.title,
          type: doc.type,
          content: doc.content,
          updatedAt: created.updatedAt,
        });
      }
      logger.info("[Documents] Seeded default documents", { count: seeded.length });
      return seeded;
    }

    // Parse existing documents
    return settings.map((s) => {
      try {
        const parsed = JSON.parse(s.value);
        return {
          key: s.key,
          title: parsed.title || s.key,
          type: parsed.type || "general",
          content: parsed.content || "",
          updatedAt: s.updatedAt,
        };
      } catch {
        return { key: s.key, title: s.key, type: "general", content: "", updatedAt: s.updatedAt };
      }
    });
  }, 3, 1000);

  if (error) {
    logger.error("[Documents] GET error", { error });
    return NextResponse.json({ documents: [], fallback: true });
  }

  return NextResponse.json({ documents: result });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ============================================================================
// POST - Create a new document
// ============================================================================

export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const sanitized = sanitizeObject(body);
    const { title, type, content } = sanitized;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const key = `document_${title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now().toString(36)}`;

    const { data: result, error } = await safeDbQuery(async () => {
      const doc = await db.systemSetting.create({
        data: {
          key,
          value: JSON.stringify({
            title,
            type: type || "general",
            content,
            updatedAt: new Date().toISOString(),
          }),
          category: "documents",
        },
      });

      return {
        key: doc.key,
        title,
        type: type || "general",
        content,
        updatedAt: doc.updatedAt,
      };
    });

    if (error) {
      logger.error("[Documents] POST error", { error });
      return NextResponse.json({ error: "Failed to create document" }, { status: 503 });
    }

    logger.info("[Documents] Created document", { key, title, userId: authCtx.userId });
    return NextResponse.json({ document: result });
  } catch (error: any) {
    logger.error("[Documents] POST parsing error", { error: error?.message });
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ============================================================================
// PUT - Update an existing document
// ============================================================================

export const PUT = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const sanitized = sanitizeObject(body);
    const { key, title, type, content } = sanitized;

    if (!key || !content) {
      return NextResponse.json({ error: "Key and content are required" }, { status: 400 });
    }

    const { data: result, error } = await safeDbQuery(async () => {
      const existing = await db.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        throw new Error("Document not found");
      }

      const existingParsed = JSON.parse(existing.value);

      const updated = await db.systemSetting.update({
        where: { key },
        data: {
          value: JSON.stringify({
            title: title || existingParsed.title,
            type: type || existingParsed.type,
            content,
            updatedAt: new Date().toISOString(),
          }),
        },
      });

      const parsed = JSON.parse(updated.value);
      return {
        key: updated.key,
        title: parsed.title,
        type: parsed.type,
        content: parsed.content,
        updatedAt: updated.updatedAt,
      };
    });

    if (error) {
      logger.error("[Documents] PUT error", { error });
      if (error.includes("Document not found")) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update document" }, { status: 503 });
    }

    logger.info("[Documents] Updated document", { key, userId: authCtx.userId });
    return NextResponse.json({ document: result });
  } catch (error: any) {
    logger.error("[Documents] PUT parsing error", { error: error?.message });
    if (error?.message === "Document not found") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
