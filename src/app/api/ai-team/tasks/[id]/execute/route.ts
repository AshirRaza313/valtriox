// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/tasks/[id]/execute — run an agent on a task
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth, type RouteContext } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";

export const runtime = "nodejs";

export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx, context: RouteContext) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const { id } = await context.params;
      const task = await Orchestrator.executeTask(authCtx.organizationId, id);
      if (!task) {
        return NextResponse.json(
          { error: "Task not found, agent is paused, or execution failed" },
          { status: 404 },
        );
      }
      return NextResponse.json({ task });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/tasks/[id]/execute] POST error", msg);
      return NextResponse.json({ error: "Failed to execute task" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 20, windowSeconds: 60 },
);
