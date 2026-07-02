import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// PATCH: Update member role, department, status, visibleSections
export const PATCH = withRateLimit(withAuth(async (req, authCtx, context) => {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { role, department, status, visibleSections } = body;

    const member = await withRetry(async () => {
      return await db.valtrioxTeamMember.findUnique({ where: { id } })
    }, 2, 500);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Don't allow platform_owner to be modified by platform_admin
    if (member.role === "platform_owner" && authCtx.role !== "platform_owner") {
      return NextResponse.json({ error: "Only the platform owner can modify their own record" }, { status: 403 });
    }

    const updateData: any = {};
    if (role) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (status) updateData.status = status;
    if (visibleSections !== undefined) {
      // visibleSections is a JSON string array of hidden section IDs
      updateData.visibleSections = typeof visibleSections === "string" ? visibleSections : JSON.stringify(visibleSections);
    }

    const updated = await withRetry(async () => {
      return await db.valtrioxTeamMember.update({
      where: { id },
      data: updateData,
    })
    }, 2, 500);

    return NextResponse.json({ success: true, member: updated });
  } catch (error: unknown) {
    logger.error("[Valtriox Team] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update member", details: undefined },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// DELETE: Remove team member
export const DELETE = withRateLimit(withAuth(async (req, authCtx, context) => {
  try {
    const { id } = await context.params;

    const member = await withRetry(async () => {
      return await db.valtrioxTeamMember.findUnique({ where: { id } })
    }, 2, 500);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Don't allow removing platform_owner
    if (member.role === "platform_owner") {
      return NextResponse.json({ error: "Cannot remove the platform owner" }, { status: 403 });
    }

    await withRetry(async () => {
      return await db.valtrioxTeamMember.delete({ where: { id } })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("[Valtriox Team] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove member", details: undefined },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
