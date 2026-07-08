// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/messages — agent-to-agent message bus
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
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
      const messages = await Orchestrator.getMessages(authCtx.organizationId, { agentId, limit });
      return NextResponse.json({ messages });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/messages] GET error", msg);
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 60, windowSeconds: 60 },
);

// POST — send a message between agents (Owner can trigger manually)
export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const body = await req.json();
      const { fromAgentKey, toAgentKey, type, subject, payload, parentMessageId } = body;
      if (!fromAgentKey || !toAgentKey || !type || !subject) {
        return NextResponse.json(
          { error: "fromAgentKey, toAgentKey, type, and subject are required" },
          { status: 400 },
        );
      }
      const message = await Orchestrator.sendMessage(
        authCtx.organizationId,
        fromAgentKey,
        toAgentKey,
        { type, subject, payload: payload || {}, parentMessageId },
      );
      if (!message) {
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
      }
      return NextResponse.json({ message }, { status: 201 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/messages] POST error", msg);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 30, windowSeconds: 60 },
);
