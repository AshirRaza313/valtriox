import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { userId, organizationId, status, clockIn, clockOut, lateReason, leaveReason } = body;
    const orgId = organizationId || authCtx.organizationId;

    if (!userId || !orgId || !status) {
      return NextResponse.json({ error: "userId, organizationId, and status are required" }, { status: 400 });
    }

    // Security: Ensure user can only mark attendance in their own org
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const validStatuses = ["present", "late", "leave", "absent", "half-day"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // Get org for working hours
    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id: orgId } })
    }, 2, 500);
    const workingStart = org?.workingHoursStart || "09:00";

    // Pakistan timezone date
    const now = new Date();
    const pakistanOffset = 5 * 60; // UTC+5
    const pakistanTime = new Date(now.getTime() + (pakistanOffset + now.getTimezoneOffset()) * 60000);
    const today = new Date(pakistanTime.getFullYear(), pakistanTime.getMonth(), pakistanTime.getDate());

    // Check existing attendance
    const existing = await withRetry(async () => {
      return await db.attendance.findUnique({
      where: { userId_organizationId_date: { userId, organizationId: orgId, date: today } },
    })
    }, 2, 500);

    if (existing) {
      return NextResponse.json({ error: "Attendance already marked for today" }, { status: 400 });
    }

    // Validate required reasons
    if (status === "late" && !lateReason) {
      return NextResponse.json({ error: "Late reason is required when marking late attendance" }, { status: 400 });
    }
    if (status === "leave" && !leaveReason) {
      return NextResponse.json({ error: "Leave reason is required when marking leave" }, { status: 400 });
    }

    // Create attendance record
    const attendance = await withRetry(async () => {
      return await db.attendance.create({
      data: {
        userId,
        organizationId: orgId,
        date: today,
        clockIn: clockIn ? new Date(clockIn) : (status !== "absent" ? new Date() : null),
        clockOut: clockOut ? new Date(clockOut) : null,
        status,
        lateReason: lateReason || null,
        leaveReason: leaveReason || null,
        markedBy: "self",
      },
    })
    }, 2, 500);

    // Handle absence tracking and penalties
    let penaltyApplied = false;
    let newAbsenceCount = 0;

    const member = await withRetry(async () => {
      return await db.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
    })
    }, 2, 500);

    if (member) {
      if (status === "absent") {
        newAbsenceCount = (member.absenceCount || 0) + 1;
        
        if (newAbsenceCount >= 3) {
          // Apply 7-day penalty
          const penaltyUntil = new Date();
          penaltyUntil.setDate(penaltyUntil.getDate() + 7);
          
          await withRetry(async () => {
            return await db.organizationMember.update({
            where: { id: member.id },
            data: {
              absenceCount: newAbsenceCount,
              penaltyUntil,
            },
          })
          }, 2, 500);
          penaltyApplied = true;
        } else {
          await withRetry(async () => {
            return await db.organizationMember.update({
            where: { id: member.id },
            data: { absenceCount: newAbsenceCount },
          })
          }, 2, 500);
        }
      } else if (status === "present" || status === "late") {
        // Reset absence count on present/late
        await withRetry(async () => {
          return await db.organizationMember.update({
          where: { id: member.id },
          data: { absenceCount: 0 },
        })
        }, 2, 500);
      }
    }

    return NextResponse.json({
      attendance,
      message: penaltyApplied
        ? `⚠️ Penalty applied! 3 consecutive absences. Access restricted for 7 days.`
        : status === "late"
          ? `Marked as late. ${newAbsenceCount > 0 ? `Warning: ${newAbsenceCount} absence(s) recorded.` : ""}`
          : status === "absent"
          ? `Marked as absent. ${newAbsenceCount} consecutive absence(s). 3 absences = penalty!`
          : `Attendance marked successfully`,
      absenceCount: newAbsenceCount,
      penaltyApplied,
    }, { status: 201 });
  } catch (error: any) {
    logger.error("Attendance POST error", error, { orgId: authCtx?.organizationId });
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 });
  }
}), { maxRequests: 20, windowSeconds: 60 });

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || authCtx.organizationId;
    const userId = searchParams.get("userId");
    const month = searchParams.get("month"); // YYYY-MM format

    if (!orgId || !userId) {
      return NextResponse.json({ error: "orgId and userId required" }, { status: 400 });
    }

    // Security: Ensure user can only access their own org's data
    if (orgId !== authCtx.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify the user is a member of this organization
    const membership = await withRetry(async () => {
      return await db.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
    })
    }, 2, 500);
    if (!membership) {
      return NextResponse.json({ error: "User is not a member of this organization" }, { status: 403 });
    }

    const where: any = { userId, organizationId: orgId };
    if (month) {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      where.date = { gte: startDate, lt: endDate };
    }

    const records = await withRetry(async () => {
      return await db.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      take: 100,
    })
    }, 2, 500);

    const totalHours = records.reduce((sum: number, r: any) => sum + (r.totalHours || 0), 0);

    return NextResponse.json({ records, totalHours: Math.round(totalHours * 10) / 10 });
  } catch (error: any) {
    logger.error("Attendance GET error", error, { orgId: authCtx?.organizationId });
    if (error?.message?.includes('DATABASE_URL') || error?.message?.includes('Database connection')) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}), { maxRequests: 20, windowSeconds: 60 });
