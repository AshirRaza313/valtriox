// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/agents — CRUD for AI agents
// ============================================================================
// GET    /api/ai-team/agents           — list all agents for the org
// POST   /api/ai-team/agents           — create a manual task for an agent
// PATCH  /api/ai-team/agents           — bulk update (e.g., start/stop all)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { Orchestrator } from "@/lib/ai-team/orchestrator";

export const runtime = "nodejs";

// GET — list all agents for the org (with live stats)
export const GET = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const agents = await Orchestrator.getAgents(authCtx.organizationId);
      return NextResponse.json({ agents });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/agents] GET error", msg);
      return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 60, windowSeconds: 60 },
);

// POST — create a manual task for an agent
export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }

      const body = await req.json();
      const { agentKey, title, description, input, priority, impactScore, deadlineAt } = body;

      if (!agentKey || !title) {
        return NextResponse.json({ error: "agentKey and title are required" }, { status: 400 });
      }

      const task = await Orchestrator.createTask(
        authCtx.organizationId,
        agentKey,
        {
          title,
          description: description || "",
          input: input || {},
          priority: priority || "normal",
          impactScore: impactScore ?? 50,
          source: "manual",
          deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
        },
        authCtx.userId,
      );

      if (!task) {
        return NextResponse.json(
          { error: "Agent not found or is paused. Activate the agent first." },
          { status: 404 },
        );
      }

      return NextResponse.json({ task }, { status: 201 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/agents] POST error", msg);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 30, windowSeconds: 60 },
);
