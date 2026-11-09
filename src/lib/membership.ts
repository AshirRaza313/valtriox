// ============================================================================
// Fresh Membership Check -- Destructive Mutation Boundary
// ============================================================================
// S1 remediation: cached session role/organizationId is NOT authoritative
// for destructive mutations. This helper performs a fresh OrganizationMember
// lookup to detect removed / demoted / org-changed / penalized members.
//
// Returns null for all denial cases (no info leak distinction).
// Returns { isPlatformBypass: true } only for platform roles without org --
// handler decides policy (S1 policy: reject platform bypass for mutations).
// ============================================================================

import { db, withRetry } from "@/lib/db";
import { isPlatformRole, type AuthContext } from "@/lib/auth-middleware";

export interface FreshMembership {
  /** FRESH role from OrganizationMember.role -- never the cached session role */
  role: string;
  /** Org ID confirmed present in session AND required for mutation */
  organizationId: string;
  /** True if user is platform-role WITHOUT org -- handler must reject */
  isPlatformBypass: boolean;
}

/**
 * Fresh DB-backed membership check for destructive mutation boundaries.
 *
 * Detects:
 *   - Removed members (OrganizationMember row deleted)
 *   - Demoted members (role changed in DB)
 *   - Org-changed members (session orgId no longer matches DB)
 *   - Penalized members (penaltyUntil in future)
 *
 * Returns:
 *   - null                        -> deny (handler responds 403)
 *   - { isPlatformBypass: true }  -> platform role without org; reject
 *   - { role, orgId, isPlatformBypass: false } -> valid fresh membership
 */
export async function getFreshMembership(
  authCtx: AuthContext,
): Promise<FreshMembership | null> {
  // No org in session
  if (!authCtx.organizationId) {
    if (isPlatformRole(authCtx.role)) {
      return {
        role: authCtx.role,
        organizationId: "",
        isPlatformBypass: true,
      };
    }
    return null;
  }

  // Fresh DB-backed lookup by composite unique key
  const member = await withRetry(
    () =>
      db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: authCtx.organizationId!,
            userId: authCtx.userId,
          },
        },
        select: { role: true, penaltyUntil: true },
      }),
    2,
    500,
  );

  if (!member) return null; // removed or org-changed user
  if (member.penaltyUntil && member.penaltyUntil > new Date()) return null; // penalized

  return {
    role: member.role, // FRESH role -- session role ignored
    organizationId: authCtx.organizationId!,
    isPlatformBypass: false,
  };
}