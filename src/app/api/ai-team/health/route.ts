// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// /api/ai-team/health — LLM provider health check
// ============================================================================
// Tests if the LLM provider ACTUALLY works (not just if the env var is set).
// Runs a real generate() call and returns diagnostics. Used by the dashboard
// to show the Owner exactly why Gemini/Z.ai might be failing.
//
// Returns:
//   {
//     configured: boolean,
//     providerName: "gemini" | "zai" | "stub",
//     model?: string,
//     apiKeyPresent: boolean,
//     apiKeyPrefix?: string,   // first 4 chars only (safe to display)
//     actualCallSucceeded: boolean,
//     errorMessage?: string,
//     latencyMs?: number,
//     responseSample?: string,
//   }
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { checkLLMHealth } from "@/lib/ai-team/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Never cache — always run the test

export const GET = withRateLimit(
  withAuth(async (req: NextRequest, authCtx) => {
    try {
      const health = await checkLLMHealth();
      logger.info("[/api/ai-team/health] LLM health check", {
        provider: health.providerName,
        succeeded: health.actualCallSucceeded,
        error: health.errorMessage,
      });
      return NextResponse.json(health);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[/api/ai-team/health] GET error", msg);
      return NextResponse.json(
        { configured: false, providerName: "stub", actualCallSucceeded: false, errorMessage: msg },
        { status: 500 }
      );
    }
  }, { requireOrg: false }), // Don't require org — health check works at platform level
  { maxRequests: 10, windowSeconds: 60 },
);
