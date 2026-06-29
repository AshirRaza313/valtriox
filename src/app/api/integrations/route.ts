import { NextRequest, NextResponse } from "next/server";
import { db, withRetry, isDbUnavailable, dbErrorResponse } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/integrations?orgId=... — List all integration connections for the org
export const GET = withAuth(async (req: NextRequest, authCtx) => {
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
  } catch (error: any) {
    console.error("[Integrations GET] Error:", error?.message || error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ connections: [] });
  }
}, { requireOrg: true });

// POST /api/integrations — Create or update (upsert) an integration connection
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const { type, provider, name, config, metadata } = body;
    const orgId = authCtx.organizationId;

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
  } catch (error: any) {
    console.error("[Integrations POST] Error:", error?.message || error);
    if (isDbUnavailable(error)) return dbErrorResponse(error);
    return NextResponse.json({ error: "Failed to save integration" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });

// DELETE /api/integrations?id=... — Disconnect an integration
export async function DELETE(req: NextRequest) {
  // Using a raw handler since withAuth DELETE needs org context
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Integration ID required" }, { status: 400 });
    }
    await db.integrationConnection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Integrations DELETE] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
