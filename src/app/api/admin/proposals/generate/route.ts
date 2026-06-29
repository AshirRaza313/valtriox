import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { generateProposalPDF, type ProposalSettings } from "@/lib/proposal-generator";

// POST /api/admin/proposals/generate - Generate PDF for a proposal
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const { proposalId, template, type: bodyType, clientName: bodyClientName, clientEmail: bodyClientEmail, title: bodyTitle } = body;

    // Fetch platform settings (needed for both modes)
    const settings = await withRetry(async () => {
      return await db.platformSettings.findFirst()
    }, 2, 500);
    const proposalSettings: ProposalSettings = {
      companyName: settings?.companyName || "Valtriox",
      tagline: settings?.tagline || "COMMAND YOUR BRAND UNIVERSE",
      logoUrl: settings?.logoUrl || null,
      companyEmail: settings?.companyEmail || "",
      companyPhone: settings?.companyPhone || null,
      companyWebsite: settings?.companyWebsite || null,
      companyAddress: settings?.companyAddress || null,
      whatsappNumber: settings?.whatsappNumber || null,
      supportHours: settings?.supportHours || null,
      primaryBrandColor: settings?.primaryBrandColor || undefined,
    };

    // ── Mode 1: Template Generation ──
    if (template === true && bodyType) {
      if (!bodyTitle) {
        return NextResponse.json({ error: "Title is required for template generation" }, { status: 400 });
      }

      const templateProposal = {
        id: `template-${Date.now()}`,
        clientName: bodyClientName || "Client Name",
        clientEmail: bodyClientEmail || "client@example.com",
        clientCompany: null,
        clientPhone: null,
        type: bodyType,
        title: bodyTitle,
        status: "template",
        totalCost: null,
        currency: "USD",
        currencySymbol: "$",
        validUntil: null,
        content: {},
        notes: null,
        sentAt: null,
        createdAt: new Date().toISOString(),
      };

      const pdfBuffer = await generateProposalPDF(templateProposal, proposalSettings);
      const filename = `proposal-template-${bodyType}.pdf`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // ── Mode 2: Existing Proposal Generation ──
    if (!proposalId) {
      return NextResponse.json({ error: "Proposal ID is required" }, { status: 400 });
    }

    // Fetch the proposal
    const proposal = await withRetry(async () => {
      return await db.proposal.findUnique({ where: { id: proposalId } })
    }, 2, 500);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Generate PDF
    const pdfBuffer = await generateProposalPDF(
      {
        id: proposal.id,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        clientCompany: proposal.clientCompany,
        clientPhone: proposal.clientPhone,
        type: proposal.type,
        title: proposal.title,
        status: proposal.status,
        totalCost: proposal.totalCost,
        currency: proposal.currency,
        currencySymbol: proposal.currencySymbol,
        validUntil: proposal.validUntil?.toISOString(),
        content: JSON.parse(proposal.content || "{}"),
        notes: proposal.notes,
        sentAt: proposal.sentAt?.toISOString(),
        createdAt: proposal.createdAt.toISOString(),
      },
      proposalSettings
    );

    // Return PDF as a downloadable file
    const filename = `proposal-${proposal.type || "unknown"}-${(proposal.clientName || "").replace(/\s+/g, "-").toLowerCase()}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    logger.error("[Admin Proposals Generate] POST error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to generate proposal PDF" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
