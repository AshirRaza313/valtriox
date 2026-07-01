import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// GET /api/admin/payments - List all payment proofs (for admin dashboard)
export const GET = withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Payments] GET request", { userId: authCtx.userId });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // Build where clause
  const where: any = {};
  if (status && status !== "all") {
    where.status = status;
  }

  const [r1, r2] = await Promise.all([
    safeDbQuery(() =>
      db.paymentProof.findMany({
        where,
        include: {
          subscription: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  email: true,
                  phone: true,
                  logo: true,
                  plan: true,
                  isBanned: true,
                  paymentRejectionCount: true,
                },
              },
              plan: {
                select: { name: true, price: true, annualPrice: true, period: true },
              },
            },
          },
          organization: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ),
    safeDbQuery(() =>
      db.paymentProof.findMany({ select: { status: true } })
    ),
  ]);

  if (r1.error) {
    logger.error("[Admin Payments] GET error fetching payments", { error: r1.error });
    return r1.errorResponse;
  }
  if (r2.error) {
    logger.error("[Admin Payments] GET error fetching stats", { error: r2.error });
    return r2.errorResponse;
  }

  const payments = r1.data;
  const allPayments = r2.data;

  const stats = {
    total: allPayments?.length ?? 0,
    pending: allPayments?.filter((p) => p.status === "pending").length ?? 0,
    approved: allPayments?.filter((p) => p.status === "approved").length ?? 0,
    rejected: allPayments?.filter((p) => p.status === "rejected").length ?? 0,
  };

  const formatted = (payments ?? []).map((p) => ({
    id: p.id,
    planName: p.planName,
    planId: p.planId,
    amount: p.amount,
    billingCycle: p.billingCycle || "monthly",
    transactionId: p.transactionId,
    paymentMethod: p.paymentMethod,
    screenshotUrl: p.screenshotUrl,
    status: p.status,
    adminNote: p.adminNote,
    reviewedBy: p.reviewedBy,
    reviewedAt: p.reviewedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    organization: p.subscription?.organization || p.organization || null,
    subscriptionPlan: p.subscription?.plan || null,
  }));

  return NextResponse.json({ payments: formatted, stats });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
