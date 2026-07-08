// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/memory — knowledge store CRUD
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
      const agentKey = searchParams.get("agentKey") as any;
      const query = searchParams.get("q") || undefined;
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;

      const memories = await Orchestrator.retrieveMemory(
        authCtx.organizationId,
        agentKey || "ceo",
        query,
        limit,
      );
      return NextResponse.json({ memories });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/memory] GET error", msg);
      return NextResponse.json({ error: "Failed to load memory" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 60, windowSeconds: 60 },
);

// POST — store a new memory entry
export const POST = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      if (!authCtx.organizationId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }
      const body = await req.json();
      const { agentKey, type, title, content, tags, metadata, importance, expiresAt } = body;

      if (!type || !title || !content) {
        return NextResponse.json(
          { error: "type, title, and content are required" },
          { status: 400 },
        );
      }

      const memory = await Orchestrator.storeMemory(authCtx.organizationId, {
        agentKey,
        type,
        title,
        content,
        tags: tags || [],
        metadata: metadata || {},
        importance: importance ?? 50,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (!memory) {
        return NextResponse.json({ error: "Failed to store memory" }, { status: 500 });
      }
      return NextResponse.json({ memory }, { status: 201 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/memory] POST error", msg);
      return NextResponse.json({ error: "Failed to store memory" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 30, windowSeconds: 60 },
);
