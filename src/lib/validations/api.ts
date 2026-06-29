// ============================================================================
// API Validation Middleware & Standardized Responses
// ============================================================================
// Phase 3: Combines Zod schema validation + sanitization into a single
// withValidatedBody() HOF that replaces raw req.json() across all routes.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { sanitizeObject } from "@/lib/sanitize";

// ── Standardized API response helpers ────────────────────────────────────────

/**
 * Return a 422 Validation Error with field-level details.
 * Use this when Zod validation fails.
 */
export function validationError(zodError: ZodError): NextResponse {
  const errors = zodError.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
  return NextResponse.json(
    {
      error: "Validation failed",
      errors,
    },
    { status: 422 }
  );
}

/**
 * Return a standard error response with consistent shape.
 */
export function apiError(
  message: string,
  status: number = 400,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...extra,
    },
    { status }
  );
}

/**
 * Return a standard success response with consistent shape.
 */
export function apiSuccess(
  data: Record<string, unknown>,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Return a not-found response.
 */
export function notFound(resource: string = "Resource"): NextResponse {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

/**
 * Return a forbidden response.
 */
export function forbidden(message: string = "Access denied"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Return an unauthorized response.
 */
export function unauthorized(message: string = "Authentication required"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

// ── withValidatedBody ────────────────────────────────────────────────────────

type ValidatedHandler<T> = (
  req: NextRequest,
  body: T,
  context?: unknown,
) => Promise<Response> | Response;

interface ValidatedBodyOptions {
  /** Maximum body size in bytes (default: 1MB) */
  maxBodySize?: number;
  /** Whether to sanitize string values before validation (default: true) */
  sanitize?: boolean;
}

/**
 * withValidatedBody - HOF that validates request body against a Zod schema.
 *
 * Combines:
 *   1. Content-length check (prevent oversized payloads)
 *   2. JSON parsing (catches malformed JSON)
 *   3. Sanitization via sanitizeObject() (strips XSS/HTML)
 *   4. Zod schema validation (type safety + business rules)
 *
 * Usage:
 *   import { createOrderSchema } from "@/lib/validations/schemas";
 *   import { withValidatedBody } from "@/lib/validations/api";
 *
 *   export const POST = withAuth(async (req, authCtx) => {
 *     // Validate body first
 *     const result = await validateBody(req, createOrderSchema);
 *     if (!result.success) return result.response;
 *     const body = result.data; // Fully typed!
 *
 *     // ... use body.items, body.customerId, etc.
 *   });
 *
 * OR use the full HOF pattern:
 *   export const POST = withAuth(withValidatedBody(createOrderSchema, async (req, body, authCtx) => {
 *     // body is fully typed as CreateOrderInput
 *   }));
 */
export function withValidatedBody<T>(
  schema: ZodSchema<T>,
  handler: ValidatedHandler<T>,
  options: ValidatedBodyOptions = {}
): (req: NextRequest, context?: unknown) => Promise<Response> {
  const { maxBodySize = 1024 * 1024, sanitize = true } = options;

  return async (req: NextRequest, context?: unknown): Promise<Response> => {
    // Step 1: Check content-length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > maxBodySize) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }

    // Step 2: Parse JSON
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Step 3: Sanitize (strip XSS, HTML, etc.)
    let sanitizedBody = rawBody;
    if (sanitize && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
      sanitizedBody = sanitizeObject(rawBody as Record<string, unknown>);
    }

    // Step 4: Validate against Zod schema
    const result = schema.safeParse(sanitizedBody);
    if (!result.success) {
      return validationError(result.error);
    }

    // Step 5: Call handler with validated + typed data
    return handler(req, result.data, context);
  };
}

/**
 * validateBody - Standalone validation function (not HOF).
 * Use inside withAuth() handlers when you need both auth context AND validated body.
 *
 * Usage:
 *   export const POST = withAuth(async (req, authCtx) => {
 *     const result = await validateBody(req, createOrderSchema);
 *     if (!result.success) return result.response;
 *     const body = result.data;
 *     // ... business logic with authCtx + body
 *   });
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
  options: ValidatedBodyOptions = {}
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse }
> {
  const { maxBodySize = 1024 * 1024, sanitize = true } = options;

  // Step 1: Check content-length
  const contentLength = parseInt(req.headers.get("content-length") || "0");
  if (contentLength > maxBodySize) {
    return {
      success: false,
      response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    };
  }

  // Step 2: Parse JSON
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  // Step 3: Sanitize
  let sanitizedBody = rawBody;
  if (sanitize && rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
    sanitizedBody = sanitizeObject(rawBody as Record<string, unknown>);
  }

  // Step 4: Validate against Zod schema
  const result = schema.safeParse(sanitizedBody);
  if (!result.success) {
    return {
      success: false,
      response: validationError(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * validateQuery - Validate URL search params against a Zod schema.
 *
 * Usage:
 *   export const GET = withAuth(async (req, authCtx) => {
 *     const result = validateQuery(req, paginationQuerySchema);
 *     if (!result.success) return result.response;
 *     const { page, limit, search } = result.data;
 *   });
 */
export function validateQuery<T>(
  req: NextRequest,
  schema: ZodSchema<T>
):
  | { success: true; data: T }
  | { success: false; response: NextResponse }
{
  const { searchParams } = new URL(req.url);
  const queryObj: Record<string, string | string[] | undefined> = {};

  // Convert searchParams to plain object (handle arrays)
  for (const [key, value] of searchParams.entries()) {
    const existing = queryObj[key];
    if (existing) {
      queryObj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      queryObj[key] = value;
    }
  }

  const result = schema.safeParse(queryObj);
  if (!result.success) {
    return {
      success: false,
      response: validationError(result.error),
    };
  }

  return { success: true, data: result.data };
}
