import { NextRequest, NextResponse } from "next/server";
import { CREATE_ALL_TABLES_SQL } from "@/lib/db";
import { getAuthContext, isPlatformRole } from "@/lib/auth-middleware";

/**
 * GET /api/db/sql
 *
 * Returns the complete SQL needed to create all 27 tables.
 * Use this SQL in Supabase Dashboard > SQL Editor if automatic creation fails.
 *
 * Requires platform_owner or platform_admin authentication.
 */
export async function GET(req: NextRequest) {
  const authCtx = await getAuthContext(req);
  if (!authCtx || !isPlatformRole(authCtx.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(CREATE_ALL_TABLES_SQL, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="create-tables.sql"',
      "Cache-Control": "no-store",
    },
  });
}
