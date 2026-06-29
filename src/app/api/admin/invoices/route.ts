import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  logger.info("[Admin Invoices] GET request", { userId: authCtx.userId });
  try {
    const status = req.nextUrl.searchParams.get("status");
    const search = req.nextUrl.searchParams.get("search");

    const where: any = {};
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { orgName: { contains: search, mode: "insensitive" } },
        { invoiceNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const invoices = await withRetry(async () => {
      return await db.invoice.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, email: true, plan: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    }, 2, 500);

    const stats = {
      total: await db.invoice.count(),
      totalRevenue: await db.invoice.aggregate({ _sum: { amount: true } }),
      pending: await db.invoice.count({ where: { status: "pending" } }),
      paid: await db.invoice.count({ where: { status: { in: ["paid", "approved"] } } }),
    };

    return NextResponse.json({ invoices, stats });
  } catch (error: any) {
    return dbErrorResponse(error);
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
