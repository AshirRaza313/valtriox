// ============================================================================
// Storage Usage API
// ============================================================================
// GET /api/usage/storage?organizationId=...
//
// Returns the organization's current storage usage compared to plan limit.
// Protected via withAuth middleware.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db, isDbUnavailable, dbErrorResponse, withRetry } from "@/lib/db";
import { checkStorageLimit } from "@/lib/storage-tracker";

export const GET = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("organizationId") || authCtx.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }
    // Fetch org plan from the DB with retry
    const org = await withRetry(async () => {
      const organization = await db.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      });
      return organization;
    }, 2, 500);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const plan = org.plan || "starter";
    const result = await withRetry(async () => {
      return checkStorageLimit(orgId, plan);
    }, 2, 500);

    const limitGb = result.limitMb === -1 ? -1 : Math.round((result.limitMb / 1024) * 100) / 100;

    let status: "ok" | "warning" | "critical" = "ok";
    if (result.warning === "critical") status = "critical";
    else if (result.warning === "warning") status = "warning";

    return NextResponse.json({
      usedMb: result.usedMb,
      limitMb: result.limitMb,
      limitGb,
      percent: result.percent,
      status,
    });
  } catch (error: any) {
    console.error("[Storage Usage] Error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to fetch storage usage" },
      { status: 500 }
    );
  }
}, { requireOrg: true });
