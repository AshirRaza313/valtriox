import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { db, safeDbQuery } from "@/lib/db";
import logger from "@/lib/logger";

/**
 * GET /api/health
 *
 * Anti-regression health check route that validates critical system functionality.
 * Returns 200 if all checks pass, 503 if any critical check fails.
 * Includes database, environment, memory, uptime, and API route checks.
 */
export async function GET() {
  const health: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks: {},
  };

  // Check Database connectivity using safeDbQuery wrapper
  const start = Date.now();
  const { data, error } = await safeDbQuery(() =>
    db.$queryRaw`SELECT 1 as ok`
  );

  if (error || !data) {
    health.status = "degraded";
    health.checks.database = {
      status: "unhealthy",
      error: error?.substring(0, 200) || "Unknown database error",
    };
    logger.error("[Health] Database check failed", { error });
  } else {
    health.checks.database = {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  }

  // Check required environment variables
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  health.checks.environment = missing.length === 0
    ? { status: "healthy" }
    : { status: "warning", missing };

  // Check Authentication configuration
  health.checks.auth = {
    status: process.env.NEXTAUTH_SECRET ? "configured" : "warning",
  };

  // Check Memory usage
  const mem = process.memoryUsage();
  const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const totalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const memoryPercentage = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  health.checks.memory = {
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
  health.checks.uptime = {
    status: "healthy",
    seconds: Math.round(uptimeSeconds),
    formatted: `${uptimeHours}h ${uptimeMinutes}m`,
  };

  // Check critical API routes exist on filesystem
  const criticalRoutes = [
    "src/app/api/health/route.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/register/route.ts",
    "src/app/api/auth/[...nextauth]/route.ts",
    "src/app/api/orders/route.ts",
    "src/app/api/products/route.ts",
    "src/app/api/customers/route.ts",
    "src/app/api/dashboard/stats/route.ts",
    "src/app/api/settings/route.ts",
    "src/app/api/subscriptions/plans/route.ts",
    "src/app/api/admin/settings/route.ts",
  ];

  // Determine project root (src/app/api/health/route.ts → project root)
  const projectRoot = process.cwd();
  const apiRoutesResults: Record<string, { exists: boolean }> = {};
  let routesAllExist = true;

  for (const routePath of criticalRoutes) {
    const fullPath = join(projectRoot, routePath);
    const exists = existsSync(fullPath);
    apiRoutesResults[routePath] = { exists };
    if (!exists) {
      routesAllExist = false;
      logger.warn("[Health] Critical API route file missing", { route: routePath });
    }
  }

  health.checks.api_routes = {
    status: routesAllExist ? "healthy" : "warning",
    routes: apiRoutesResults,
    total: criticalRoutes.length,
    present: Object.values(apiRoutesResults).filter((r) => r.exists).length,
    missing: Object.values(apiRoutesResults).filter((r) => !r.exists).length,
  };
  if (!routesAllExist) {
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: { "Cache-Control": "no-store" },
  });
}
