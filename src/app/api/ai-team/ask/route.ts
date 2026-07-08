// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/ask — "Ask My AI Team" command box for the Owner
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";

export const runtime = "nodejs";

export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }

      const body = await req.json();
      const { query, targetAgentKey, context } = body;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return NextResponse.json({ error: "query is required" }, { status: 400 });
      }

      if (query.length > 2000) {
        return NextResponse.json(
          { error: "query is too long (max 2000 characters)" },
          { status: 400 },
        );
      }

      const response = await Orchestrator.ask(
        authCtx.organizationId,
        { query: query.trim(), targetAgentKey, context },
        authCtx.userId,
      );

      return NextResponse.json({ response });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/ask] POST error", msg);
      return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 20, windowSeconds: 60 },
);
