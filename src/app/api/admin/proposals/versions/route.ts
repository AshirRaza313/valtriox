import { NextRequest, NextResponse } from "next/server";
import { db, safeDbQuery } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// ── Version metadata stored inside the Proposal.content JSON ──
// Structure: { versions: [{ versionNumber, content, title, totalCost, currency, createdAt, createdBy }], ...rest }
// Current live content is always the last version in the array.

// GET /api/admin/proposals/versions?proposalId=xxx
// Returns all versions of a proposal, ordered by versionNumber desc
export const GET = withRateLimit(withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposalId");

  if (!proposalId) {
    return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
  }

  const { data: proposal, error } = await safeDbQuery(() =>
    db.proposal.findUnique({ where: { id: proposalId } })
  );

  if (error) {
    logger.error("[Admin Proposals Versions] GET error", { error });
    return NextResponse.json({ error: "Failed to fetch proposal versions" }, { status: 503 });
  }

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Parse versions from content JSON
  let parsedContent: Record<string, unknown> = {};
  try {
    parsedContent = JSON.parse(proposal.content || "{}");
  } catch {
    parsedContent = {};
  }

  const versions: Array<{
    versionNumber: number;
    content: Record<string, unknown>;
    title: string;
    totalCost: number | null;
    currency: string;
    createdAt: string;
    createdBy: string;
  }> = Array.isArray(parsedContent.versions)
    ? (parsedContent.versions as Array<Record<string, unknown>>).map((v) => ({
        versionNumber: v.versionNumber as number,
        content: (v.content as Record<string, unknown>) || {},
        title: (v.title as string) || proposal.title,
        totalCost: (v.totalCost as number) ?? proposal.totalCost,
        currency: (v.currency as string) || proposal.currency,
        createdAt: (v.createdAt as string) || proposal.createdAt.toISOString(),
        createdBy: (v.createdBy as string) || "system",
      }))
    : [];

  // If no versions array exists yet, create a synthetic v1 from current content
  if (versions.length === 0) {
    const { versions: _, ...currentContent } = parsedContent;
    versions.push({
      versionNumber: 1,
      content: currentContent,
      title: proposal.title,
      totalCost: proposal.totalCost ? Number(proposal.totalCost) : null,
      currency: proposal.currency,
      createdAt: proposal.createdAt.toISOString(),
      createdBy: "system",
    });
  }

  // Sort descending by versionNumber
  versions.sort((a, b) => b.versionNumber - a.versionNumber);

  return NextResponse.json({
    proposalId: proposal.id,
    currentVersion: versions.length,
    totalVersions: versions.length,
    versions,
  });
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// POST /api/admin/proposals/versions
// Creates a new version with auto-incrementing versionNumber
// Body: { proposalId, content, title, totalCost, currency, saveAsNewVersion }
// If saveAsNewVersion is false/undefined, overwrites current version (existing behavior)
// If saveAsNewVersion is true, appends a new version and updates parent proposal
export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const {
      proposalId,
      content,
      title,
      totalCost,
      currency,
      saveAsNewVersion,
      // Acceptance workflow fields
      acceptProposal,
      rejectProposal,
      rejectionReason,
      termsAccepted,
    } = body;

    if (!proposalId) {
      return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
    }

    // ── Acceptance / Rejection workflow ──
    if (acceptProposal || rejectProposal) {
      const { data: proposal, error: fetchErr } = await safeDbQuery(() =>
        db.proposal.findUnique({ where: { id: proposalId } })
      );
      if (fetchErr) {
        logger.error("[Admin Proposals Versions] Error fetching proposal for accept/reject", { error: fetchErr });
        return NextResponse.json({ error: "Failed to fetch proposal" }, { status: 503 });
      }

      if (!proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
      }

      if (acceptProposal) {
        // Accept the proposal
        const { data: updated, error: updateErr } = await safeDbQuery(() =>
          db.proposal.update({
            where: { id: proposalId },
            data: {
              status: "accepted",
              respondedAt: new Date(),
            },
          })
        );

        if (updateErr) {
          logger.error("[Admin Proposals Versions] Error accepting proposal", { error: updateErr });
          return NextResponse.json({ error: "Failed to accept proposal" }, { status: 503 });
        }

        // Store acceptance metadata inside content JSON
        let parsedContent: Record<string, unknown> = {};
        try {
          parsedContent = JSON.parse(updated?.content || "{}");
        } catch {
          parsedContent = {};
        }
        parsedContent.acceptedAt = new Date().toISOString();
        parsedContent.acceptedBy = authCtx.userId;
        parsedContent.acceptedByName = authCtx.email;

        await safeDbQuery(() =>
          db.proposal.update({
            where: { id: proposalId },
            data: { content: JSON.stringify(parsedContent) },
          })
        );

        // Create a notification (best-effort)
        await safeDbQuery(() =>
          db.notification.create({
            data: {
              title: "Proposal Accepted",
              message: `Proposal "${proposal.title}" for ${proposal.clientName} has been accepted.`,
              type: "success",
              icon: "check-circle",
              userId: authCtx.userId,
            },
          })
        );

        logger.info("[Admin Proposals Versions] Proposal accepted", {
          proposalId,
          acceptedBy: authCtx.userId,
        });

        return NextResponse.json({
          success: true,
          message: "Proposal accepted successfully",
          proposal: updated,
        });
      }

      if (rejectProposal) {
        // Reject the proposal
        const { data: updated, error: updateErr } = await safeDbQuery(() =>
          db.proposal.update({
            where: { id: proposalId },
            data: {
              status: "rejected",
              respondedAt: new Date(),
            },
          })
        );

        if (updateErr) {
          logger.error("[Admin Proposals Versions] Error rejecting proposal", { error: updateErr });
          return NextResponse.json({ error: "Failed to reject proposal" }, { status: 503 });
        }

        // Store rejection metadata inside content JSON
        let parsedContent: Record<string, unknown> = {};
        try {
          parsedContent = JSON.parse(updated?.content || "{}");
        } catch {
          parsedContent = {};
        }
        parsedContent.rejectedAt = new Date().toISOString();
        parsedContent.rejectedBy = authCtx.userId;
        parsedContent.rejectedByName = authCtx.email;
        parsedContent.rejectionReason = rejectionReason || null;

        await safeDbQuery(() =>
          db.proposal.update({
            where: { id: proposalId },
            data: { content: JSON.stringify(parsedContent) },
          })
        );

        // Create a notification (best-effort)
        await safeDbQuery(() =>
          db.notification.create({
            data: {
              title: "Proposal Rejected",
              message: `Proposal "${proposal.title}" for ${proposal.clientName} has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
              type: "warning",
              icon: "x-circle",
              userId: authCtx.userId,
            },
          })
        );

        logger.info("[Admin Proposals Versions] Proposal rejected", {
          proposalId,
          rejectedBy: authCtx.userId,
          reason: rejectionReason,
        });

        return NextResponse.json({
          success: true,
          message: "Proposal rejected successfully",
          proposal: updated,
        });
      }
    }

    // ── Versioning: Save as New Version ──
    if (saveAsNewVersion) {
      const { data: proposal, error: fetchErr } = await safeDbQuery(() =>
        db.proposal.findUnique({ where: { id: proposalId } })
      );
      if (fetchErr) {
        logger.error("[Admin Proposals Versions] Error fetching proposal for new version", { error: fetchErr });
        return NextResponse.json({ error: "Failed to fetch proposal" }, { status: 503 });
      }

      if (!proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
      }

      let parsedContent: Record<string, unknown> = {};
      try {
        parsedContent = JSON.parse(proposal.content || "{}");
      } catch {
        parsedContent = {};
      }

      const existingVersions: Array<Record<string, unknown>> = Array.isArray(parsedContent.versions)
        ? (parsedContent.versions as Array<Record<string, unknown>>)
        : [];

      // Extract current content (everything except versions array)
      const { versions: _versions, ...currentContent } = parsedContent;

      // If this is the first version, back up current content as v1
      let newVersionNumber = existingVersions.length + 1;
      if (existingVersions.length === 0) {
        existingVersions.push({
          versionNumber: 1,
          content: currentContent,
          title: proposal.title,
          totalCost: proposal.totalCost,
          currency: proposal.currency,
          createdAt: proposal.createdAt.toISOString(),
          createdBy: "system",
        });
        newVersionNumber = 2;
      }

      // Add the new version
      const newVersion = {
        versionNumber: newVersionNumber,
        content: content || currentContent,
        title: title || proposal.title,
        totalCost: totalCost != null ? Number(totalCost) : proposal.totalCost,
        currency: currency || proposal.currency,
        createdAt: new Date().toISOString(),
        createdBy: authCtx.email,
      };
      existingVersions.push(newVersion);

      // Rebuild content: merge new content at root + versions array
      const newContentData = content || currentContent;
      const finalContent = {
        ...newContentData,
        versions: existingVersions,
      };

      // Update the proposal
      const { data: updated, error: updateErr } = await safeDbQuery(() =>
        db.proposal.update({
          where: { id: proposalId },
          data: {
            content: JSON.stringify(finalContent),
            title: title || proposal.title,
            totalCost: totalCost != null ? Number(totalCost) : proposal.totalCost,
            currency: currency || proposal.currency,
          },
        })
      );

      if (updateErr) {
        logger.error("[Admin Proposals Versions] Error saving new version", { error: updateErr });
        return NextResponse.json({ error: "Failed to save new version" }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        message: `Version ${newVersionNumber} created successfully`,
        version: newVersion,
        proposal: updated,
      });
    }

    // ── Default: Overwrite current version (existing behavior) ──
    const { data: proposal, error: fetchErr } = await safeDbQuery(() =>
      db.proposal.findUnique({ where: { id: proposalId } })
    );
    if (fetchErr) {
      logger.error("[Admin Proposals Versions] Error fetching proposal for overwrite", { error: fetchErr });
      return NextResponse.json({ error: "Failed to fetch proposal" }, { status: 503 });
    }

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    let parsedContent: Record<string, unknown> = {};
    try {
      parsedContent = JSON.parse(proposal.content || "{}");
    } catch {
      parsedContent = {};
    }

    const existingVersions: Array<Record<string, unknown>> = Array.isArray(parsedContent.versions)
      ? (parsedContent.versions as Array<Record<string, unknown>>)
      : [];

    // Build final content: new content merged at root + preserve versions array
    const finalContent = {
      ...content,
      versions: existingVersions,
    };

    const updateData: Record<string, unknown> = {
      content: JSON.stringify(finalContent),
    };
    if (title) updateData.title = title;
    if (totalCost !== undefined) updateData.totalCost = Number(totalCost);
    if (currency) updateData.currency = currency;

    const { data: updated, error: updateErr } = await safeDbQuery(() =>
      db.proposal.update({
        where: { id: proposalId },
        data: updateData,
      })
    );

    if (updateErr) {
      logger.error("[Admin Proposals Versions] Error overwriting version", { error: updateErr });
      return NextResponse.json({ error: "Failed to process proposal version" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: "Proposal updated successfully",
      proposal: updated,
    });
  } catch (error: unknown) {
    logger.error("[Admin Proposals Versions] POST error", error);
    return NextResponse.json({ error: "Failed to process proposal version" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
