// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/workflows — list workflows + start executions
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { WorkflowEngine } from "@/lib/ai-team/workflow-engine";

export const runtime = "nodejs";

export const GET = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const [workflows, executions] = await Promise.all([
        WorkflowEngine.getWorkflows(authCtx.organizationId),
        WorkflowEngine.getExecutions(authCtx.organizationId, 20),
      ]);
      return NextResponse.json({ workflows, executions });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/workflows] GET error", msg);
      return NextResponse.json({ error: "Failed to load workflows" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 60, windowSeconds: 60 },
);

// POST — start a workflow execution
export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const body = await req.json();
      const { workflowKey, input } = body;

      if (!workflowKey) {
        return NextResponse.json({ error: "workflowKey is required" }, { status: 400 });
      }

      const execution = await WorkflowEngine.startExecution(
        authCtx.organizationId,
        workflowKey,
        input || {},
        authCtx.userId,
      );

      if (!execution) {
        return NextResponse.json(
          { error: "Workflow not found or disabled" },
          { status: 404 },
        );
      }
      return NextResponse.json({ execution }, { status: 201 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/workflows] POST error", msg);
      return NextResponse.json({ error: "Failed to start workflow" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 20, windowSeconds: 60 },
);
