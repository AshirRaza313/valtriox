import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// GET /api/admin/leads - List all leads (admin only)
export const GET = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    logger.error("[Admin Leads] GET error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch leads", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// PUT /api/admin/leads - Update lead status/fields (admin only)
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, status, notes, consultationType, preferredDate, preferredTime, timezone, availabilityNote } = body;

    if (!id) return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });

    const validStatuses = ["new", "contacted", "qualified", "consultation_scheduled", "proposal_sent", "converted", "archived"];
    const updateData: any = {};
    if (status && validStatuses.includes(status)) {
      updateData.status = status;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (consultationType !== undefined) updateData.consultationType = consultationType;
    if (preferredDate !== undefined) updateData.preferredDate = preferredDate;
    if (preferredTime !== undefined) updateData.preferredTime = preferredTime;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (availabilityNote !== undefined) updateData.availabilityNote = availabilityNote;

    const lead = await withRetry(async () => {
      return await db.lead.update({
      where: { id },
      data: updateData,
    })
    }, 2, 500);

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    logger.error("[Admin Leads] PUT error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update lead", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// DELETE /api/admin/leads - Delete a lead (admin only)
export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });

    await withRetry(async () => {
      return await db.lead.delete({ where: { id } })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("[Admin Leads] DELETE error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete lead", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
