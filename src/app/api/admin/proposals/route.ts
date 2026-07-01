import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/admin/proposals - List proposals with filtering (admin only)
export const GET = withRateLimit(withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.type = type;
  if (search) {
    where.OR = [
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
      { clientCompany: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }

  const [r1, r2] = await Promise.all([
    safeDbQuery(() =>
      db.proposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      })
    ),
    safeDbQuery(() => db.proposal.count({ where })),
  ]);

  if (r1.error) {
    logger.error("[Admin Proposals] GET error fetching proposals", { error: r1.error });
    return r1.errorResponse;
  }
  if (r2.error) {
    logger.error("[Admin Proposals] GET error counting proposals", { error: r2.error });
    return r2.errorResponse;
  }

  const proposals = r1.data;
  const total = r2.data;
  return NextResponse.json({ proposals, total: total ?? 0, page, totalPages: Math.ceil((total ?? 0) / limit) });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 15, windowSeconds: 60 });

// POST /api/admin/proposals - Create a new proposal (admin only)
export const POST = withRateLimit(withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const {
      leadId,
      clientName,
      clientEmail,
      clientCompany,
      clientPhone,
      type,
      title,
      totalCost,
      currency,
      currencySymbol,
      validUntil,
      content,
      notes,
    } = body;

    // Validate required fields
    if (!clientName || !clientEmail || !type || !title) {
      return NextResponse.json(
        { error: "clientName, clientEmail, type, and title are required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "brand_management",
      "digital_marketing",
      "tech_integration",
      "e_commerce",
      "enterprise",
      "monthly_retainer",
      "social_media_management",
      "content_creation",
      "seo_optimization",
      "paid_advertising",
      "brand_identity",
      "consultation",
      "custom_development",
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid proposal type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const { data: proposal, error } = await safeDbQuery(() =>
      db.proposal.create({
        data: {
          leadId: leadId || null,
          clientName,
          clientEmail,
          clientCompany: clientCompany || null,
          clientPhone: clientPhone || null,
          type,
          title,
          status: "draft",
          totalCost: totalCost != null ? Number(totalCost) : null,
          currency: currency || "PKR",
          currencySymbol: currencySymbol || "Rs.",
          validUntil: validUntil ? new Date(validUntil) : null,
          content: content ? JSON.stringify(content) : "{}",
          notes: notes || null,
        },
      })
    );

    if (error) {
      logger.error("[Admin Proposals] POST error", { error });
      return NextResponse.json({
        error: "Failed to create proposal",
        detail: error?.substring(0, 200),
        code: "PROPOSALS_CREATE_ERROR",
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, proposal }, { status: 201 });
  } catch (error: any) {
    logger.error("[Admin Proposals] POST validation/parsing error", error);
    return NextResponse.json({
      error: "Failed to create proposal",
      detail: error?.message?.substring(0, 200),
      code: "PROPOSALS_CREATE_ERROR",
    }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 15, windowSeconds: 60 });

// PUT /api/admin/proposals - Update proposal (admin only)
export const PUT = withRateLimit(withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { id, status, notes, content, totalCost, validUntil, title, clientName, clientEmail, clientCompany, clientPhone, type } = body;

    if (!id) {
      return NextResponse.json({ error: "Proposal ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (status) {
      const validStatuses = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "revised"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = status;
      // If marking as sent, set sentAt
      if (status === "sent") {
        updateData.sentAt = new Date();
      }
      // If marking as viewed, set viewedAt
      if (status === "viewed") {
        updateData.viewedAt = new Date();
      }
      // If accepted or rejected, set respondedAt
      if (status === "accepted" || status === "rejected") {
        updateData.respondedAt = new Date();
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (content !== undefined) updateData.content = JSON.stringify(content);
    if (totalCost !== undefined) updateData.totalCost = Number(totalCost);
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (title !== undefined) updateData.title = title;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail;
    if (clientCompany !== undefined) updateData.clientCompany = clientCompany;
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone;
    if (type !== undefined) {
      const validTypes = ["brand_management", "digital_marketing", "tech_integration", "e_commerce", "enterprise", "monthly_retainer", "social_media_management", "content_creation", "seo_optimization", "paid_advertising", "brand_identity", "consultation", "custom_development"];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: "Invalid proposal type" }, { status: 400 });
      }
      updateData.type = type;
    }

    const { data: proposal, error } = await safeDbQuery(() =>
      db.proposal.update({
        where: { id },
        data: updateData,
      })
    );

    if (error) {
      logger.error("[Admin Proposals] PUT error", { error });
      return NextResponse.json({
        error: "Failed to update proposal",
        detail: error?.substring(0, 200),
        code: "PROPOSALS_UPDATE_ERROR",
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, proposal });
  } catch (error: any) {
    logger.error("[Admin Proposals] PUT validation/parsing error", error);
    return NextResponse.json({
      error: "Failed to update proposal",
      detail: error?.message?.substring(0, 200),
      code: "PROPOSALS_UPDATE_ERROR",
    }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 15, windowSeconds: 60 });

// DELETE /api/admin/proposals - Delete a proposal (admin only)
export const DELETE = withRateLimit(withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Proposal ID is required" }, { status: 400 });
  }

  const { error } = await safeDbQuery(() =>
    db.proposal.delete({ where: { id } })
  );

  if (error) {
    logger.error("[Admin Proposals] DELETE error", { error });
    return NextResponse.json({
      error: "Failed to delete proposal",
      detail: error?.substring(0, 200),
      code: "PROPOSALS_DELETE_ERROR",
    }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 15, windowSeconds: 60 });
