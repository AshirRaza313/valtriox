import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, isSchemaError, withRetry, ensureDb } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

/** Safely extract message and code from an unknown error */
function getErrorInfo(e: unknown): { message: string; code: string } {
  if (e && typeof e === "object") {
    const message = "message" in e && typeof (e as Record<string, unknown>).message === "string" ? (e as Record<string, unknown>).message as string : String(e);
    const code = "code" in e && typeof (e as Record<string, unknown>).code === "string" ? (e as Record<string, unknown>).code as string : "";
    return { message, code };
  }
  return { message: String(e), code: "" };
}

/** Row shape returned by $queryRaw for revenue aggregation */
interface RevenueRow { organizationId: string; total: string }
interface MonthlyOrderRow { organizationId: string; count: number }
interface LastOrderRow { organizationId: string; createdAt: string }

// Allow up to 30 seconds for DB operations on Vercel serverless
export const maxDuration = 30;

// GET /api/admin/clients - Admin-only: return all organizations with stats
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Clients] GET request", { userId: authCtx.userId });
  try {
    // Wrap main query in retry for transient PgBouncer cold-start errors
    const result = await withRetry(async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const orgs = await db.organization.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { members: true, products: true, orders: true, customers: true } } },
      });

      const orgIds = orgs.map((o) => o.id);

      let revenueMap: Record<string, number> = {};
      let monthlyOrdersMap: Record<string, number> = {};
      let lastOrderMap: Record<string, string> = {};
      let ownerMap: Record<string, { id: string; name: string; email: string; role: string }> = {};

      if (orgIds.length > 0) {
        const [revenueRows, monthlyRows, lastOrderRows, firstMembers] = await Promise.all([
          db.$queryRaw`SELECT "organizationId", COALESCE(SUM(total), 0) as total FROM "Order" WHERE "organizationId" = ANY(${orgIds}::text[]) GROUP BY "organizationId"`,
          db.$queryRaw`SELECT "organizationId", COUNT(*)::int as count FROM "Order" WHERE "organizationId" = ANY(${orgIds}::text[]) AND "createdAt" >= ${firstOfMonth} GROUP BY "organizationId"`,
          db.$queryRaw`SELECT DISTINCT ON ("organizationId") "organizationId", "createdAt" FROM "Order" WHERE "organizationId" = ANY(${orgIds}::text[]) ORDER BY "organizationId", "createdAt" DESC`,
          db.organizationMember.findMany({
            where: { organizationId: { in: orgIds } },
            orderBy: { joinedAt: "asc" },
            distinct: ["organizationId"],
            select: { organizationId: true, userId: true, user: { select: { id: true, name: true, email: true, role: true } }, role: true },
          }),
        ]);

        for (const row of (revenueRows as RevenueRow[])) revenueMap[row.organizationId] = parseFloat(row.total) || 0;
        for (const row of (monthlyRows as MonthlyOrderRow[])) monthlyOrdersMap[row.organizationId] = parseInt(String(row.count)) || 0;
        for (const row of (lastOrderRows as LastOrderRow[])) lastOrderMap[row.organizationId] = row.createdAt;
        for (const m of firstMembers) ownerMap[m.organizationId] = { id: m.user.id, name: m.user.name, email: m.user.email, role: m.user.role };
      }

      const clients = orgs.map((org) => ({
        id: org.id, name: org.name, slug: org.slug, logo: org.logo,
        email: org.email, phone: org.phone, website: org.website,
        plan: org.plan || "starter", currency: org.currency, timezone: org.timezone,
        isActive: org.isActive, isBanned: org.isBanned || false, banReason: org.banReason || null,
        createdAt: org.createdAt, updatedAt: org.updatedAt,
        owner: ownerMap[org.id] || null,
        memberCount: org._count?.members || 0, productCount: org._count?.products || 0,
        orderCount: org._count?.orders || 0, customerCount: org._count?.customers || 0,
        revenueTotal: revenueMap[org.id] || 0,
        ordersThisMonth: monthlyOrdersMap[org.id] || 0,
        lastActivity: lastOrderMap[org.id] || org.updatedAt,
      }));

      const totalClients = clients.length;
      const newThisMonth = clients.filter((c) => new Date(c.createdAt) >= firstOfMonth).length;
      const totalRevenue = clients.reduce((sum, c) => sum + c.revenueTotal, 0);
      const totalOrders = clients.reduce((sum, c) => sum + c.orderCount, 0);
      const planDistribution: Record<string, number> = {};
      for (const c of clients) planDistribution[c.plan] = (planDistribution[c.plan] || 0) + 1;

      return { clients, summary: { totalClients, newThisMonth, totalRevenue, totalOrders, planDistribution } };
    }, 3, 1000);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const { message: errMsg } = getErrorInfo(error);
    console.error("Admin clients API error:", errMsg || error);
    // Return empty data instead of 503 so the page still loads
    return NextResponse.json({
      clients: [],
      summary: { totalClients: 0, newThisMonth: 0, totalRevenue: 0, totalOrders: 0, planDistribution: {} },
      _dbError: true,
      error: process.env.NODE_ENV === 'production' ? "Database temporarily unavailable" : (errMsg || "Database temporarily unavailable")
    });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });

