import { NextRequest, NextResponse } from "next/server";
import { createAllTables } from "@/lib/db";
import crypto from "crypto";

// POST /api/setup/init - Creates all tables, admin account, seeds plans
// This is a ONE-TIME setup endpoint called after DATABASE_URL is configured.
export async function POST(req: NextRequest) {
  try {
    // Security: Only allow setup with a valid token from env var
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const expectedToken = process.env.SETUP_TOKEN;
    if (!expectedToken) {
      return NextResponse.json(
        { error: "SETUP_TOKEN environment variable is not configured. Cannot run setup." },
        { status: 500 }
      );
    }
    if (token !== expectedToken) {
      return NextResponse.json({ error: "Invalid setup token" }, { status: 403 });
    }

    const body = await req.json();
    const { adminEmail, adminPassword } = body;

    // Validate adminEmail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminEmail || typeof adminEmail !== "string" || !emailRegex.test(adminEmail)) {
      return NextResponse.json({ error: "A valid adminEmail is required" }, { status: 400 });
    }

    // Validate/generate adminPassword
    let finalPassword: string;
    if (!adminPassword || typeof adminPassword !== "string") {
      // Generate a random secure password (16 chars)
      finalPassword = crypto.randomBytes(16).toString("base64url").slice(0, 16);
    } else if (adminPassword.length < 12) {
      return NextResponse.json({ error: "adminPassword must be at least 12 characters" }, { status: 400 });
    } else {
      finalPassword = adminPassword;
    }

    const { PrismaClient } = await import("@prisma/client");
    const dbUrl = process.env.DATABASE_URL || '';
    const pgbUrl = dbUrl.includes('pgbouncer=') ? dbUrl : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}pgbouncer=true`;
    const prisma = new PrismaClient({ datasourceUrl: pgbUrl });

    // Test connection
    await prisma.$queryRaw`SELECT 1`;

    // Step 1: Create all tables via raw SQL (works on Vercel)
    console.log("[Setup] Creating all database tables...");
    const tablesCreated = await createAllTables();
    if (!tablesCreated) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "Failed to create database tables", hint: "Check your DATABASE_URL and try again." },
        { status: 500 }
      );
    }
    console.log("[Setup] All tables created successfully");

    // Step 2: Check if admin already exists
    let admin = await prisma.user.findFirst({
      where: { email: adminEmail },
    });

    if (!admin) {
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(finalPassword, 12);
      admin = await prisma.user.create({
        data: {
          name: "Platform Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "platform_owner",
        },
      });
    }

    // Step 3: Create organization for admin
    const slug = adminEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
    let org = await prisma.organization.findFirst({ where: { slug } });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "Valtriox Admin",
          slug,
          email: adminEmail,
          country: "PK",
          currency: "PKR",
          plan: "enterprise",
          isActive: true,
        },
      });
      await prisma.organizationMember.create({
        data: { organizationId: org.id, userId: admin.id, role: "owner" },
      });
    }

    // Step 4: Seed subscription plans - ALWAYS clean up stale plans & re-seed
    const ALLOWED_PLANS = ["starter", "growth", "professional", "enterprise"];

    // Delete any plans that shouldn't exist (e.g. old "free", "basic", "pro" plans)
    const deletedCount = await prisma.subscriptionPlan.deleteMany({
      where: { name: { notIn: ALLOWED_PLANS } },
    });
    if (deletedCount.count > 0) {
      console.log(`[Setup] Deleted ${deletedCount.count} stale plans`);
    }

    // Upsert the 4 correct plans — Valtriox Pricing 2026
    const planSeeds = [
      {
        name: "starter", price: 7999, annualPrice: Math.round(7999 * 12 * 0.8), quarterlyPrice: Math.round(7999 * 3 * 0.9),
        features: JSON.stringify(["Brand Dashboard (Basic)", "3 Marketing Channels", "Standard Analytics & Reports", "2 Third-Party Integrations", "Up to 3 Team Members", "5 GB Cloud Storage", "Business Hours Support (Mon-Fri, 9AM-6PM)", "Order & Customer Management", "Email Notifications", "99.5% Uptime SLA", "Read-Only API Access"]),
        teamLimit: 3, orderLimit: 100, productLimit: 50, trialDays: 14, period: "monthly", isActive: true,
      },
      {
        name: "growth", price: 14999, annualPrice: Math.round(14999 * 12 * 0.8), quarterlyPrice: Math.round(14999 * 3 * 0.9),
        features: JSON.stringify(["Advanced Brand Dashboard", "5 Marketing Channels", "Campaign Management (5 campaigns)", "5 Third-Party Integrations", "Up to 8 Team Members", "20 GB Cloud Storage", "Business Hours Support (Priority Queue)", "2,000 Emails/Month", "Up to 100 Tasks & 3 Tickets", "Coupon & Loyalty Tracking", "99.5% Uptime SLA"]),
        teamLimit: 8, orderLimit: 500, productLimit: 200, trialDays: 14, period: "monthly", isActive: true,
      },
      {
        name: "professional", price: 24999, annualPrice: Math.round(24999 * 12 * 0.8), quarterlyPrice: Math.round(24999 * 3 * 0.9),
        features: JSON.stringify(["Advanced Brand Dashboard", "8 Marketing Channels (All Platforms)", "Advanced + Custom Analytics", "10 Third-Party Integrations", "Up to 15 Team Members", "50 GB Cloud Storage", "Priority 24/7 Support", "Full API Access", "Custom Branding", "AI-Powered Insights & Automation", "Campaign Management & SEO Tools", "Social Media Management Suite", "Email Marketing & Ad Manager", "99.9% Uptime SLA", "Coupons, Loyalty & Influencer Tracking"]),
        teamLimit: 15, orderLimit: -1, productLimit: -1, trialDays: 14, period: "monthly", isActive: true,
      },
      {
        name: "enterprise", price: 74999, annualPrice: 0, quarterlyPrice: 0,
        features: JSON.stringify(["Full Suite Dashboard (AI-Powered)", "Unlimited Marketing Channels", "AI-Powered Analytics & Predictions", "Unlimited + Custom Integrations", "Unlimited Team Members", "Unlimited Cloud Storage", "Dedicated Account Manager", "Full API Access + Webhooks", "White-Label Portal", "Custom Development & Features", "SLA Guarantee (99.99% Uptime)", "Quarterly Business Reviews", "Priority Feature Requests", "Import/Export, Warehouse, Returns", "Support Tickets & Audit Log", "Automated Reports & SLA Engine"]),
        teamLimit: -1, orderLimit: -1, productLimit: -1, trialDays: 14, period: "custom", isActive: true,
      },
    ];
    for (const plan of planSeeds) {
      await prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: { price: plan.price, annualPrice: plan.annualPrice, quarterlyPrice: plan.quarterlyPrice, features: plan.features, teamLimit: plan.teamLimit, orderLimit: plan.orderLimit, productLimit: plan.productLimit, trialDays: plan.trialDays, period: plan.period, isActive: plan.isActive },
        create: plan,
      });
    }
    console.log("[Setup] Plans synced (4 plans: starter, growth, professional, enterprise)");

    // Step 5: Create PlatformSettings
    const settingsCount = await prisma.platformSettings.count();
    if (settingsCount === 0) {
      await prisma.platformSettings.create({
        data: {
          companyName: "Valtriox",
          companyEmail: "support@valtriox.com",
          tagline: "Command Your Brand Universe",
          primaryBrandColor: "#C9A227",
          secondaryBrandColor: "#B8860B",
          currency: "PKR",
          currencySymbol: "Rs.",
          paymentMethods: JSON.stringify([
            { name: "PayPro", type: "online_gateway", supportsRecurring: true, currency: "PKR" },
            { name: "Safepay", type: "online_gateway", supportsRecurring: true, currency: "PKR,USD" },
            { name: "Bank Transfer (HBL)", accountNumber: "1234-5678-9012", bankName: "Habib Bank Limited", title: "Valtriox Pvt Ltd", type: "bank_transfer", currency: "PKR" },
            { name: "JazzCash", accountNumber: "0300-0000000", type: "mobile_wallet", currency: "PKR" },
            { name: "EasyPaisa", accountNumber: "0300-0000000", type: "mobile_wallet", currency: "PKR" },
            { name: "SWIFT (International)", type: "bank_transfer", currency: "USD" },
            { name: "PayPal", accountNumber: "payments@valtriox.com", type: "online", currency: "USD" },
          ]),
        },
      });
    }

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: "Setup completed!",
      admin: { email: admin.email },
    });
  } catch (error: any) {
    console.error("[Setup] Error:", error?.message);
    return NextResponse.json(
      { error: "Setup failed", hint: "Make sure DATABASE_URL is set correctly." },
      { status: 500 }
    );
  }
}

// GET /api/setup/init - Check if database is configured
// NOTE: Tables are now auto-created on first request, so we only check if
// DATABASE_URL is set - NOT whether tables exist.
export async function GET() {
  const hasDbUrl = !!process.env.DATABASE_URL;
  if (hasDbUrl) {
    return NextResponse.json({ configured: true, needsDatabase: false });
  }
  return NextResponse.json({
    configured: false,
    needsDatabase: true,
    hint: "DATABASE_URL not set. Add it in Vercel > Settings > Environment Variables.",
  });
}
