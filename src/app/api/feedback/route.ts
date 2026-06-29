import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";
import { validateBody, createFeedbackSchema } from "@/lib/validations";
import { z } from "zod";

// Phase 3: Zod schemas for feedback
const feedbackPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  isFeatured: z.boolean().optional(),
});

export const GET = withAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const orgId = ctx.organizationId;

    // FIX: orgId is MANDATORY — without it, cross-org data leak occurs
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }
    const where: Record<string, unknown> = { organizationId: orgId };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Feedback GET] Error:", msg);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, ctx) => {
  try {
    // Phase 3: Zod validation
    const feedbackBodySchema = z.object({
      type: z.enum(["feedback", "testimonial", "review", "video"]),
      rating: z.number().min(1).max(5).optional(),
      content: z.string().min(1, "Content is required").max(5000),
      authorName: z.string().max(200).optional(),
      authorCompany: z.string().max(200).optional(),
      videoUrl: z.string().max(2048).optional(),
      isFeatured: z.boolean().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    });

    const bodyResult = await validateBody(req, feedbackBodySchema);
    if (!bodyResult.success) return bodyResult.response;
    const { type, rating, content, authorName, authorCompany, videoUrl, isFeatured, status } = bodyResult.data;

    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const feedback = await db.feedback.create({
      data: {
        organizationId: orgId,
        type,
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Feedback POST] Error:", msg);
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, ctx) => {
  try {
    const bodyResult = await validateBody(req, feedbackPatchSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { id, status, isFeatured } = bodyResult.data;

    // FIX 1.7: Verify feedback belongs to the caller's organization
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    }

    const existing = await db.feedback.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (typeof isFeatured === "boolean") updateData.isFeatured = isFeatured;

    const feedback = await db.feedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ feedback });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Feedback PATCH] Error:", msg);
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

    // FIX 1.7: Verify feedback belongs to the caller's organization
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    }

    const existing = await db.feedback.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    await db.feedback.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Feedback DELETE] Error:", msg);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
});
