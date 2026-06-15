import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create platform settings
  const settings = await db.platformSettings.create({
    data: {
      companyName: 'Valtriox',
      companyEmail: 'ashir@valtriox.com',
      companyPhone: '+92-300-1234567',
      companyWebsite: 'https://valtriox.vercel.app',
      companyAddress: 'Lahore, Pakistan',
      supportHours: 'Mon-Fri: 9AM-6PM PKT',
      whatsappNumber: '+923001234567',
      instagramUrl: '@valtriox',
      facebookUrl: 'valtriox',
      twitterUrl: '@valtriox',
      paymentMethods: JSON.stringify(['Bank Transfer', 'JazzCash', 'EasyPaisa', 'Credit Card']),
      currency: 'PKR',
      primaryBrandColor: '#C9A227',
      secondaryBrandColor: '#B8860B',
      currencySymbol: 'Rs.',
      tagline: "The Universal Brand Management Portal",
    },
  });
  console.log('✅ Platform settings created');

  // 2. Create subscription plans (Revised Pricing Strategy 2026)
  const starter = await db.subscriptionPlan.create({
    data: {
      name: 'starter',
      price: 7999,
      annualPrice: Math.round(7999 * 12 * 0.8),
      features: JSON.stringify(['Brand Dashboard (Basic)', '3 Marketing Channels', 'Standard Analytics', '2 Integrations', '3 Team Members', '5 GB Storage', 'Business Hours Support', '99.5% SLA']),
      teamLimit: 3,
      orderLimit: 100,
      productLimit: 50,
      trialDays: 14,
      isActive: true,
    },
  });

  const growthPlan = await db.subscriptionPlan.create({
    data: {
      name: 'growth',
      price: 15000,
      annualPrice: Math.round(15000 * 12 * 0.8),
      features: JSON.stringify(['Advanced Dashboard', '5 Marketing Channels', 'Campaign Management', '5 Integrations', '8 Team Members', '20 GB Storage', 'Priority Queue Support', '2,000 Emails/Month', 'Coupons & Loyalty', '99.5% SLA']),
      teamLimit: 8,
      orderLimit: 500,
      productLimit: 200,
      trialDays: 14,
      isActive: true,
    },
  });

  const professional = await db.subscriptionPlan.create({
    data: {
      name: 'professional',
      price: 25000,
      annualPrice: Math.round(25000 * 12 * 0.8),
      features: JSON.stringify(['Advanced Dashboard', '8 Marketing Channels', 'Advanced Analytics', '10 Integrations', '15 Team Members', '50 GB Storage', 'Priority 24/7 Support', 'Full API Access', 'Custom Branding', 'AI Tools', 'Campaign Management', 'Social Media Suite', 'Email Marketing', '99.9% SLA']),
      teamLimit: 15,
      orderLimit: -1,
      productLimit: -1,
      trialDays: 14,
      isActive: true,
    },
  });

  const enterprise = await db.subscriptionPlan.create({
    data: {
      name: 'enterprise',
      price: 75000,
      annualPrice: 0,
      features: JSON.stringify(['Full Suite AI Dashboard', 'Unlimited Everything', 'AI Analytics', 'Unlimited Integrations', 'Unlimited Team', 'Unlimited Storage', 'Dedicated Account Manager', 'Full API + Webhooks', 'White-Label Portal', '99.99% SLA', 'Custom Development', 'Warehouse', 'Audit Log']),
      teamLimit: -1,
      orderLimit: -1,
      productLimit: -1,
      trialDays: 14,
      isActive: true,
    },
  });
  console.log('✅ Subscription plans created');

  // 3. Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await db.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@valtriox.com',
      password: hashedPassword,
      role: 'platform_owner',
    },
  });
  console.log('✅ Admin user created');

  // 4. Create demo organization
  const org = await db.organization.create({
    data: {
      name: 'Demo Store',
      slug: 'demo-store',
      email: 'info@demostore.pk',
      phone: '+92-300-9876543',
      website: 'https://demostore.pk',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      plan: 'professional',
      country: 'Pakistan',
      brandColor: '#C9A227',
      address: '123 Main Market, Lahore',
      isActive: true,
    },
  });
  console.log('✅ Demo organization created');

  // 5. Add admin as org member
  await db.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: admin.id,
      role: 'owner',
    },
  });

  // 6. Create subscription for org
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  await db.subscription.create({
    data: {
      organizationId: org.id,
      planId: professional.id,
      status: 'active',
      billingCycle: 'monthly',
      trialStartsAt: new Date(),
      trialEndsAt: trialEnd,
      currentPeriodEnd: thirtyDaysFromNow,
    },
  });
  console.log('✅ Subscription created');

  // 7. Create sample customers
  const customers = [
    { name: 'Ahmed Khan', email: 'ahmed@email.com', phone: '+92-300-1111111', city: 'Lahore', loyaltyTier: 'gold', totalSpent: 45000, orderCount: 12 },
    { name: 'Sara Ali', email: 'sara@email.com', phone: '+92-300-2222222', city: 'Karachi', loyaltyTier: 'silver', totalSpent: 28000, orderCount: 8 },
    { name: 'Usman Malik', email: 'usman@email.com', phone: '+92-300-3333333', city: 'Islamabad', loyaltyTier: 'bronze', totalSpent: 12000, orderCount: 4 },
    { name: 'Fatima Noor', email: 'fatima@email.com', phone: '+92-300-4444444', city: 'Lahore', loyaltyTier: 'gold', totalSpent: 67000, orderCount: 18 },
    { name: 'Hassan Raza', email: 'hassan@email.com', phone: '+92-300-5555555', city: 'Rawalpindi', loyaltyTier: 'new', totalSpent: 5000, orderCount: 2 },
  ];

  const createdCustomers = [];
  for (const c of customers) {
    const customer = await db.customer.create({
      data: { ...c, organizationId: org.id },
    });
    createdCustomers.push(customer);
  }
  console.log(`✅ ${customers.length} customers created`);

  // 8. Create sample products
  const products = [
    { name: 'Premium Lawn Suit', sku: 'PLS-001', price: 5500, costPrice: 2800, stock: 45, category: 'Clothing' },
    { name: 'Embroidered Shawl', sku: 'ES-002', price: 3200, costPrice: 1500, stock: 30, category: 'Accessories' },
    { name: 'Silk Dupatta', sku: 'SD-003', price: 1800, costPrice: 800, stock: 60, category: 'Accessories' },
    { name: 'Cotton Kurti', sku: 'CK-004', price: 2200, costPrice: 900, stock: 80, category: 'Clothing' },
    { name: 'Formal Shoes', sku: 'FS-005', price: 8500, costPrice: 4500, stock: 15, category: 'Footwear' },
    { name: 'Leather Wallet', sku: 'LW-006', price: 1500, costPrice: 600, stock: 100, category: 'Accessories' },
    { name: 'Watch - Classic', sku: 'WC-007', price: 12000, costPrice: 6000, stock: 8, category: 'Accessories' },
    { name: 'Perfume - Oud', sku: 'PO-008', price: 4500, costPrice: 2000, stock: 25, category: 'Fragrance' },
  ];

  const createdProducts = [];
  for (const p of products) {
    const product = await db.product.create({
      data: { ...p, organizationId: org.id },
    });
    createdProducts.push(product);
  }
  console.log(`✅ ${products.length} products created`);

  // 9. Create sample orders with items
  const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'delivered', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'cancelled'];
  let orderCounter = 1001;

  for (let i = 0; i < 15; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedProducts = [];
    for (let j = 0; j < numItems; j++) {
      selectedProducts.push(createdProducts[Math.floor(Math.random() * createdProducts.length)]);
    }

    const subtotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
    const discount = Math.random() > 0.7 ? subtotal * 0.1 : 0;
    const total = subtotal - discount;
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const order = await db.order.create({
      data: {
        orderNumber: `ORD-${String(orderCounter++).padStart(5, '0')}`,
        organizationId: org.id,
        customerId: customer.id,
        status: orderStatuses[i % orderStatuses.length],
        subtotal,
        discount,
        total,
        channel: Math.random() > 0.5 ? 'whatsapp' : 'manual',
        createdAt,
      },
    });

    for (const prod of selectedProducts) {
      const qty = Math.floor(Math.random() * 3) + 1;
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          price: prod.price,
          total: prod.price * qty,
        },
      });
    }
  }
  console.log('✅ 15 orders with items created');

  // 10. Create invoices
  let invoiceCounter = 1;
  const invoiceData = [
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 6 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 5 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 4 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 3 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 2 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 1 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'paid', monthsAgo: 0 },
    { planName: 'Professional', amount: 25000, billingCycle: 'monthly', status: 'pending', monthsAgo: 0 },
  ];

  for (const inv of invoiceData) {
    const issuedAt = new Date();
    issuedAt.setMonth(issuedAt.getMonth() - inv.monthsAgo);

    const dueDate = new Date(issuedAt);
    dueDate.setDate(dueDate.getDate() + 15);

    const invoiceNum = `VTX-${issuedAt.getFullYear()}-${String(invoiceCounter++).padStart(4, '0')}`;

    await db.invoice.create({
      data: {
        invoiceNumber: invoiceNum,
        organizationId: org.id,
        planName: inv.planName,
        amount: inv.amount,
        billingCycle: inv.billingCycle,
        status: inv.status,
        currencyCode: 'PKR',
        currencySymbol: 'Rs.',
        issuedAt,
        dueDate,
        paidAt: inv.status === 'paid' ? new Date(issuedAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
        orgName: org.name,
        orgEmail: org.email,
        orgPhone: org.phone,
        orgAddress: org.address,
      },
    });
  }
  console.log(`✅ ${invoiceData.length} invoices created`);

  // 11. Create roles
  await db.role.create({
    data: { name: 'owner', label: 'Owner', description: 'Full access to everything', permissions: '{}', level: 100 },
  });
  await db.role.create({
    data: { name: 'manager', label: 'Manager', description: 'Can manage most features', permissions: '{}', level: 80 },
  });
  await db.role.create({
    data: { name: 'member', label: 'Team Member', description: 'Basic access', permissions: '{}', level: 50 },
  });
  console.log('✅ Roles created');

  // 13. Seed Email Templates (Updated 2026)
  const emailTemplates = [
    { key: "email_template_welcome", name: "Welcome Email", subject: "Welcome to {{companyName}} — Your Brand Management Journey Starts Here!", body: "Assalam-o-Alaikum {{name}},\n\nWelcome to {{companyName}} — the universal brand management portal trusted by 500+ brands across 50+ countries in 2026!\n\nYour account is now active. Here's what's waiting for you:\n\n🚀 Dashboard — Real-time KPIs, revenue charts, and order analytics at a glance\n📦 Products — Manage inventory, variants, pricing rules, and catalogs\n👥 Customers — Full CRM with loyalty tiers, segmentation, and lifetime value tracking\n📢 Marketing — Campaigns, SEO, social media scheduling, and seasonal events\n🔧 Operations — Orders, SLA engine, warehouse, shipping, and team management\n🤖 AI Tools — AI-powered descriptions, forecasting, and smart recommendations\n\nQuick Start Guide:\n1. Complete your brand profile in Settings (upload logo, set colors)\n2. Add your first 5 products to build your catalog\n3. Create your first order to test the workflow\n4. Invite your team members with PIN-based access\n\n2026 Feature Highlights:\n• WebSocket real-time engine for instant updates\n• AI inventory forecasting and auto-reorder\n• Multi-warehouse management\n• E-commerce storefront integration\n\nNeed help? Reply to this email or WhatsApp us at {{whatsapp}} — we respond within 2 hours during business hours.\n\nTo your success,\n{{companyName}} Team\nhttps://valtriox.vercel.app" },
    { key: "email_template_lead_magnet", name: "Lead Magnet Delivery", subject: "Your Valtriox Platform Guide 2026 — Free Download Inside", body: "Assalam-o-Alaikum {{name}},\n\nThank you for your interest in {{companyName}}! Your exclusive Valtriox Platform Guide for 2026 is ready.\n\n📥 Download Link: {{downloadLink}}\n\nInside this comprehensive guide, you'll discover:\n\n✅ Complete Platform Walkthrough — Every feature explained with screenshots\n✅ 2026 Roadmap Preview — WebSocket engine, AI tools, mobile app, and more\n✅ Brand Management Best Practices — Strategies from 500+ successful brands\n✅ Quick-Start Templates — Pre-built campaigns, email sequences, and workflows\n✅ Integration Guide — Connect WhatsApp, Daraz, Shopify, and payment gateways\n✅ Pricing & Plan Comparison — Find the perfect plan for your business size\n\nWhat's New in 2026:\n• Real-time order tracking with WebSocket technology\n• AI-powered inventory forecasting (save 30% on carrying costs)\n• Visual workflow automation builder\n• CRM Customer 360 with lifetime value analytics\n• Multi-warehouse management for scaling brands\n\nJoin our community of 500+ brands already growing with {{companyName}}.\n\nHave questions? WhatsApp us at {{whatsapp}} or reply to this email.\n\nBest regards,\n{{companyName}} Team" },
    { key: "email_template_follow_up", name: "Follow-Up", subject: "How's your {{companyName}} experience? We'd love to hear! 🚀", body: "Hi {{name}},\n\nIt's been a few days since you joined {{companyName}}. We wanted to check in and make sure everything is running smoothly!\n\nHere are 3 quick wins to get the most out of your portal:\n\n1️⃣ Complete Your Brand Profile → Go to Settings and upload your logo, set brand colors, and add contact details. This appears on all invoices and customer communications.\n\n2️⃣ Add Your First Products → Head to Products and create your catalog. Use the AI description generator to write professional product listings in seconds.\n\n3️⃣ Explore the 2026 Features → Check out the Social Media Setup Guide, Content Strategy Playbook, and Market Launch Timeline in the Guide section for actionable growth strategies.\n\n2026 Features You Should Try:\n⚡ WebSocket Real-Time Engine — Instant order updates and live notifications\n🧠 AI Inventory Forecasting — Predict demand and auto-reorder before stockouts\n📊 Revenue Analytics — Track profit margins, customer LTV, and growth trends\n📱 Team Chat — Real-time team communication built into your workflow\n\nNeed a walkthrough? Book a free 30-minute consultation or WhatsApp us at {{whatsapp}}.\n\nWe're here to help you succeed!\n\n{{companyName}} Team" },
    { key: "email_template_feature", name: "Feature Highlight", subject: "New Feature Launch: {{featureName}} — Now Available on {{companyName}}! 🔥", body: "Assalam-o-Alaikum {{name}},\n\nWe're excited to announce that {{featureName}} is now live on {{companyName}}!\n\nWhat's new:\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✨ {{featureBenefit1}}\n✨ {{featureBenefit2}}\n✨ {{featureBenefit3}}\n\nThis feature is part of our 2026 roadmap designed to help brands scale faster.\n\n📋 2026 Roadmap Highlights:\n• Q3 2026: WebSocket Engine, Payment Gateway, Courier API\n• Q4 2026: AI Forecasting, Workflow Automation, CRM 360
• Q1 2027: E-Commerce Storefront, Mobile App, Analytics Builder
• Q3 2027: Multi-Language RTL, 2FA, Social Commerce\n\nHow to Access:\n{{featureName}} is available on your current plan. Simply log in to your {{companyName}} dashboard and navigate to the feature from the sidebar.\n\n💡 Pro Tip: Check out our Feature Roadmap in the Guide section to see what's coming next!\n\nQuestions? Reply to this email or WhatsApp us at {{whatsapp}}.\n\nBest regards,\n{{companyName}} Team" },
    { key: "email_template_conversion", name: "Conversion Push", subject: "Exclusive 2026 Offer: Upgrade to {{planName}} and Save {{discount}}%", body: "Hi {{name}},\n\nAs a valued {{companyName}} user, here's an exclusive offer just for you — upgrade to {{planName}} and save {{discount}}%!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎁 What You Get with {{planName}}:\n\n✅ {{feature1}}\n✅ {{feature2}}\n✅ {{feature3}}\n✅ Priority Support (24/7 for Enterprise)\n✅ AI-Powered Tools (forecasting, descriptions, smart recommendations)\n✅ WebSocket Real-Time Engine (instant updates everywhere)\n✅ Advanced Analytics Suite (revenue, traffic, customer LTV)\n✅ Unlimited Team Members (Enterprise plan)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n💡 Use Code: {{promoCode}}\n⏰ Offer Expires: {{expiryDate}}\n\n2026 Plan Comparison:\n• Starter — Rs 7,999/mo + Rs 5,000 setup (3 team members, 5 GB)\n• Growth — Rs 15,000/mo + Rs 10,000 setup (8 team members, campaigns, 20 GB)\n• Professional — Rs 25,000/mo + Rs 15,000 setup (15 team members, AI tools, 50 GB)\n• Enterprise — Rs 75,000+/mo + Rs 30,000+ setup (everything unlimited, dedicated support)\n\nUpgrade now and unlock the full power of {{companyName}}!\n\nBest regards,\n{{companyName}} Team" },
    { key: "email_template_re_engagement", name: "Re-engagement", subject: "{{name}}, {{companyName}} just got even better — See what's new in 2026!", body: "Hi {{name}},\n\nWe noticed it's been a while since you last used {{companyName}}, and we wanted to share some exciting updates we've shipped in 2026:\n\n🔥 What's New Since Your Last Visit:\n\n⚡ WebSocket Real-Time Engine — Live order tracking, instant notifications, and real-time team chat\n🧠 AI Inventory Forecasting — ML-powered demand prediction that saves 30% on carrying costs\n🔧 Visual Workflow Automation — Drag-and-drop builder for automated order processing\n👥 CRM Customer 360 — Complete customer profiles with lifetime value and segmentation\n📱 Team Chat — Built-in real-time messaging for your entire team\n📊 Analytics Builder — Custom report builder with drag-and-drop metrics\n\n📋 2026 Roadmap Preview:\n• Multi-Warehouse Management\n• E-Commerce Storefront\n• Mobile App (iOS + Android)
• Payment Gateway Integration\n• Courier API (TCS, Leopards, M&P)\n\n🎁 Welcome Back Offer:\nUse code COMEBACK{{discount}} for {{discount}}% off your next month!\n\nJoin 500+ brands already using {{companyName}} to manage and grow their businesses.\n\nQuestions or need help getting started again? WhatsApp us at {{whatsapp}} — we're happy to help.\n\nBest regards,\n{{companyName}} Team" },
  ];

  for (const tpl of emailTemplates) {
    await db.systemSetting.create({
      data: { key: tpl.key, value: JSON.stringify(tpl), category: "email_template" },
    });
  }
  console.log(`✅ ${emailTemplates.length} email templates seeded`);

  // 14. Seed Automations
  const automations = [
    { key: "automation_welcome", name: "Welcome Series", trigger: "user_signup", actions: ["send_email:welcome", "add_tag:new_user", "notify_admin"], delay: "0 minutes", enabled: true },
    { key: "automation_lead_magnet", name: "Lead Magnet Delivery", trigger: "form_submit", actions: ["send_email:lead_magnet", "add_tag:lead", "create_task:follow_up"], delay: "0 minutes", enabled: true },
    { key: "automation_3day_followup", name: "3-Day Follow-Up", trigger: "schedule:3_days", actions: ["send_email:follow_up", "update_tag:active_user"], delay: "3 days", enabled: true },
    { key: "automation_feature_highlight", name: "Feature Highlight", trigger: "schedule:7_days", actions: ["send_email:feature", "add_tag:engaged"], delay: "7 days", enabled: false },
    { key: "automation_conversion_push", name: "Conversion Push", trigger: "schedule:14_days", actions: ["send_email:conversion", "create_task:sales_follow_up"], delay: "14 days", enabled: false },
  ];

  for (const auto of automations) {
    await db.systemSetting.create({
      data: { key: auto.key, value: JSON.stringify(auto), category: "automation" },
    });
  }
  console.log(`✅ ${automations.length} automations seeded`);

  // 15. Seed Demo Leads
  const demoLeads = [
    { key: "demo_lead_1", name: "Hassan Sheikh", email: "hassan@techbrand.pk", phone: "+92-321-9876543", company: "TechBrand Pakistan", city: "Lahore", industry: "E-Commerce", interest: "Brand Management", source: "website" },
    { key: "demo_lead_2", name: "Ayesha Tariq", email: "ayesha@fashionhub.pk", phone: "+92-300-5551234", company: "Fashion Hub Karachi", city: "Karachi", industry: "Fashion & Apparel", interest: "Marketing & Campaigns", source: "whatsapp" },
    { key: "demo_lead_3", name: "Omar Farooq", email: "omar@foodfleet.pk", phone: "+92-333-7788990", company: "FoodFleet Islamabad", city: "Islamabad", industry: "Food & Beverage", interest: "Order Management", source: "referral" },
  ];

  for (const lead of demoLeads) {
    await db.systemSetting.create({
      data: { key: lead.key, value: JSON.stringify(lead), category: "demo_lead" },
    });
  }
  console.log(`✅ ${demoLeads.length} demo leads seeded`);

  // 12. Create system settings
  await db.systemSetting.create({ data: { key: 'platform_version', value: '3.0.0', category: 'system' } });
  await db.systemSetting.create({ data: { key: 'last_cron_run', value: new Date().toISOString(), category: 'system' } });
  console.log('✅ System settings created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('📧 6 email templates, 5 automations, and 3 demo leads seeded!');
  console.log('\n📧 Login credentials: admin@valtriox.com / Admin@123');
  console.log('🏪 Demo org: Demo Store');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