// POST /api/admin/clients - Admin-only: register a new brand/client
//
// IMPORTANT: Uses SEQUENTIAL operations instead of an interactive transaction
// (db.$transaction(async (tx) => {...})) because PgBouncer in transaction mode
// does NOT support Prisma interactive transactions. Interactive transactions
// require a direct database connection, but PgBouncer acts as a connection pooler
// that multiplexes connections. This caused consistent 503 timeouts.
//
// Sequential operations with cleanup on failure provide near-atomic behavior.
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Clients] POST request - Register brand", { userId: authCtx.userId });

  // Pre-import plan utilities (used across multiple steps)
  const { getPlanDisplayName } = await import("@/lib/plan-limits");

  // Step 0: Pre-flight DB check - fail fast if unreachable
  try {
    const dbReady = await ensureDb();
    if (!dbReady) {
      logger.warn("[Register Brand] ensureDb returned false - DB unreachable");
      return NextResponse.json(
        { error: "Database is currently unreachable. Please try again in a moment.", _reason: "ensureDb_false" },
        { status: 503 }
      );
    }
  } catch (err: unknown) {
    logger.error("[Register Brand] ensureDb threw:", err);
    // Don't hard-fail - the individual operations have their own retries
  }

  try {
    const body = await req.json();
    const { name, email, password, brandName, plan, phone, country, currency, brandTagline, brandWebsite, industry, consultationDate, notes } = body;

    if (!name || !email || !password || !brandName) {
      return NextResponse.json({ error: "All fields (name, email, password, brandName) are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const cleanBrandName = brandName.trim();
    const slug = cleanBrandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);
    const planValue = plan || "starter";

    // Hash password (CPU-intensive - do this before any DB operations)
    const bcrypt = (await import("bcryptjs")).default;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Step 1: Check if email already exists
    let existingUser: Awaited<ReturnType<typeof db.user.findUnique>>;
    try {
      existingUser = await withRetry(
        () => db.user.findUnique({ where: { email: cleanEmail } }),
        3, 500
      );
    } catch (err: unknown) {
      const { message: errMsg, code: errCode } = getErrorInfo(err);
      logger.error("[Register Brand] Step 1 failed (email check):", err, { errCode });
      return NextResponse.json(
        { error: "Database error while checking email. Please try again.", _step: "email_check", _details: process.env.NODE_ENV === "production" ? undefined : errMsg },
        { status: 503 }
      );
    }
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered. Delete the existing client first to re-register." },
        { status: 400 }
      );
    }

    // Step 2: Find subscription plan (non-critical - continue if not found)
    let subPlan: Awaited<ReturnType<typeof db.subscriptionPlan.findFirst>> = null;
    try {
      subPlan = await withRetry(
        () => db.subscriptionPlan.findFirst({ where: { name: planValue } }),
        2, 500
      );
    } catch (err: unknown) {
      logger.warn("[Register Brand] Step 2 warning (plan lookup failed, continuing):", { error: getErrorInfo(err).message });
    }

    // Step 3: Create user
    let user: Awaited<ReturnType<typeof db.user.create>>;
    try {
      user = await withRetry(
        () => db.user.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            role: "brand_owner",
          },
        }),
        3, 500
      );
    } catch (err: unknown) {
      const { message: errMsg, code: errCode } = getErrorInfo(err);
      logger.error("[Register Brand] Step 3 failed (create user):", err, { errCode });
      if (errCode === "P2002") {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to create user account. Please try again.", _step: "create_user", _details: process.env.NODE_ENV === "production" ? undefined : errMsg, _code: process.env.NODE_ENV === "production" ? undefined : errCode },
        { status: 500 }
      );
    }

    // Step 4: Create organization with brand details & auto-configured plan features
    let org: Awaited<ReturnType<typeof db.organization.create>>;
    try {
      // Import plan configuration for auto-configuration
      const { getPlanLimits, getFeatureAccess, PLAN_FEATURE_MATRIX, getPlanDisplayName } = await import("@/lib/plan-limits");
      const planLimits = getPlanLimits(planValue);
      const featureMap = getFeatureAccess(planValue);
      const planFeatures = PLAN_FEATURE_MATRIX[planValue] || [];

      const orgData = {
        name: cleanBrandName,
        slug,
        email: cleanEmail,
        currency: currency || "PKR",
        plan: planValue,
        ...(phone ? { phone } : {}),
        ...(country ? { country } : {}),
        ...(brandTagline ? { brandTagline } : {}),
        ...(brandWebsite ? { website: brandWebsite } : {}),
        ...(industry ? { industry } : {}),
      };

      org = await withRetry(
        () => db.organization.create({ data: orgData }),
        3, 500
      );

      logger.info("[Register Brand] Step 4: Organization created with auto-configured plan features", {
        orgId: org.id,
        plan: planValue,
        featuresEnabled: planFeatures,
        featureFlags: Object.entries(featureMap).filter(([, v]) => v).map(([k]) => k).join(", "),
      });
    } catch (err: unknown) {
      const { message: errMsg, code: errCode } = getErrorInfo(err);
      logger.error("[Register Brand] Step 4 failed (create org):", err, { errCode });
      // Cleanup: delete the user we just created
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
      return NextResponse.json(
        { error: "Failed to create organization. Please try again.", _step: "create_org", _details: process.env.NODE_ENV === "production" ? undefined : errMsg, _code: process.env.NODE_ENV === "production" ? undefined : errCode },
        { status: 500 }
      );
    }

    // Step 5: Create org membership
    try {
      await withRetry(
        () => db.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: "brand_owner",
          },
        }),
        3, 500
      );
    } catch (err: unknown) {
      const { message: errMsg, code: errCode } = getErrorInfo(err);
      logger.error("[Register Brand] Step 5 failed (create membership):", err, { errCode });
      // Cleanup: delete org and user
      await db.organization.delete({ where: { id: org.id } }).catch(() => {});
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
      return NextResponse.json(
        { error: "Failed to create team membership. Please try again.", _step: "create_membership", _details: process.env.NODE_ENV === "production" ? undefined : errMsg, _code: process.env.NODE_ENV === "production" ? undefined : errCode },
        { status: 500 }
      );
    }

    // Step 6: Create subscription (non-critical - org and user are already created)
    if (subPlan) {
      try {
        const trialDays = subPlan.trialDays || 14;
        const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
        await withRetry(
          () => db.subscription.create({
            data: {
              organizationId: org.id,
              planId: subPlan.id,
              status: Number(subPlan.price) === 0 ? "active" : "trial",
              billingCycle: "monthly",
              trialEndsAt: trialEnd,
              currentPeriodEnd: Number(subPlan.price) === 0 ? null : trialEnd,
            },
          }),
          3, 500
        );
      } catch (err: unknown) {
        // Subscription creation failure is non-critical
        // The org and user exist, subscription can be added later
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn("[Register Brand] Step 6 warning (subscription creation failed, non-critical):", { message: errMsg });
      }
    }

    // Step 7: Create "Account Setup" welcome notification (non-critical)
    try {
      const { getPlanLimits, getPlanDisplayName, PLAN_FEATURES } = await import("@/lib/plan-limits");
      const planLimits = getPlanLimits(planValue);
      const planDisplayName = getPlanDisplayName(planValue);
      const features = PLAN_FEATURES[planValue] || [];

      const teamLimit = planLimits.teamMembers === -1 ? 'Unlimited' : String(planLimits.teamMembers);
      const orderLimit = planLimits.ordersPerMonth === -1 ? 'Unlimited' : String(planLimits.ordersPerMonth);
      const productLimit = planLimits.products === -1 ? 'Unlimited' : String(planLimits.products);

      const featureList = features.length > 0
        ? features.map((f: string) => `  - ${f}`).join('\n')
        : '  - Core dashboard & order management\n  - Basic analytics';

      const welcomeMessage = [
        `Welcome to Valtriox, ${cleanName}!`,
        ``,
        `Your brand "${cleanBrandName}" has been set up with the ${planDisplayName} plan.`,
        ``,
        `Plan Details:`,
        `  - Team members: ${teamLimit}`,
        `  - Monthly orders: ${orderLimit}`,
        `  - Product listings: ${productLimit}`,
        ``,
        `Your plan includes:`,
        featureList,
        ``,
        `Getting Started:`,
        `  1. Log in at your dashboard with your email (${cleanEmail})`,
        `  2. Complete your brand settings (logo, colors, contact info)`,
        `  3. Add your first products and start receiving orders`,
        `  4. Explore the user guide for tips and best practices`,
        ``,
        `Need help? Contact our support team at ashir@valtriox.com`,
      ].join('\n');

      await withRetry(
        () => db.notification.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            title: 'Account Setup - Welcome to Valtriox!',
            message: welcomeMessage,
            type: 'success',
            actionUrl: '/dashboard',
            icon: 'Rocket',
          },
        }),
        2, 500
      );

      logger.info("[Register Brand] Step 7: Welcome notification created", { userId: user.id });
    } catch (err: unknown) {
      logger.warn("[Register Brand] Step 7 warning (notification creation failed, non-critical):", { error: getErrorInfo(err).message });
    }

    // Step 8: Create consultation tracking entry (Lead record for follow-up)
    // This creates a trackable record so the team knows a consultation may be needed.
    if (consultationDate || notes) {
      try {
        // Phase 6: Fixed type — removed Record<string, any> for Prisma compatibility
        const leadData = {
          fullName: cleanName,
          email: cleanEmail,
          phone: phone || null,
          company: cleanBrandName,
          industry: industry || null,
          interest: `Valtriox ${planValue} Plan`,
          message: notes || `Brand registered via admin panel with ${planValue} plan.`,
          status: consultationDate ? "consultation_scheduled" : "contacted",
          source: "website",
          ...(consultationDate ? { preferredDate: consultationDate } : {}),
        };

        await withRetry(
          () => db.lead.create({ data: leadData }),
          2, 500
        );

        logger.info("[Register Brand] Step 8: Consultation tracking entry created", {
          orgId: org.id,
          consultationDate: consultationDate || "none",
          hasNotes: !!notes,
        });
      } catch (err: unknown) {
        // Lead creation failure is non-critical
        logger.warn("[Register Brand] Step 8 warning (lead creation failed, non-critical):", { error: getErrorInfo(err).message });
      }
    }

    logger.info("Admin registered new brand successfully", {
      userId: authCtx.userId,
      newUserId: user.id,
      orgId: org.id,
      brandName: cleanBrandName,
      email: cleanEmail,
      plan: planValue,
      industry: industry || null,
      consultationDate: consultationDate || null,
    });

    return NextResponse.json({
      success: true,
      message: `Brand "${cleanBrandName}" registered successfully with ${getPlanDisplayName(planValue)} plan`,
      user: { id: user.id, name: cleanName, email: cleanEmail, role: "brand_owner" },
      organization: { id: org.id, name: cleanBrandName, slug },
      consultationScheduled: !!consultationDate,
    });
  } catch (error: unknown) {
    const { message: errMsg, code: errCode } = getErrorInfo(error);
    const errStack = error instanceof Error ? error.stack?.slice(0, 200) : undefined;
    const errMeta = error && typeof error === 'object' && 'meta' in error ? (error as Record<string, unknown>).meta : undefined;
    console.error("[Register Brand] Unexpected error:", {
      message: errMsg,
      code: errCode,
      meta: errMeta,
      stack: errStack,
    });

    // Handle application-level errors (thrown with status)
    const errStatus = error && typeof error === 'object' && 'status' in error && typeof (error as Record<string, unknown>).status === 'number' ? (error as Record<string, unknown>).status as number : undefined;
    if (errStatus && errMsg) {
      return NextResponse.json({ error: errMsg }, { status: errStatus });
    }

    // Handle Prisma unique constraint violations (P2002)
    const msg = errMsg.toLowerCase();
    if (errCode === "P2002" || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Handle schema mismatch errors (P2021/P2022) - show real details
    if (isSchemaError(error)) {
      logger.error("[Register Brand] Schema mismatch:", error);
      return NextResponse.json(
        { error: "Database schema mismatch. Contact support.", _details: process.env.NODE_ENV === "production" ? undefined : errMsg, _code: errCode },
        { status: 500 }
      );
    }

    // Handle genuine DB connection errors
    if (isDbUnavailable(error)) {
      logger.error("[Register Brand] DB unavailable:", error);
      return NextResponse.json(
        { error: "Database connection timeout. Please try again in a moment.", _details: process.env.NODE_ENV === "production" ? undefined : errMsg, _code: errCode },
        { status: 503 }
      );
    }

    // Unknown error - return with full details for debugging
    return NextResponse.json(
      { error: "Failed to register brand", _details: process.env.NODE_ENV === "production" ? undefined : errMsg || String(error), _code: errCode },
      { status: 500 }
    );
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
