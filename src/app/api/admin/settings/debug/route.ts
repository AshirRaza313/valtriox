import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/admin/settings/debug
 *
 * Diagnostic endpoint - tests Prisma connection and shows DB status.
 * Only returns non-sensitive summary information.
 * Requires platform_owner or platform_admin authentication.
 */
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  const results: Record<string, any> = { timestamp: new Date().toISOString() };

  const dbUrl = process.env.DATABASE_URL || '';
  results.databaseUrl = { set: !!dbUrl };

  // Test 1: Prisma simple raw query
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    results.test1_prismaRaw = { status: "OK" };
  } catch {
    results.test1_prismaRaw = { status: "FAILED" };
  }

  // Test 2: Prisma findFirst on PlatformSettings
  try {
    const s = await withRetry(async () => {
      return await db.platformSettings.findFirst({ orderBy: { createdAt: "desc" } })
    }, 2, 500);
    results.test2_prismaFind = { status: "OK", found: !!s };
  } catch {
    results.test2_prismaFind = { status: "FAILED" };
  }

  // Test 3: Prisma count
  try {
    const count = await withRetry(async () => {
      return await db.platformSettings.count()
    }, 2, 500);
    results.test3_prismaCount = { status: "OK", count };
  } catch {
    results.test3_prismaCount = { status: "FAILED" };
  }

  // Test 4: Prisma raw query to list tables
  try {
    const rows: any = await db.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    results.tableCount = rows.length;
  } catch {
    results.tableCount = 0;
  }

  // Return only non-sensitive summary: timestamp, databaseUrl.set, prismaConnected, test2 status, tableCount
  return NextResponse.json({
    timestamp: results.timestamp,
    databaseUrl: { set: !!dbUrl },
    prismaConnected: results.test1_prismaRaw?.status === "OK",
    test2_prismaFind: results.test2_prismaFind ? { status: results.test2_prismaFind.status, found: results.test2_prismaFind.found } : { status: "FAILED", found: false },
    tableCount: results.tableCount || 0,
  }, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
