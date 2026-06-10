import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// PUT /api/db-notifications/[id] - Mark notification as read
export const PUT = withAuth(async (
  req: NextRequest,
  authCtx: any
) => {
  try {
    logger.info("[DB Notifications] PUT request", { userId: authCtx.userId });
    await ensureDb();
    // Extract ID from URL path
    const urlParts = req.url.split("/");
    const id = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];

    const notification = await withRetry(async () => {
      return await db.notification.findUnique({ where: { id } })
    }, 2, 500);
    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await withRetry(async () => {
      return await db.notification.update({
      where: { id },
      data: { read: true },
    })
    }, 2, 500);

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    console.error("Mark notification read error:", error?.message || error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
});
