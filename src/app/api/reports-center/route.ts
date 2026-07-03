// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// GET /api/reports-center?orgId=xxx
// Returns the audit log of reports generated for this org (or all orgs if admin)
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const requestedOrgId = req.nextUrl.searchParams.get("orgId");
    const isAdmin = isPlatformRole(authCtx.role);
    const orgId = isAdmin && requestedOrgId ? requestedOrgId : authCtx.organizationId!;

    if (!isAdmin && orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Phase 2 model may not yet exist on DB; safe query returns null error gracefully
    const { data, error } = await safeDbQuery(() =>
      db.reportExport.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    );

    if (error) {
      // Schema may not yet be applied — return empty list with a hint
      logger.warn("[Reports Center] DB error fetching audit log (schema may be missing)", { error });
      return NextResponse.json({ reports: [], schemaMissing: true });
    }

    return NextResponse.json({ reports: data || [] });
  } catch (err: unknown) {
    logger.error("[Reports Center] GET error", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ reports: [], error: "Failed to load reports" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

// POST /api/reports-center
// Body: { organizationId, type, title, period, dateFrom?, dateTo?, fileSizeKb?, recipientEmail?, emailedAt?, emailStatus? }
// Records the generation OR email of a report PDF for audit trail
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const {
      organizationId,
      type,
      title,
      period,
      dateFrom,
      dateTo,
      fileSizeKb,
      recipientEmail,
      emailedAt,
      emailStatus,
    } = body;

    if (!organizationId || !type || !title) {
      return NextResponse.json({ error: "organizationId, type, and title are required" }, { status: 400 });
    }

    const isAdmin = isPlatformRole(authCtx.role);
    if (!isAdmin && organizationId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data, error } = await safeDbQuery(() =>
      db.reportExport.create({
        data: {
          organizationId,
          type,
          title,
          period: period || "monthly",
          dateFrom: dateFrom ? new Date(dateFrom) : null,
          dateTo: dateTo ? new Date(dateTo) : null,
          generatedById: authCtx.userId,
          fileSizeKb: fileSizeKb || null,
          recipientEmail: recipientEmail || null,
          emailedAt: emailedAt ? new Date(emailedAt) : null,
          emailStatus: emailStatus || null,
        },
      })
    );

    if (error) {
      logger.warn("[Reports Center] Could not save audit log (schema may be missing)", { error });
      // Don't fail the request — audit log is best-effort
      return NextResponse.json({ report: null, warning: "Audit log not saved (schema may need update)" });
    }

    return NextResponse.json({ report: data }, { status: 201 });
  } catch (err: unknown) {
    logger.error("[Reports Center] POST error", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to log report" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
