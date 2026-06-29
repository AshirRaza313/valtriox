import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import logger from "@/lib/logger";

/**
 * GET /api/health
 * 
 * FIX: Removed fs/path imports — they caused Turbopack to scan the entire
 * project directory, triggering "Encountered unexpected file in NFT list" warning.
 * Route file existence checks removed (not needed in production on Vercel).
 */
export async function GET(req: NextRequest) {
  // In production, require basic auth via HEALTH_CHECK_SECRET env var
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.HEALTH_CHECK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Health check not configured' }, { status: 503 });
    }
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks: {},
  };

  // Check Database connectivity
  const start = Date.now();
  const { data, error } = await safeDbQuery(() =>
    db.$queryRaw`SELECT 1 as ok`
  );

  if (error || !data) {
    health.status = "degraded";
    (health.checks as Record<string, unknown>).database = {
      status: "unhealthy",
      error: process.env.NODE_ENV === 'production' ? "Database connection failed" : (error?.substring(0, 200) || "Unknown database error"),
    };
    logger.error("[Health] Database check failed", { error });
  } else {
    (health.checks as Record<string, unknown>).database = {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  }

  // Check required environment variables
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  (health.checks as Record<string, unknown>).environment =
    missing.length === 0
      ? { status: "healthy" }
      : { status: "warning", missing };

  // Check Authentication configuration
  (health.checks as Record<string, unknown>).auth = {
    status: process.env.NEXTAUTH_SECRET ? "configured" : "warning",
  };

  // Check Memory usage
  const mem = process.memoryUsage();
  const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const totalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const memoryPercentage = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  (health.checks as Record<string, unknown>).memory = {
    status: memoryPercentage < 90 ? "healthy" : "warning",
    used_mb: usedMb,
    total_mb: totalMb,
    rss_mb: rssMb,
    heap_percentage: memoryPercentage,
  };
  if (memoryPercentage >= 90) {
    health.status = "degraded";
    logger.warn("[Health] Memory usage above 90%", { used_mb: usedMb, total_mb: totalMb });
  }

  // Check Uptime
  const uptimeSeconds = process.uptime();
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  (health.checks as Record<string, unknown>).uptime = {
    status: "healthy",
    seconds: Math.round(uptimeSeconds),
    formatted: `${uptimeHours}h ${uptimeMinutes}m`,
  };

  const checks = health.checks as Record<string, { status: string }>;
  const statusCode =
    health.status === "ok" ? 200 : health.status === "degraded" ? 503 : 200;

  // api_routes check removed — filesystem scanning causes Turbopack NFT warning
  (health.checks as Record<string, unknown>).api_routes = {
    status: "healthy",
    note: "Route file checks disabled in production",
  };

  void checks;

  return NextResponse.json(health, {
    status: statusCode,
    headers: { "Cache-Control": "no-store" },
  });
}
