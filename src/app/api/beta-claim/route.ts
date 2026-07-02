import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sanitizeEmail, sanitizeString, validatePassword } from "@/lib/sanitize";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

// ═══════════════════════════════════════════════════════════════
//  Inline schemas for beta-claim actions
// ═══════════════════════════════════════════════════════════════
const betaVerifySchema = z.object({
  action: z.literal("verify"),
  email: z.string().email().max(254),
  code: z.string().min(1).max(100),
});

const betaAcceptSchema = z.object({
  action: z.literal("accept"),
  email: z.string().email().max(254),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  brandName: z.string().min(1).max(200),
});

const betaClaimSchema = z.discriminatedUnion("action", [betaVerifySchema, betaAcceptSchema]);
import logger from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════
//  Public API: /api/beta-claim
//  Actions:
//    action=verify — Check if email+code matches a valid BetaInvite
//    action=accept — Create user + org + member, mark invite as accepted
// ═══════════════════════════════════════════════════════════════

async function findBetaInvite(email: string, token: string) {
  return withRetry(async () => {
    return await db.betaInvite.findFirst({
      where: { email: email.toLowerCase(), token, status: "sent" },
    });
  }, 2, 500);
}

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const bodyResult = await validateBody(req, betaClaimSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { action, email, code } = bodyResult.data;

    // ── ACTION: VERIFY ──
    if (action === "verify") {

      const invite = await findBetaInvite(email, code);

      if (!invite) {
        return NextResponse.json(
          { error: "Invalid or expired invitation. Please contact us for a new invitation." },
          { status: 404 }
        );
      }

      // Check expiry
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        // Auto-expire
        await withRetry(async () => {
          return await db.betaInvite.update({
            where: { id: invite.id },
            data: { status: "expired" },
          });
        }, 2, 500);
        return NextResponse.json(
          { error: "This invitation has expired. Please contact us for a new invitation." },
          { status: 410 }
        );
      }

      // Get platform settings for branding
      let platformName = "Valtriox";
      try {
        const settings: any = await db.platformSettings.findFirst();
        if (settings?.companyName) platformName = settings.companyName;
      } catch {}

      return NextResponse.json({
        valid: true,
        plan: invite.plan,
        trialDays: invite.trialDays,
        expiresAt: invite.expiresAt,
        platformName,
      });
    }

    // ── ACTION: ACCEPT ──
    if (action === "accept") {
      const { name, password, brandName } = bodyResult.data;

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
      }

      // Verify invite is still valid
      const invite = await findBetaInvite(email, code);
      if (!invite) {
        return NextResponse.json(
          { error: "Invalid or expired invitation." },
          { status: 404 }
        );
      }

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        await withRetry(async () => {
          return await db.betaInvite.update({
            where: { id: invite.id },
            data: { status: "expired" },
          });
        }, 2, 500);
        return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
      }

      // Sanitize inputs
      const cleanEmail = sanitizeEmail(email);
      const cleanName = sanitizeString(name);
      const cleanBrandName = sanitizeString(brandName);

      // Check if user already exists
      const existingUser = await withRetry(async () => {
        return await db.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
      }, 2, 500);

      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }

      // Check if brand slug is taken
      const slug = cleanBrandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const existingOrg = await withRetry(async () => {
        return await db.organization.findUnique({ where: { slug }, select: { id: true } });
      }, 2, 500);
      if (existingOrg) {
        return NextResponse.json({ error: "Brand name already taken. Try a different name." }, { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user with brand_owner role
      const user = await withRetry(async () => {
        return await db.user.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            role: "brand_owner",
          },
          select: { id: true, name: true, email: true, role: true },
        });
      }, 2, 500);

      // Create organization with the invited plan
      const organization = await withRetry(async () => {
        return await db.organization.create({
          data: {
            name: cleanBrandName,
            slug,
            email: cleanEmail,
            currency: "PKR",
            plan: invite.plan,
            isActive: true,
          },
          select: { id: true, name: true, slug: true, plan: true },
        });
      }, 2, 500);

      // Create organization member
      await withRetry(async () => {
        return await db.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: "brand_owner",
          },
          select: { id: true },
        });
      }, 2, 500);

      // Mark invite as accepted
      await withRetry(async () => {
        return await db.betaInvite.update({
          where: { id: invite.id },
          data: { status: "accepted", acceptedAt: new Date() },
        });
      }, 2, 500);

      return NextResponse.json({
        success: true,
        message: `Welcome to Valtriox, ${cleanName}! Your ${invite.plan} account is now active.`,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        organization: { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan },
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'verify' or 'accept'." }, { status: 400 });
  } catch (error: unknown) {
    logger.error("[BetaClaim] Error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}, { maxRequests: 5, windowSeconds: 60 });
