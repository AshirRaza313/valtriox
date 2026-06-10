// ============================================================================
// Anti-Regression Protection System for Valtriox
// ============================================================================
// This module provides validation utilities to prevent accidental regressions
// by verifying that critical modules and configurations are intact.
// ============================================================================

import { db, ensureDb, isDbUnavailable } from "@/lib/db";
import logger from "@/lib/logger";

export interface ValidationCheck {
  name: string;
  check: () => boolean | Promise<boolean>;
  severity: "critical" | "warning" | "info";
  message: string;
}

// ── Helper: require.resolve wrapper ──
function canResolve(modPath: string): boolean {
  try {
    require.resolve(modPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a list of validation checks for critical system paths.
 * These checks verify that core modules can be resolved and are available.
 */
export function validateCriticalPaths(): ValidationCheck[] {
  return [
    {
      name: "db-import",
      check: () => canResolve("@/lib/db"),
      severity: "critical",
      message: "Database module must be importable",
    },
    {
      name: "auth-middleware",
      check: () => canResolve("@/lib/auth-middleware"),
      severity: "critical",
      message: "Auth middleware module must be importable",
    },
    {
      name: "schema-exists",
      check: () => canResolve("@prisma/client"),
      severity: "critical",
      message: "Prisma client must be importable",
    },
    {
      name: "feature-lock-import",
      check: () => canResolve("@/lib/feature-lock"),
      severity: "warning",
      message: "Feature-lock module must be importable",
    },
    {
      name: "plan-limits-import",
      check: () => canResolve("@/lib/plan-limits"),
      severity: "warning",
      message: "Plan limits module must be importable",
    },
    {
      name: "email-service-import",
      check: () => canResolve("@/lib/email"),
      severity: "warning",
      message: "Email service module must be importable",
    },
    {
      name: "roles-import",
      check: () => canResolve("@/lib/roles"),
      severity: "warning",
      message: "Roles module must be importable",
    },
    {
      name: "store-import",
      check: () => canResolve("@/store/brandflow-store"),
      severity: "info",
      message: "BrandFlow store module must be importable",
    },
  ];
}

/**
 * Returns a list of configuration validation checks.
 * These verify that required environment variables are set and valid.
 */
export function validateConfig(): ValidationCheck[] {
  return [
    {
      name: "auth-config-valid",
      check: () => {
        const secret = process.env.NEXTAUTH_SECRET;
        return !!secret && secret.length >= 32;
      },
      severity: "critical",
      message: "NEXTAUTH_SECRET must exist and be >= 32 characters",
    },
    {
      name: "db-url-valid",
      check: () => {
        const url = process.env.DATABASE_URL;
        if (!url) return false;
        // Must contain protocol, host, and database name at minimum
        const hasProtocol = url.startsWith("postgresql://") || url.startsWith("postgres://");
        const hasHost = url.includes("@") && url.includes(".");
        const hasDb = url.replace(/^postgresql:\/\//, "").replace(/^postgres:\/\//, "").split("/").length >= 2;
        return hasProtocol && hasHost && hasDb;
      },
      severity: "critical",
      message: "DATABASE_URL must exist with protocol, host, and database name",
    },
  ];
}

/**
 * Runs a single check and returns its result.
 */
async function runCheck(c: ValidationCheck): Promise<{
  name: string;
  passed: boolean;
  severity: string;
  message: string;
}> {
  try {
    const result = await c.check();
    return { name: c.name, passed: result, severity: c.severity, message: c.message };
  } catch (err) {
    return {
      name: c.name,
      passed: false,
      severity: c.severity,
      message: `${c.message} (${err})`,
    };
  }
}

/**
 * Runs all regression checks and returns a summary of results.
 * Useful for CI/CD pipelines, admin dashboards, and pre-deployment validation.
 */
export async function runRegressionChecks(): Promise<{
  passed: number;
  failed: number;
  results: Array<{
    name: string;
    passed: boolean;
    severity: string;
    message: string;
  }>;
}> {
  const checks = validateCriticalPaths();
  const results = await Promise.all(checks.map(runCheck));
  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

// ============================================================================
// Comprehensive Regression Check
// ============================================================================

export interface ComprehensiveCheckResult {
  category: "modules" | "config" | "runtime";
  name: string;
  passed: boolean;
  severity: string;
  message: string;
  duration_ms?: number;
  details?: string;
}

export interface ComprehensiveReport {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "critical";
  modules: {
    passed: number;
    failed: number;
    total: number;
    results: ComprehensiveCheckResult[];
  };
  config: {
    passed: number;
    failed: number;
    total: number;
    results: ComprehensiveCheckResult[];
  };
  runtime: {
    passed: number;
    failed: number;
    total: number;
    results: ComprehensiveCheckResult[];
  };
  recommendations: string[];
}

/**
 * Runs the full suite of regression checks, categorized into:
 * 1. modules — importability checks for all critical modules
 * 2. config  — environment variable and configuration validation
 * 3. runtime — live tests like DB connectivity
 *
 * Returns a categorized report with actionable recommendations.
 */
export async function runComprehensiveRegressionChecks(): Promise<ComprehensiveReport> {
  const timestamp = new Date().toISOString();
  const recommendations: string[] = [];

  // ── 1. Module import checks ──
  const moduleChecks = validateCriticalPaths();
  const moduleResults = await Promise.all(
    moduleChecks.map(async (c) => {
      const start = Date.now();
      const result = await runCheck(c);
      return { ...result, category: "modules" as const, duration_ms: Date.now() - start };
    })
  );

  // ── 2. Config validation checks ──
  const configChecks = validateConfig();
  const configResults = await Promise.all(
    configChecks.map(async (c) => {
      const start = Date.now();
      const result = await runCheck(c);
      return { ...result, category: "config" as const, duration_ms: Date.now() - start };
    })
  );

  // ── 3. Runtime checks ──
  const runtimeResults: ComprehensiveCheckResult[] = [];

  // DB connectivity test
  {
    const start = Date.now();
    try {
      const dbReady = await ensureDb();
      if (dbReady) {
        await db.$queryRaw`SELECT 1 as ok`;
      }
      const latency = Date.now() - start;
      runtimeResults.push({
        category: "runtime",
        name: "db-connectivity",
        passed: dbReady,
        severity: "critical",
        message: "Database connectivity check",
        duration_ms: latency,
        details: dbReady ? `Connected in ${latency}ms` : "Database initialization failed",
      });
    } catch (err: any) {
      const latency = Date.now() - start;
      const errorDetail = isDbUnavailable(err)
        ? "Database unavailable"
        : err?.message?.substring(0, 200);
      runtimeResults.push({
        category: "runtime",
        name: "db-connectivity",
        passed: false,
        severity: "critical",
        message: "Database connectivity check",
        duration_ms: latency,
        details: errorDetail,
      });
      logger.error("[RegressionGuard] DB connectivity check failed", err);
    }
  }

  // Memory usage check
  {
    const mem = process.memoryUsage();
    const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const totalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const percentage = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    const memoryOk = percentage < 90;
    runtimeResults.push({
      category: "runtime",
      name: "memory-usage",
      passed: memoryOk,
      severity: memoryOk ? "info" : "warning",
      message: "Memory usage should be under 90% of heap",
      duration_ms: 0,
      details: `${usedMb}MB / ${totalMb}MB (${percentage}%)`,
    });
    if (!memoryOk) {
      recommendations.push("Memory usage is above 90%. Consider scaling or investigating memory leaks.");
    }
  }

  // ── Build the categorized report ──
  const modulePassed = moduleResults.filter((r) => r.passed).length;
  const moduleFailed = moduleResults.filter((r) => !r.passed).length;
  const configPassed = configResults.filter((r) => r.passed).length;
  const configFailed = configResults.filter((r) => !r.passed).length;
  const runtimePassed = runtimeResults.filter((r) => r.passed).length;
  const runtimeFailed = runtimeResults.filter((r) => !r.passed).length;

  // Generate recommendations for failures
  for (const r of moduleResults.filter((r) => !r.passed)) {
    if (r.severity === "critical") {
      recommendations.push(`CRITICAL: Module "${r.name}" is not importable. ${r.message}`);
    }
  }
  for (const r of configResults.filter((r) => !r.passed)) {
    recommendations.push(`CRITICAL: Config "${r.name}" validation failed. ${r.message}`);
  }
  for (const r of runtimeResults.filter((r) => !r.passed)) {
    if (r.severity === "critical") {
      recommendations.push(`CRITICAL: Runtime "${r.name}" failed. ${r.details || r.message}`);
    }
  }

  // Determine overall status
  const hasCriticalFailure =
    [...moduleResults, ...configResults, ...runtimeResults].some(
      (r) => !r.passed && r.severity === "critical"
    );
  const hasAnyFailure =
    [...moduleResults, ...configResults, ...runtimeResults].some((r) => !r.passed);

  const overall_status = hasCriticalFailure ? "critical" : hasAnyFailure ? "degraded" : "healthy";

  logger.info("[RegressionGuard] Comprehensive check completed", {
    overall_status,
    modules: { passed: modulePassed, failed: moduleFailed },
    config: { passed: configPassed, failed: configFailed },
    runtime: { passed: runtimePassed, failed: runtimeFailed },
  });

  return {
    timestamp,
    overall_status,
    modules: {
      passed: modulePassed,
      failed: moduleFailed,
      total: moduleResults.length,
      results: moduleResults,
    },
    config: {
      passed: configPassed,
      failed: configFailed,
      total: configResults.length,
      results: configResults,
    },
    runtime: {
      passed: runtimePassed,
      failed: runtimeFailed,
      total: runtimeResults.length,
      results: runtimeResults,
    },
    recommendations,
  };
}
