import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import logger from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const page = await withRetry(async () => {
      return await db.legalPage.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        updatedAt: true,
        createdAt: true,
      },
    })
    }, 2, 500);

    if (!page) {
      return NextResponse.json(
        { error: `Legal page with slug "${slug}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ page });
  } catch (error: unknown) {
    logger.error("Fetch legal page error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch legal page" }, { status: 500 });
  }
}
