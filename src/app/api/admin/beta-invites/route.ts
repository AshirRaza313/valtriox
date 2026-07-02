import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { db, withRetry } from "@/lib/db";
import { sendEmail, isEmailConfigured, SUPPORT_EMAIL, SUPPORT_FROM, SUPPORT_REPLY_TO } from "@/lib/email";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import {
  getUltraPremiumInviteHtml,
  getUltraPremiumWhatsAppMessage,
  generateUltraPremiumWhatsAppLink,
  getPrintableInvitationHtml,
  type UltraPremiumInviteData,
} from "@/lib/invitation-document";

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // SECURITY: Always use crypto.getRandomValues — no Math.random() fallback
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function getPlatformSettings() {
  let platformName = "Valtriox",
    platformWebsite = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://valtriox.com",
    companyEmail = SUPPORT_EMAIL,
    companyPhone: string | null = null,
    companyAddress: string | null = null;
  try {
    const s: any = await db.platformSettings.findFirst();
    if (s) {
      platformName = s.companyName || platformName;
      platformWebsite = s.companyWebsite || platformWebsite;
      companyEmail = s.companyEmail || companyEmail;
      companyPhone = s.companyPhone;
      companyAddress = s.companyAddress;
    }
  } catch {
    /* non-critical */
  }
  return { platformName, platformWebsite, companyEmail, companyPhone, companyAddress };
}

const VALID_PLANS = ["enterprise", "professional", "growth", "starter"] as const;
const VALID_STATUSES = ["sent", "accepted", "expired", "revoked"] as const;

// ═══════════════════════════════════════════════════════════════════════
//  GET — List invites or preview invitation document
// ═══════════════════════════════════════════════════════════════════════

export const GET = withRateLimit(withAuth(async (req, _ctx) => {
  try {
    const url = new URL(req.url);

    // ── Document preview (HTML) ──
    const documentId = url.searchParams.get("document");
    if (documentId) {
      const invite = await withRetry(() =>
        db.betaInvite.findUnique({ where: { id: documentId } })
      );
      if (!invite) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 });
      }
      const settings = await getPlatformSettings();
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
      const data: UltraPremiumInviteData = {
        email: invite.email,
        token: invite.token || "N/A",
        plan: invite.plan,
        trialDays: invite.trialDays,
        claimUrl: `${baseUrl}/beta-claim?email=${encodeURIComponent(invite.email)}&code=${invite.token}`,
        ...settings,
      };
      const html = getPrintableInvitationHtml(data);
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ── List invites (with optional status filter) ──
    const status = url.searchParams.get("status");
    const where: any = {};
    if (status) where.status = status;

    const invites = await withRetry(() =>
      db.betaInvite.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          token: true,
          plan: true,
          invitedBy: true,
          status: true,
          trialDays: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    );

    return NextResponse.json({ invites });
  } catch (error: unknown) {
    logger.error("[BetaInvite GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch invites", detail: undefined },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════
//  POST — Create invite
//
//  Flow: Validate → Generate token → Create record → Send notifications
//  NOTE: BetaInvite table is created via `prisma db push` at build time.
//  No runtime DDL is performed here.
// ═══════════════════════════════════════════════════════════════════════

export const POST = withRateLimit(withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { email, plan, trialDays, sendVia, phone } = body;

    // ── Validate ──
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
    if (plan && !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // ── Create invite ──
    const token = generateToken();
    const days = trialDays || 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const invite = await withRetry(() =>
      db.betaInvite.create({
        data: {
          email: email.trim().toLowerCase(),
          token,
          plan: plan || "enterprise",
          invitedBy: ctx.userId,
          trialDays: days,
          expiresAt,
        },
      })
    );

    // ── Send notifications ──
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
    const claimUrl = `${baseUrl}/beta-claim?email=${encodeURIComponent(invite.email)}&code=${invite.token}`;
    const settings = await getPlatformSettings();
    const sendResults: { email?: boolean; whatsapp?: string } = {};

    const inviteData: UltraPremiumInviteData = {
      email: invite.email,
      token: invite.token,
      plan: invite.plan,
      trialDays: invite.trialDays,
      claimUrl,
      ...settings,
    };

    // Email
    if (!sendVia || sendVia === "email" || sendVia === "both") {
      try {
        const html = getUltraPremiumInviteHtml(inviteData);
        const textPlain = getUltraPremiumWhatsAppMessage(inviteData);
        sendResults.email = await sendEmail({
          to: invite.email,
          from: SUPPORT_FROM,
          replyTo: SUPPORT_REPLY_TO,
          subject: `Exclusive Beta Access - ${settings.platformName}`,
          html,
          text: textPlain,
        });
      } catch (e: unknown) {
        logger.error("[BetaInvite] Email send failed", e);
        sendResults.email = false;
      }
    }

    // WhatsApp
    if (
      (!sendVia || sendVia === "whatsapp" || sendVia === "both") &&
      phone
    ) {
      sendResults.whatsapp = generateUltraPremiumWhatsAppLink(
        phone,
        inviteData
      );
    }

    return NextResponse.json(
      {
        invite,
        claimUrl,
        sendResults,
        emailConfigured: isEmailConfigured(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error("[BetaInvite POST]", error, { code: typeof error === "object" && error !== null && "code" in error ? (error as { code: string }).code : undefined });

    // Unique constraint — invite already exists
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "An invite for this email already exists" },
        { status: 409 }
      );
    }

    // Table doesn't exist — Prisma returns P2021
    const msg = (error instanceof Error ? error.message : "").toLowerCase();
    if (
      msg.includes("does not exist") ||
      (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2021")
    ) {
      return NextResponse.json(
        {
          error:
            "BetaInvite table not found. Please run `prisma db push` or create the table in Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create invite", detail: undefined },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════
//  DELETE — Remove an invite
// ═══════════════════════════════════════════════════════════════════════

export const DELETE = withRateLimit(withAuth(async (req, _ctx) => {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Invite ID required" },
        { status: 400 }
      );
    }
    await withRetry(() => db.betaInvite.delete({ where: { id } }));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("[BetaInvite DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete invite" },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════
//  PATCH — Update invite status
// ═══════════════════════════════════════════════════════════════════════

export const PATCH = withRateLimit(withAuth(async (req, _ctx) => {
  try {
    const { id, status } = await req.json();
    if (!id) {
      return NextResponse.json(
        { error: "Invite ID required" },
        { status: 400 }
      );
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: any = { status };
    if (status === "accepted") updateData.acceptedAt = new Date();

    const invite = await withRetry(() =>
      db.betaInvite.update({ where: { id }, data: updateData })
    );

    return NextResponse.json({ invite });
  } catch (error: unknown) {
    logger.error("[BetaInvite PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update invite" },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"] }), { maxRequests: 10, windowSeconds: 60 });
