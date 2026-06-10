// ============================================================================
// Health Monitoring Utility for Valtriox
// ============================================================================
// Lightweight health monitoring with in-memory history for trend analysis.
// Used by health check endpoints and background monitoring services.
// ============================================================================

import { db, ensureDb, isDbUnavailable } from "@/lib/db";
import logger from "@/lib/logger";

export const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const HEALTH_ALERT_THRESHOLD = 3; // 3 consecutive failures before alert

export interface HealthStatus {
  timestamp: string;
  database: {
    status: "healthy" | "degraded" | "down";
    latency_ms: number;
    error?: string;
  };
  memory: {
    used_mb: number;
    total_mb: number;
    percentage: number;
  };
  uptime_seconds: number;
  overall: "healthy" | "degraded" | "critical";
}

// Store last N health check results in memory for trend analysis
export const healthHistory: HealthStatus[] = [];
const MAX_HISTORY = 100;

/**
 * Perform a full health check across all monitored subsystems.
 * Returns a structured HealthStatus object.
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();

  // ── Database check ──
  const dbStatus: HealthStatus["database"] = {
    status: "down",
    latency_ms: -1,
  };

  try {
    const dbReady = await ensureDb();
    const start = Date.now();
    if (dbReady) {
      await db.$queryRaw`SELECT 1 as ok`;
    }
    const latency = Date.now() - start;
    dbStatus.status = dbReady ? (latency > 5000 ? "degraded" : "healthy") : "degraded";
    dbStatus.latency_ms = latency;
  } catch (err: any) {
    dbStatus.status = "down";
    dbStatus.latency_ms = Date.now(); // approximate
    dbStatus.error = isDbUnavailable(err)
      ? "Database unavailable"
      : err?.message?.substring(0, 200);
    logger.error("[HealthMonitor] Database health check failed", err);
  }

  // ── Memory check ──
  const mem = process.memoryUsage();
  const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const totalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const percentage = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  // ── Uptime ──
  const uptimeSeconds = Math.round(process.uptime());

  // ── Overall status determination ──
  let overall: HealthStatus["overall"] = "healthy";
  if (dbStatus.status === "down") {
    overall = "critical";
  } else if (dbStatus.status === "degraded" || percentage >= 90) {
    overall = "degraded";
  }

  const result: HealthStatus = {
    timestamp,
    database: dbStatus,
    memory: {
      used_mb: usedMb,
      total_mb: totalMb,
      percentage,
    },
    uptime_seconds: uptimeSeconds,
    overall,
  };

  // ── Store in history ──
  healthHistory.push(result);
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.shift();
  }

  // ── Log status ──
  if (overall === "critical") {
    logger.error("[HealthMonitor] Critical health status", { database: dbStatus, memory: { used_mb: usedMb, percentage } });
  } else if (overall === "degraded") {
    logger.warn("[HealthMonitor] Degraded health status", { database: dbStatus, memory: { used_mb: usedMb, percentage } });
  }

  return result;
}

/**
 * Returns the count of consecutive failures (overall !== "healthy")
 * from the health history. Used for alert thresholding.
 */
export function getConsecutiveFailures(): number {
  let count = 0;
  for (let i = healthHistory.length - 1; i >= 0; i--) {
    if (healthHistory[i].overall !== "healthy") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Returns a summary of the health history for trend analysis.
 * Includes average latencies and failure counts over the stored period.
 */
export function getHealthTrends(): {
  total_checks: number;
  healthy_count: number;
  degraded_count: number;
  critical_count: number;
  avg_db_latency_ms: number | null;
  avg_memory_percentage: number | null;
  oldest_check: string | null;
  newest_check: string | null;
  consecutive_failures: number;
} {
  const total = healthHistory.length;
  if (total === 0) {
    return {
      total_checks: 0,
      healthy_count: 0,
      degraded_count: 0,
      critical_count: 0,
      avg_db_latency_ms: null,
      avg_memory_percentage: null,
      oldest_check: null,
      newest_check: null,
      consecutive_failures: 0,
    };
  }

  const healthyCount = healthHistory.filter((h) => h.overall === "healthy").length;
  const degradedCount = healthHistory.filter((h) => h.overall === "degraded").length;
  const criticalCount = healthHistory.filter((h) => h.overall === "critical").length;

  const successfulDbLatencies = healthHistory
    .filter((h) => h.database.latency_ms >= 0)
    .map((h) => h.database.latency_ms);
  const avgDbLatency = successfulDbLatencies.length > 0
    ? Math.round(successfulDbLatencies.reduce((a, b) => a + b, 0) / successfulDbLatencies.length)
    : null;

  const avgMemory = total > 0
    ? Math.round(healthHistory.reduce((a, h) => a + h.memory.percentage, 0) / total)
    : null;

  return {
    total_checks: total,
    healthy_count: healthyCount,
    degraded_count: degradedCount,
    critical_count: criticalCount,
    avg_db_latency_ms: avgDbLatency,
    avg_memory_percentage: avgMemory,
    oldest_check: healthHistory[0].timestamp,
    newest_check: healthHistory[total - 1].timestamp,
    consecutive_failures: getConsecutiveFailures(),
  };
}
