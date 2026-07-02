import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import { runComprehensiveRegressionChecks } from "@/lib/regression-guard";
import logger from "@/lib/logger";

/**
 * GET /api/admin/regression-check/comprehensive
 *
 * Platform-admin only route that runs the full comprehensive regression check suite.
 * Tests module imports, configuration validity, DB connectivity, and memory usage.
 * Returns categorized results with actionable recommendations.
 */
export const GET = withRateLimit(withAuth(async (_req: NextRequest, _authCtx) => {
  try {
    const report = await runComprehensiveRegressionChecks();

    logger.info("[RegressionCheck:Comprehensive] Full suite completed", {
      userId: _authCtx.userId,
      overall_status: report.overall_status,
      modules: { passed: report.modules.passed, failed: report.modules.failed },
      config: { passed: report.config.passed, failed: report.config.failed },
      runtime: { passed: report.runtime.passed, failed: report.runtime.failed },
    });

    const statusCode = report.overall_status === "critical"
      ? 503
      : report.overall_status === "degraded"
        ? 200
        : 200;

    return NextResponse.json(
      {
        status: report.overall_status,
        ...report,
      },
      {
        status: statusCode,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: unknown) {
    logger.error("[RegressionCheck:Comprehensive] Unexpected error", error);
    return NextResponse.json(
      { error: "Comprehensive regression check failed unexpectedly" },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
