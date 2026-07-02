import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import { runRegressionChecks } from "@/lib/regression-guard";
import logger from "@/lib/logger";

/**
 * GET /api/admin/regression-check
 *
 * Platform-admin only route that runs regression checks against critical
 * system paths and returns a detailed report of all validation results.
 */
export const GET = withRateLimit(withAuth(async (req: NextRequest, _authCtx) => {
  try {
    const results = await runRegressionChecks();

    logger.info("[RegressionCheck] Checks completed", {
      passed: results.passed,
      failed: results.failed,
      userId: _authCtx.userId,
    });

    const hasCriticalFailure = results.results.some(
      (r) => !r.passed && r.severity === "critical"
    );

    return NextResponse.json(
      {
        status: hasCriticalFailure ? "failures_detected" : "all_passed",
        ...results,
      },
      {
        status: hasCriticalFailure ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: unknown) {
    logger.error("[RegressionCheck] Unexpected error", error);
    return NextResponse.json(
      { error: "Regression check failed unexpectedly" },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
