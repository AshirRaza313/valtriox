import { NextResponse } from "next/server";
import { ROLES } from "@/lib/roles";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(withAuth(async () => {
  try {
    logger.info("[Roles] GET request");
    return NextResponse.json({
      roles: ROLES.map((r) => ({
        name: r.name,
        label: r.label,
        description: r.description,
        level: r.level,
        permissions: r.permissions,
      })),
      total: ROLES.length,
    });
  } catch (error: unknown) {
    logger.error("Roles API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}, { requireOrg: false }), { maxRequests: 20, windowSeconds: 60 });
