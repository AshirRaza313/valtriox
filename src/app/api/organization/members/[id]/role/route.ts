import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { canAssignRole, getAdminEmail } from "@/lib/roles";
import { validateBody } from "@/lib/validations/api";
import { updateMemberRoleApiSchema } from "@/lib/validations/schemas";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// PUT /api/organization/members/[id]/role
// Update a team member's role assignment
export const PUT = withRateLimit(withAuth(async (
  req: NextRequest,
  authCtx: any
) => {
  try {
    logger.info("[Org Members Role] PUT request", { userId: authCtx.userId });
    // Extract member ID from URL path
    const urlParts = req.url.split("/");
    const id = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    const result = await validateBody(req, updateMemberRoleApiSchema);
    if (!result.success) return result.response;
    const body = result.data;
    const { roleId, roleName } = body;

    // Authorization check — uses authCtx.role from middleware (server-side, cannot be forged)
    const allowedRoles = ["platform_owner", "platform_admin", "brand_owner", "brand_admin"];
    if (!allowedRoles.includes(authCtx.role)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to change roles" },
        { status: 403 }
      );
    }

    // Verify the member exists
    const existingMember = await withRetry(async () => {
      return await db.organizationMember.findUnique({
      where: { id },
    })
    }, 2, 500);

    if (!existingMember) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // SECURITY: Org ownership check — prevent cross-org role changes
    if (existingMember.organizationId !== authCtx.organizationId) {
      return NextResponse.json(
        { error: "Access denied. This member does not belong to your organization." },
        { status: 403 }
      );
    }

    const updateData: any = {};

    if (roleId) {
      const roleExists = await withRetry(async () => {
        return await db.role.findUnique({
        where: { id: roleId },
      })
      }, 2, 500);
      if (!roleExists) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 });
      }
      updateData.roleId = roleId;
      // Also update the role string for consistency
      if (roleExists.name) updateData.role = roleExists.name;
    }

    if (roleName) {
      // SECURITY: Enforce role hierarchy — prevent privilege escalation
      const targetRole = roleName.toLowerCase();
      const adminEmail = getAdminEmail();
      const roleCheck = canAssignRole(authCtx.role, authCtx.email, targetRole, adminEmail);
      if (!roleCheck.allowed) {
        return NextResponse.json(
          { error: roleCheck.reason || "Insufficient permissions to assign this role", code: roleCheck.code },
          { status: 403 }
        );
      }
      updateData.role = roleName;
    }

    const updatedMember = await withRetry(async () => {
      return await db.organizationMember.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        roleDef: {
          select: { id: true, name: true, label: true, description: true, level: true },
        },
      },
    })
    }, 2, 500);

    return NextResponse.json({
      message: "Role updated successfully",
      member: updatedMember,
    });
  } catch (error: unknown) {
    logger.error("Member role update error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}), { maxRequests: 30, windowSeconds: 60 });
