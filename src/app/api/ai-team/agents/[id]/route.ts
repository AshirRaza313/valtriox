// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/agents/[id] — update a single agent
// ============================================================================
// PATCH — start/stop, change goals, set spending limits, approval actions
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth, type RouteContext } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";

export const runtime = "nodejs";

export const PATCH = withRateLimit(
  withAuth(async (req: NextRequest, authCtx, context: RouteContext) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }

      const { id } = await context.params;
      const body = await req.json();
      const { status, goals, spendingLimits, approvalRequiredActions, config } = body;

      const updates: any = {};
      if (status) updates.status = status;
      if (goals !== undefined) updates.goals = goals;
      if (spendingLimits) updates.spendingLimits = spendingLimits;
      if (approvalRequiredActions) updates.approvalRequiredActions = approvalRequiredActions;
      if (config) updates.config = config;

      const agent = await Orchestrator.updateAgent(
        authCtx.organizationId,
        id,
        updates,
        authCtx.userId,
      );

      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      return NextResponse.json({ agent });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/agents/[id]] PATCH error", msg);
      return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 30, windowSeconds: 60 },
);
