import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { db, withRetry } from "@/lib/db";

export async function GET(req: Request) {
  const authCtx = await getAuthContext(req as any);
  if (!authCtx) {
    return NextResponse.json({ user: null, organization: null });
  }

  // Fetch fresh user/org data
  try {
    const user = await withRetry(async () => {
      return await db.user.findUnique({
        where: { id: authCtx.userId },
        select: { id: true, name: true, email: true, image: true, role: true },
      });
    }, 2, 500);

    if (!user) {
      return NextResponse.json({ user: null, organization: null });
    }

    // Check if user is a Valtriox team member → override role to "valtriox_team"
    const vtMember = await withRetry(async () => {
      return await db.valtrioxTeamMember.findFirst({
        where: { userId: authCtx.userId, status: "active" },
      });
    }, 2, 500);

    if (vtMember) {
      user.role = "valtriox_team";
    }

    // Flag for platform-level roles that should bypass subscription checks
    const isPlatformLevel = user.role === "platform_owner" || user.role === "platform_admin" || user.role === "valtriox_team";

    let organization = null;
    if (authCtx.organizationId) {
      const membership = await withRetry(async () => {
        return await db.organizationMember.findFirst({
          where: {
            organizationId: authCtx.organizationId,
            userId: authCtx.userId,
          },
          include: {
            organization: {
              select: {
                id: true, name: true, slug: true, logo: true, website: true,
                phone: true, email: true, currency: true, timezone: true,
                plan: true, workingHoursStart: true, workingHoursEnd: true,
                isActive: true, isBanned: true,
              },
            },
          },
        });
      }, 2, 500);
      organization = membership?.organization || null;

      // For platform-level roles, ensure org plan shows "enterprise" so UI doesn't show expired
      if (isPlatformLevel && organization && organization.plan === "starter") {
        organization.plan = "enterprise";
      }
    }

    return NextResponse.json({ user, organization });
  } catch {
    return NextResponse.json({ user: null, organization: null });
  }
}
