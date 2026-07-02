import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { ROLES } from "@/lib/roles";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    logger.info("[Roles Seed] POST request", { userId: authCtx.userId });

    // Upsert all 16 roles into the database
    const results = [];
    for (const role of ROLES) {
      const result = await withRetry(async () => {
        return await db.role.upsert({
        where: { name: role.name },
        update: {
          label: role.label,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          level: role.level,
        },
        create: {
          name: role.name,
          label: role.label,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          level: role.level,
        },
      })
      }, 2, 500);
      results.push(result);
    }

    return NextResponse.json({
      message: `${results.length} roles seeded successfully`,
      seeded: results.length,
      roles: results.map((r) => ({
        id: r.id,
        name: r.name,
        label: r.label,
        level: r.level,
      })),
    });
  } catch (error: unknown) {
    logger.error("Roles seed error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to seed roles" },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
