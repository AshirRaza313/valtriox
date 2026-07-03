// ============================================================================
// Rate Limiting Middleware
// ============================================================================
// Phase 4: Production-grade rate limiting using Upstash Redis.
// Falls back to in-memory for local development when Redis is not configured.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

export interface RateLimitOptions {
  /** Maximum number of requests in the window */
  maxRequests?: number;
  /** Time window in seconds */
  windowSeconds?: number;
  /** Custom identifier (defaults to IP) */
  identifier?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// ── Upstash Redis Rate Limiter (production) ──────────────────────────────────

let _ratelimit: import("@upstash/ratelimit").Ratelimit | null = null;

async function getUpstashRatelimit(
  maxRequests: number,
  windowSeconds: number
): Promise<import("@upstash/ratelimit").Ratelimit | null> {
  if (_ratelimit) return _ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({ url, token });
    _ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: "valtriox-rl",
    });
    return _ratelimit;
  } catch {
    // Upstash not available — fall back to in-memory
    console.warn("[RateLimit] Upstash Redis not available, using in-memory fallback");
    return null;
  }
}

// ── In-Memory Fallback (development) ─────────────────────────────────────────
// Phase 6: Added per-request global rate limiting for serverless without Redis.
// Each serverless function invocation gets a fresh in-memory store, so we use
// a "global singleton" pattern via globalThis to persist across warm invocations.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Use globalThis to persist across warm serverless invocations
const globalForRateLimit = globalThis as unknown as {
  __valtrioxMemoryStore?: Map<string, RateLimitEntry>;
  __valtrioxCleanupCounter?: number;
};

const memoryStore = globalForRateLimit.__valtrioxMemoryStore || new Map<string, RateLimitEntry>();
globalForRateLimit.__valtrioxMemoryStore = memoryStore;

let cleanupCounter = globalForRateLimit.__valtrioxCleanupCounter || 0;

// Phase 5: Removed setInterval — unreliable in serverless.
// Instead, we do lazy TTL cleanup on each memoryRateLimit call.
const CLEANUP_THRESHOLD = 1000; // Clean up every N checks

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
}

function memoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  // Lazy cleanup: run every CLEANUP_THRESHOLD checks
  cleanupCounter++;
  if (cleanupCounter >= CLEANUP_THRESHOLD) {
    cleanupCounter = 0;
    cleanupMemoryStore();
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, newEntry);
    return { success: true, remaining: maxRequests - 1, resetAt: newEntry.resetAt, limit: maxRequests };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt, limit: maxRequests };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt, limit: maxRequests };
}

// ── Main Rate Limit Function ─────────────────────────────────────────────────

/**
 * Check if a request is within rate limits.
 * Uses Upstash Redis in production, in-memory fallback in development.
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const { maxRequests = 10, windowSeconds = 60, identifier } = options;
  const key = identifier || getClientIp(req);

  // Try Upstash Redis first
  const ratelimit = await getUpstashRatelimit(maxRequests, windowSeconds);
  if (ratelimit) {
    try {
      const result = await ratelimit.limit(key);
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
        limit: result.limit,
      };
    } catch {
      // Redis error — fall back to in-memory
      console.warn("[RateLimit] Upstash Redis error, using in-memory fallback");
    }
  }

  // In-memory fallback — warn loudly in production
  if (process.env.NODE_ENV === 'production') {
    logger.error("[RateLimit] WARNING: Using in-memory fallback in production! Rate limiting will NOT work across serverless instances. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }
  return memoryRateLimit(key, maxRequests, windowSeconds);
}

// ── withRateLimit HOF ────────────────────────────────────────────────────────

// Phase 13 FIX: Handler must accept optional `context` so that dynamic route
// params (e.g. /api/admin/invoices/[id]/pdf) propagate through to withAuth.
//
// BUG: Previously `withRateLimit` declared `Handler = (req) => ...` and called
// `handler(req)` — dropping the second `context` argument Next.js 16 passes to
// route handlers. Inside `withAuth`, `context` then became `undefined`, falling
// back to `{ params: Promise.resolve({}) }`, which made every `await ctx.params`
// return `{}` and every `params.id` resolve to `undefined`. The result: every
// dynamic route wrapped with `withRateLimit(withAuth(...))` failed at the
// Prisma `findUnique({ where: { id: undefined } })` call, surfacing as 503.
//
// FIX: Type the handler to accept `(req, context?)` and forward `context`
// when invoking the wrapped handler. This restores params flow for all
// 124 routes that use the `withRateLimit(withAuth(...))` pattern.
type RouteContextLike = { params: Promise<Record<string, string>> };
type Handler = (
  req: NextRequest,
  context?: RouteContextLike,
) => Promise<Response> | Response;

/**
 * withRateLimit - Higher-order function wrapper for rate limiting API routes.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, { maxRequests: 5, windowSeconds: 60 });
 *
 * Phase 13: Forwards the optional `context` argument (dynamic route params)
 * to the wrapped handler so routes like `/api/foo/[id]` keep working.
 */
export function withRateLimit(
  handler: Handler,
  options: RateLimitOptions = {}
): (req: NextRequest, context?: RouteContextLike) => Promise<Response> {
  return async (req: NextRequest, context?: RouteContextLike): Promise<Response> => {
    const result = await rateLimit(req, options);
    if (!result.success) {
      const response = NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      return response;
    }

    // Forward BOTH `req` and `context` to the wrapped handler.
    const response = await handler(req, context);
    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
      response.headers.set("X-RateLimit-Limit", String(result.limit));
    }
    return response;
  };
}

// ── Client IP Detection ──────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Phase 6: Removed User-Agent hash fallback — it was trivially bypassed by
  // rotating User-Agent headers. If no IP header is available, use a fixed
  // identifier so rate limiting still works (but logs a warning).
  console.warn("[RateLimit] No IP header found — rate limiting uses anonymous identifier. Configure your proxy to forward X-Forwarded-For.");
  return "anonymous-no-ip";
}

export { getClientIp };
