import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ============================================================================
// /api/ai/insights - AI Insights Fallback Endpoint
// ============================================================================
// Phase 7: Added withAuth + withRateLimit + orgId verification.
// Previously completely unauthenticated — anyone could query by orgId.
// ============================================================================

export const GET = withRateLimit(withAuth(async (request: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    // Phase 7: Verify the caller has access to this organization
    if (orgId !== authCtx.organizationId) {
      logger.warn("[AI Insights] orgId mismatch", { userId: authCtx.userId, requestedOrgId: orgId });
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Return fallback response - AI insights are not yet implemented.
    // The frontend widget will use contextual insights from dashboard stats.
    return NextResponse.json({
      insights: [],
      fallback: true,
      message: "AI insights are coming soon. Showing contextual recommendations based on your dashboard data.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[/api/ai/insights] Error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}), { maxRequests: 30, windowSeconds: 60 });
