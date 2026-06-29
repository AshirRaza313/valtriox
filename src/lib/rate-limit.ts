// ============================================================================
// Rate Limiting Middleware
// ============================================================================
// Phase 4: Production-grade rate limiting using Upstash Redis.
// Falls back to in-memory for local development when Redis is not configured.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

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

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes (dev only)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

function memoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
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

  // In-memory fallback
  return memoryRateLimit(key, maxRequests, windowSeconds);
}

// ── withRateLimit HOF ────────────────────────────────────────────────────────

type Handler = (req: NextRequest) => Promise<Response> | Response;

/**
 * withRateLimit - Higher-order function wrapper for rate limiting API routes.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, { maxRequests: 5, windowSeconds: 60 });
 */
export function withRateLimit(
  handler: Handler,
  options: RateLimitOptions = {}
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
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

    const response = await handler(req);
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

  // Fallback: use User-Agent hash so same client gets rate limited consistently
  const ua = req.headers.get("user-agent") || "unknown";
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    const char = ua.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ua-${Math.abs(hash)}`;
}

export { getClientIp };
