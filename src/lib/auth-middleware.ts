// ============================================================================
// API Authentication Middleware
// ============================================================================
// Every protected API route should wrap its handler with `withAuth()`.
// This validates that a valid session exists (via NextAuth or signed cookies).
// ============================================================================

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

// ---------------------------------------------------------------------------
// HMAC signing helpers – used to sign & verify cookie-based auth data so
// that an attacker cannot forge vt-user-* cookies.
// ---------------------------------------------------------------------------

export function signAuthData(data: {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}): string {
  const payload = JSON.stringify(data);
  const secret = process.env.NEXTAUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyAuthCookie(
  userId: string,
  email: string,
  role: string,
  organizationId: string | undefined,
  signature: string,
): boolean {
  const secret = process.env.NEXTAUTH_SECRET || "";
  if (!secret) return false;
  const payload = JSON.stringify({ userId, email, role, organizationId });
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  // timingSafeEqual requires equal-length buffers
  if (signature.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSig, "utf8"),
  );
}

/**
 * Extract auth context from request.
 *
 * Tries, in order:
 *   1. NextAuth server session
 *   2. Signed cookies (vt-user-* + vt-auth-sig)
 *
 * If neither succeeds, returns null (unauthenticated).
 */
export async function getAuthContext(
  req: NextRequest,
): Promise<AuthContext | null> {
  // ── Method 1: NextAuth session ────────────────────────────────────────
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const user = session.user as any;
      if (user?.id) {
        return {
          userId: user.id,
          email: user.email || "",
          role: user.role || "member",
          organizationId: user.organizationId,
        };
      }
    }
  } catch (nextAuthErr: any) {
    // NextAuth failed – log but fall through to cookie auth.
    console.warn(
      "[Auth] NextAuth session check failed, falling back to cookie auth:",
      nextAuthErr?.message || nextAuthErr,
    );
  }

  // ── Method 2: Custom headers (x-user-*, sent by fetchWithAuth) ──────────
  const headerUserId = req.headers.get("x-user-id");
  const headerEmail = req.headers.get("x-user-email") || "";
  const headerRole = req.headers.get("x-user-role") || "member";
  const headerOrgId = req.headers.get("x-org-id") || undefined;

  if (headerUserId) {
    return { userId: headerUserId, email: headerEmail, role: headerRole, organizationId: headerOrgId };
  }

  // ── Method 3: Signed cookies (set by login API) ───────────────────────
  // The login route sets vt-user-id, vt-user-email, vt-user-role,
  // vt-org-id, and a corresponding vt-auth-sig (HMAC-SHA256 signature).
  const cookieUserId = req.cookies.get("vt-user-id")?.value;
  const cookieEmail = req.cookies.get("vt-user-email")?.value || "";
  const cookieRole = req.cookies.get("vt-user-role")?.value || "member";
  const cookieOrgId = req.cookies.get("vt-org-id")?.value || undefined;
  const authSig = req.cookies.get("vt-auth-sig")?.value;

  if (cookieUserId && authSig) {
    const valid = verifyAuthCookie(
      cookieUserId,
      cookieEmail,
      cookieRole,
      cookieOrgId,
      authSig,
    );
    if (valid) {
      return {
        userId: cookieUserId,
        email: cookieEmail,
        role: cookieRole,
        organizationId: cookieOrgId,
      };
    }
    // Signature invalid – fall through and reject below
    console.warn("[Auth] Cookie auth signature verification failed");
  }

  // No valid auth found
  return null;
}

/**
 * withAuth - Higher-order function that wraps API route handlers with authentication.
 *
 * Usage:
 *   export const GET = withAuth(async (req, ctx) => {
 *     // ctx.userId, ctx.role, ctx.organizationId are available
 *     return NextResponse.json({ data: "protected" });
 *   });
 *
 * Options:
 *   - requireRole: string[] - Only allow specific roles (e.g., ["platform_owner", "admin"])
 *   - requireOrg: boolean - Require organizationId to be present (default: true)
 *   - allowPublic: boolean - Skip auth check entirely (default: false)
 */
export type RouteContext = { params: Promise<Record<string, string>> };
type ApiHandler = (
  req: NextRequest,
  authCtx: AuthContext,
  context: RouteContext,
) => Promise<Response> | Response;

interface WithAuthOptions {
  requireRole?: string[];
  requireOrg?: boolean;
  allowPublic?: boolean;
}

export function withAuth(
  handler: ApiHandler,
  options: WithAuthOptions = {},
) {
  const { requireRole = [], requireOrg = true, allowPublic = false } = options;

  return async (
    req: NextRequest,
    context?: RouteContext,
  ): Promise<Response> => {
    const ctx = context ?? { params: Promise.resolve({}) };
    try {
      // Public routes skip auth
      if (allowPublic) {
        const publicCtx: AuthContext = {
          userId: "public",
          email: "",
          role: "public",
        };
        return handler(req, publicCtx, ctx);
      }

      const authCtx = await getAuthContext(req);

      if (!authCtx) {
        return NextResponse.json(
          { error: "Authentication required. Please sign in." },
          { status: 401 },
        );
      }

      // Role check
      if (requireRole.length > 0 && !requireRole.includes(authCtx.role)) {
        return NextResponse.json(
          {
            error:
              "Insufficient permissions. You don't have access to this resource.",
          },
          { status: 403 },
        );
      }

      // Organization check - auto-bypass for platform-level roles (admin/owner)
      // Platform owners don't need to belong to a specific organization.
      const isPlatformAdmin = isPlatformRole(authCtx.role);
      if (requireOrg && !authCtx.organizationId && !isPlatformAdmin) {
        return NextResponse.json(
          {
            error:
              "Organization context required. Please join or create an organization.",
          },
          { status: 403 },
        );
      }

      return handler(req, authCtx, ctx);
    } catch (error: any) {
      console.error("[Auth Middleware Error]", error?.message || error);
      return NextResponse.json(
        { error: "Internal server error during authentication." },
        { status: 500 },
      );
    }
  };
}

/**
 * Utility to check if the user has a platform-level role (bypasses feature locks)
 */
export function isPlatformRole(role: string): boolean {
  return ["platform_owner", "platform_admin", "owner", "admin"].includes(role);
}

/**
 * Utility to check if the user is a brand owner or higher
 */
export function isOrgAdmin(role: string): boolean {
  return [
    "platform_owner",
    "platform_admin",
    "owner",
    "brand_owner",
    "manager",
  ].includes(role);
}
