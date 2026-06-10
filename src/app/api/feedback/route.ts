import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";

export const GET = withAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const orgId = ctx.organizationId;

    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (type) where.type = type;
    if (status) where.status = status;

    const feedbacks = await db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, type: true, rating: true, content: true,
        authorName: true, authorCompany: true, videoUrl: true,
        isFeatured: true, status: true, createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ feedbacks });
  } catch (error: any) {
    console.error("[Feedback GET] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { type, rating, content, authorName, authorCompany, videoUrl, isFeatured, status } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (!["feedback", "testimonial", "review", "video"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const feedback = await db.feedback.create({
      data: {
        organizationId: orgId,
        type: type || "feedback",
        rating: rating || null,
        content: content.trim(),
        authorName: authorName || null,
        authorCompany: authorCompany || null,
        videoUrl: videoUrl || null,
        isFeatured: isFeatured || false,
        status: status || "pending",
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error: any) {
    console.error("[Feedback POST] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { id, status, isFeatured } = body;

    if (!id) {
      return NextResponse.json({ error: "Feedback ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (typeof isFeatured === "boolean") updateData.isFeatured = isFeatured;

    const feedback = await db.feedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("[Feedback PATCH] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Feedback ID is required" }, { status: 400 });
    }

    await db.feedback.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Feedback DELETE] Error:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
});
