import { NextRequest, NextResponse } from "next/server";
import { db, isDbUnavailable, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createCouponSchema, updateCouponSchema } from "@/lib/validations/schemas";

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const coupons = await withRetry(async () => {
      const [result, count] = await Promise.all([ db.coupon.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, skip: 0, take: 100 }), db.coupon.count({ where: { organizationId: orgId } }) ]); return [result, count];
    }, 2, 500);
    return NextResponse.json({ coupons });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Coupons GET error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ coupons: [], fallback: true });
    }
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    // Phase 6: Zod validation
    const parseResult = createCouponSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const { organizationId, code, type, value, minOrder, usageLimit, expiresAt } = body;
    const orgId = organizationId || authCtx.organizationId;

    if (!orgId || !code || !value) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: Ensure user can only create coupons in their own org
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const coupon = await withRetry(async () => {
      return db.coupon.create({
      data: {
        organizationId: orgId,
        code: code.toUpperCase(),
        type: type || "percentage",
        value: parseFloat(value),
        minOrder: minOrder ? parseFloat(minOrder) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    }, 2, 500);

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Coupons POST error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: "Database is currently unavailable. Please try again later.", fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}), { maxRequests: 20, windowSeconds: 60 });
