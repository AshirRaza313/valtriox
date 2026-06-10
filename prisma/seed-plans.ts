import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding subscription plans...");

  // Upsert the 4 plans (idempotent) — Revised Pricing Strategy 2026
  // Starter: Rs 7,999/mo + Rs 4,999 setup | Growth: Rs 14,999/mo + Rs 9,999 setup
  // Professional: Rs 24,999/mo + Rs 14,999 setup | Enterprise: Rs 74,999+/mo + Rs 29,999+ setup
  const plans = [
    {
      name: "starter",
      price: 7999,
      annualPrice: Math.round(7999 * 12 * 0.8),   // 20% off = 76,790
      quarterlyPrice: Math.round(7999 * 3 * 0.9), // 10% off = 21,597
      period: "monthly",
      features: JSON.stringify([
        "Brand Dashboard (Basic)",
        "3 Marketing Channels",
        "Standard Analytics & Reports",
        "2 Third-Party Integrations",
        "Up to 3 Team Members",
        "5 GB Cloud Storage",
        "Business Hours Support (Mon-Fri, 9AM-6PM)",
        "Order & Customer Management",
        "Email Notifications",
        "99.5% Uptime SLA",
        "Read-Only API Access",
      ]),
      teamLimit: 3,
      orderLimit: 100,
      productLimit: 50,
      isActive: true,
      trialDays: 14,
    },
    {
      name: "growth",
      price: 14999,
      annualPrice: Math.round(14999 * 12 * 0.8),   // 20% off = 143,990
      quarterlyPrice: Math.round(14999 * 3 * 0.9), // 10% off = 40,497
      period: "monthly",
      features: JSON.stringify([
        "Advanced Brand Dashboard",
        "5 Marketing Channels",
        "Campaign Management (5 campaigns)",
        "5 Third-Party Integrations",
        "Up to 8 Team Members",
        "20 GB Cloud Storage",
        "Business Hours Support (Priority Queue)",
        "2,000 Emails/Month",
        "Up to 100 Tasks & 3 Tickets",
        "Coupon & Loyalty Tracking",
        "99.5% Uptime SLA",
      ]),
      teamLimit: 8,
      orderLimit: 500,
      productLimit: 200,
      isActive: true,
      trialDays: 14,
    },
    {
      name: "professional",
      price: 24999,
      annualPrice: Math.round(24999 * 12 * 0.8),   // 20% off = 239,990
      quarterlyPrice: Math.round(24999 * 3 * 0.9), // 10% off = 67,497
      period: "monthly",
      features: JSON.stringify([
        "Advanced Brand Dashboard",
        "8 Marketing Channels (All Platforms)",
        "Advanced + Custom Analytics",
        "10 Third-Party Integrations",
        "Up to 15 Team Members",
        "50 GB Cloud Storage",
        "Priority 24/7 Support",
        "Full API Access",
        "Custom Branding",
        "AI-Powered Insights & Automation",
        "Campaign Management & SEO Tools",
        "Social Media Management Suite",
        "Email Marketing & Ad Manager",
        "99.9% Uptime SLA",
        "Coupons, Loyalty & Influencer Tracking",
      ]),
      teamLimit: 15,
      orderLimit: -1,
      productLimit: -1,
      isActive: true,
      trialDays: 14,
    },
    {
      name: "enterprise",
      price: 74999, // Starting price — custom pricing available
      annualPrice: 0,
      quarterlyPrice: 0,
      period: "custom",
      features: JSON.stringify([
        "Full Suite Dashboard (AI-Powered)",
        "Unlimited Marketing Channels",
        "AI-Powered Analytics & Predictions",
        "Unlimited + Custom Integrations",
        "Unlimited Team Members",
        "Unlimited Cloud Storage",
        "Dedicated Account Manager",
        "Full API Access + Webhooks",
        "White-Label Portal",
        "Custom Development & Features",
        "SLA Guarantee (99.99% Uptime)",
        "Quarterly Business Reviews",
        "Priority Feature Requests",
        "Import/Export, Warehouse, Returns",
        "Support Tickets & Audit Log",
        "Automated Reports & SLA Engine",
      ]),
      teamLimit: -1, // unlimited
      orderLimit: -1,
      productLimit: -1,
      isActive: true,
      trialDays: 14,
    },
  ];

  for (const plan of plans) {
    const result = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: { ...plan },
      create: { ...plan },
    });
    const priceStr = result.price > 0 ? `Rs. ${result.price.toLocaleString()}` : "Custom";
    console.log(`  ✓ ${result.name} — ${priceStr}/${result.period}`);
  }

  // Seed default PlatformSettings
  const settings = await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Valtriox",
      tagline: "Command Your Brand Universe",
      companyEmail: "info@valtriox.com",
      companyPhone: "+92-300-0000000",
      companyWebsite: "https://valtriox.vercel.app",
      companyAddress: "Lahore, Pakistan",
      supportHours: "Mon-Fri: 9AM-6PM PKT (Starter) | 24/7 Priority (Professional+)",
      whatsappNumber: "+92-300-0000000",
      paymentMethods: JSON.stringify([
        {
          name: "Bank Transfer (HBL)",
          type: "bank_transfer",
          currency: "PKR",
          accountNumber: "1234-5678-9012-3456",
          bankName: "Habib Bank Limited",
          title: "Valtriox Pvt Ltd"
        },
        {
          name: "JazzCash",
          type: "mobile_wallet",
          currency: "PKR",
          accountNumber: "0300-0000000",
          bankName: "JazzCash",
          title: "Valtriox"
        },
        {
          name: "EasyPaisa",
          type: "mobile_wallet",
          currency: "PKR",
          accountNumber: "0300-0000000",
          bankName: "EasyPaisa (Telenor Microfinance Bank)",
          title: "Valtriox"
        },
        {
          name: "PayPro",
          type: "online_gateway",
          currency: "PKR",
          supportsRecurring: true
        },
        {
          name: "SWIFT (International)",
          type: "bank_transfer",
          currency: "USD",
          accountNumber: "SWIFT CODE (Contact for details)",
          bankName: "International Wire Transfer",
          title: "Valtriox Pvt Ltd"
        },
        {
          name: "PayPal",
          type: "online",
          currency: "USD",
          accountNumber: "payments@valtriox.com",
          bankName: "PayPal"
        },
        {
          name: "Wise (TransferWise)",
          type: "online",
          currency: "USD,GBP,EUR,AED",
          accountNumber: "Contact for details",
          bankName: "Wise Business"
        },
        {
          name: "Payoneer",
          type: "online",
          currency: "USD",
          accountNumber: "payments@valtriox.com",
          bankName: "Payoneer"
        }
      ]),
      currency: "PKR",
    },
  });
  console.log(`  ✓ Platform settings seeded`);

  // Seed default roles
  const roles = [
    {
      name: "owner",
      label: "Owner",
      description: "Full access to everything in the organization",
      permissions: JSON.stringify({ all: true }),
      level: 100,
    },
    {
      name: "admin",
      label: "Admin",
      description: "Can manage most settings and team members",
      permissions: JSON.stringify({ orders: true, products: true, customers: true, team: true, settings: true, reports: true }),
      level: 80,
    },
    {
      name: "manager",
      label: "Manager",
      description: "Can manage orders, products, and customers",
      permissions: JSON.stringify({ orders: true, products: true, customers: true, reports: true }),
      level: 60,
    },
    {
      name: "member",
      label: "Team Member",
      description: "Basic access to orders and products",
      permissions: JSON.stringify({ orders: true, products: true }),
      level: 40,
    },
    {
      name: "viewer",
      label: "Viewer",
      description: "Read-only access to dashboards and reports",
      permissions: JSON.stringify({ dashboard: true, reports: true }),
      level: 20,
    },
  ];

  for (const role of roles) {
    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: { ...role },
      create: { ...role },
    });
    console.log(`  ✓ Role: ${result.label} (level ${result.level})`);
  }

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
