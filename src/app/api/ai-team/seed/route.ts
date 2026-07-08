// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/seed — seed default agents + workflows for the org
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";
import { WorkflowEngine } from "@/lib/ai-team/workflow-engine";

export const runtime = "nodejs";

export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }

      const agentResult = await Orchestrator.seedOrg(authCtx.organizationId);
      const workflowResult = await WorkflowEngine.seedWorkflows(authCtx.organizationId);

      logger.info("[/api/ai-team/seed] Seeded AI Team for org", {
        organizationId: authCtx.organizationId,
        agents: agentResult,
        workflows: workflowResult,
      });

      return NextResponse.json({
        agents: agentResult,
        workflows: workflowResult,
        message: `AI Team ready: ${agentResult.created} agents + ${workflowResult.created} workflows created`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/seed] POST error", msg);
      return NextResponse.json({ error: "Failed to seed AI Team" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 5, windowSeconds: 60 },
);
