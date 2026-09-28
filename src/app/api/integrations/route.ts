import { NextRequest, NextResponse } from "next/server";
import { db, withRetry, isDbUnavailable, dbErrorResponse } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import { createIntegrationSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";
import { getFreshMembership } from "@/lib/membership";
import { INTEGRATIONS_DELETE_ROLES } from "@/lib/roles";

// GET /api/integrations?orgId=... — List all integration connections for the org
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const connections = await withRetry(() =>
      db.integrationConnection.findMany({
        where: { organizationId: orgId },
        orderBy: { updatedAt: "desc" },
      take: 100,
    })
  , 2, 500);

    return NextResponse.json({ connections });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Integrations GET] Error:", message);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ connections: [] });
  }
}, { requireOrg: true }), { maxRequests: 60, windowSeconds: 60 });

// POST /api/integrations — Create or update (upsert) an integration connection
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    // Phase 6: Zod validation
    const parseResult = createIntegrationSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const { type, provider, name, config, metadata } = body;
    const orgId = authCtx.organizationId!;

    if (!type || !provider || !name) {
      return NextResponse.json({ error: "type, provider, and name are required" }, { status: 400 });
    }

    const connection = await withRetry(() =>
      db.integrationConnection.upsert({
        where: { organizationId_type: { organizationId: orgId, type } },
        create: {
          organizationId: orgId,
          type,
          provider,
          name,
          config: config ? JSON.stringify(config) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          status: "connected",
          connectedAt: new Date(),
          lastSyncedAt: new Date(),
        },
        update: {
          name,
          config: config ? JSON.stringify(config) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          status: "connected",
          connectedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      })
    , 2, 500);

    return NextResponse.json({ connection });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Integrations POST] Error:", message);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ error: "Failed to save integration" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });

// DELETE /api/integrations?id=... -- Disconnect an integration
export const DELETE = withRateLimit(
  withAuth(
    async (req: NextRequest, authCtx) => {
      try {
        // Step 1: Fresh DB-backed membership check (S1-1)
        // Cached session role/orgId is NOT authoritative for mutations.
        const membership = await getFreshMembership(authCtx);
        if (!membership) {
          // Removed / demoted / org-changed / penalized / no-org non-platform
          // Same message for all -> no info leak distinction.
          return NextResponse.json(
            { error: "Organization context required" },
            { status: 403 },
          );
        }

        // Step 2: Platform role without org -> explicit reject (D2)
        if (membership.isPlatformBypass) {
          return NextResponse.json(
            { error: "Platform role requires organization context for this mutation" },
            { status: 403 },
          );
        }

        // Step 3: Fresh DB role must be in destructive-mutation allowlist (S1-2)
        if (!INTEGRATIONS_DELETE_ROLES.has(membership.role)) {
          return NextResponse.json(
            { error: "Insufficient permissions" },
            { status: 403 },
          );
        }

        // Step 4: Parse target integration ID
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
          return NextResponse.json(
            { error: "Integration ID required" },
            { status: 400 },
          );
        }

        // Step 5: Atomic org-bound delete
        // No withRetry (D16): DELETE is HTTP-idempotent; retry on destructive
        // writes creates ambiguity (commit-success + network-fail -> client 404
        // while row is gone). Clarity > resilience for destructive mutations.
        const result = await db.integrationConnection.deleteMany({
          where: {
            id,
            organizationId: membership.organizationId,
          },
        });

        // Step 6: Not found or cross-org -> same 404 (no info leak)
        if (result.count === 0) {
          return NextResponse.json(
            { error: "Integration not found" },
            { status: 404 },
          );
        }

        return NextResponse.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Integrations DELETE] Error:", message);
        if (isDbUnavailable(error)) return dbErrorResponse(error);
        return NextResponse.json(
          { error: "Failed to disconnect" },
          { status: 500 },
        );
      }
    },
    {
      requireOrg: true,
      requireRole: [
        "admin",
        "owner",
        "brand_admin",
        "brand_owner",
        "platform_owner",
        "platform_admin",
      ],
    },
  ),
  { maxRequests: 10, windowSeconds: 60 },
);