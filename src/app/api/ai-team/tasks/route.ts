// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/tasks — list + execute tasks
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";

export const runtime = "nodejs";

export const GET = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const { searchParams } = new URL(req.url);
      const agentId = searchParams.get("agentId") || undefined;
      const status = searchParams.get("status") || undefined;
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

      const tasks = await Orchestrator.getTasks(authCtx.organizationId, { agentId, status, limit });
      return NextResponse.json({ tasks });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/tasks] GET error", msg);
      return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 60, windowSeconds: 60 },
);
