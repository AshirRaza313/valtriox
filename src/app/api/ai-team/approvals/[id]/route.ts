// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/approvals/[id] — Owner approves or denies a request
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
      const { decision, reviewerNote } = body;

      if (decision !== "approved" && decision !== "denied") {
        return NextResponse.json(
          { error: "decision must be 'approved' or 'denied'" },
          { status: 400 },
        );
      }

      const approval = await Orchestrator.reviewApproval(
        authCtx.organizationId,
        id,
        decision,
        authCtx.userId,
        reviewerNote,
      );

      if (!approval) {
        return NextResponse.json(
          { error: "Approval not found, already reviewed, or expired" },
          { status: 404 },
        );
      }

      return NextResponse.json({ approval });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/approvals/[id]] PATCH error", msg);
      return NextResponse.json({ error: "Failed to review approval" }, { status: 500 });
    }
  }, { requireOrg: true }),
  { maxRequests: 30, windowSeconds: 60 },
);
