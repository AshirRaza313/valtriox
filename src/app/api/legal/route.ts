import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    const where: any = { isActive: true };
    if (slug) {
      where.slug = slug;
    }

    const pages = await withRetry(async () => {
      return await db.legalPage.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { title: "asc" },
    })
    }, 2, 500);

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error("Fetch legal pages error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch legal pages" }, { status: 500 });
  }
}
