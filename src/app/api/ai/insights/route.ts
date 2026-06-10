import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// /api/ai/insights - AI Insights Fallback Endpoint
// ============================================================================
// Returns a placeholder response with empty insights and a fallback flag.
// The AIInsightsWidget already has graceful fallback logic that generates
// contextual insights from dashboard stats when this endpoint returns no data.
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    // Return fallback response - AI insights are not yet implemented.
    // The frontend widget will use contextual insights from dashboard stats.
    return NextResponse.json({
      insights: [],
      fallback: true,
      message: "AI insights are coming soon. Showing contextual recommendations based on your dashboard data.",
    });
  } catch (error) {
    console.error("[/api/ai/insights] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
