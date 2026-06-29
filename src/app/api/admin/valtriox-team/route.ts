import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getValtrioxInvitationHtml, generateWhatsAppInviteLink, generateInvitationPlainText } from "@/lib/email-templates";

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Support", "Operations", "Finance", "Design", "Management"];

const VALTROIX_ROLES = [
  { name: "platform_owner", label: "Platform Owner", description: "Full access to everything - the Valtriox portal owner" },
  { name: "platform_admin", label: "Platform Admin", description: "Full access except platform settings modification" },
  { name: "platform_engineer", label: "Platform Engineer", description: "Engineering access - can manage code, infrastructure, and technical operations" },
  { name: "platform_support", label: "Platform Support", description: "Support access - can manage client support tickets and conversations" },
  { name: "platform_sales", label: "Platform Sales", description: "Sales access - can manage clients, subscriptions, and payments" },
  { name: "platform_marketing", label: "Platform Marketing", description: "Marketing access - can manage content, campaigns, and SEO" },
];

// GET: List all Valtriox team members + pending invitations
export const GET = withAuth(async (req, authCtx) => {
  try {
    const members = await withRetry(async () => {
      return await db.valtrioxTeamMember.findMany({
      orderBy: { createdAt: "asc" },
    })
    }, 2, 500);

    const invitations = await withRetry(async () => {
      return await db.valtrioxTeamInvitation.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    // Filter out expired invitations
    const now = new Date();
    const pendingInvitations = invitations.filter(inv => new Date(inv.expiresAt) > now);

    return NextResponse.json({ members, invitations: pendingInvitations, departments: DEPARTMENTS, roles: VALTROIX_ROLES });
  } catch (error: any) {
    console.error("[Valtriox Team] GET error:", error?.message);
    return NextResponse.json(
      { error: "Failed to fetch team data", details: process.env.NODE_ENV === "production" ? undefined : error?.message },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

// POST: Invite new team member
export const POST = withAuth(async (req, authCtx) => {
  try {
    const body = await req.json();
    const { name, email, role, department, phone } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    if (department && !DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` }, { status: 400 });
    }

    const validRoles = VALTROIX_ROLES.map(r => r.name);
    const selectedRole = role || "platform_admin";
    if (!validRoles.includes(selectedRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Check if already a member
    const existingMember = await withRetry(async () => {
      return await db.valtrioxTeamMember.findFirst({
      where: { email: email.toLowerCase() },
    })
    }, 2, 500);
    if (existingMember) {
      return NextResponse.json({ error: "This person is already a Valtriox team member" }, { status: 409 });
    }

    // Check if already has a pending invitation
    const existingInvitation = await withRetry(async () => {
      return await db.valtrioxTeamInvitation.findFirst({
      where: { email: email.toLowerCase(), status: "pending" },
    })
    }, 2, 500);
    if (existingInvitation) {
      return NextResponse.json({ error: "A pending invitation already exists for this email" }, { status: 409 });
    }

    // Generate 6-digit PIN token — SECURITY: Use crypto.randomInt() instead of Math.random()
    const token = (100000 + crypto.randomInt(900000)).toString();

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await withRetry(async () => {
      return await db.valtrioxTeamInvitation.create({
      data: {
        name,
        email: email.toLowerCase(),
        role: selectedRole,
        department: department || null,
        invitedBy: authCtx.userId,
        token,
        expiresAt,
      },
    })
    }, 2, 500);

    // ── Send professional email ──
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
    const joinUrl = `${baseUrl}/valtriox-join?token=${token}`;
    const roleLabel = VALTROIX_ROLES.find(r => r.name === selectedRole)?.label || selectedRole;
    const inviterName = authCtx.email?.split('@')[0] || 'Valtriox Admin';

    let emailSent = false;
    try {
      const html = getValtrioxInvitationHtml({
        inviteeName: name,
        inviteeEmail: email.toLowerCase(),
        role: roleLabel,
        department: department || undefined,
        token,
        joinUrl,
        expiresAt: expiresAt.toISOString(),
        inviterName,
        platformName: "Valtriox",
        platformWebsite: "https://valtriox.com",
        supportEmail: "ashir@valtriox.com",
      });

      emailSent = await sendEmail({
        to: email.toLowerCase(),
        subject: `You're Invited to Join Valtriox - ${roleLabel}`,
        html,
      });
    } catch (emailErr: any) {
      console.warn("[Valtriox Team] Email send failed:", emailErr?.message);
    }

    // ── Generate WhatsApp link (if phone provided) ──
    let whatsappLink: string | null = null;
    if (phone) {
      whatsappLink = generateWhatsAppInviteLink(phone, {
        inviterName,
        inviteeName: name,
        role: roleLabel,
        department: department || undefined,
        token,
        joinUrl,
        platformName: "Valtriox",
      });
    }

    // ── Generate plain text invitation (for manual sharing) ──
    const plainTextInvite = generateInvitationPlainText({
      inviteeName: name,
      role: roleLabel,
      department: department || undefined,
      token,
      joinUrl,
      expiresAt: expiresAt.toISOString(),
      inviterName,
      platformName: "Valtriox",
      supportEmail: "ashir@valtriox.com",
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        joinUrl,
      },
      emailSent,
      emailConfigured: isEmailConfigured(),
      whatsappLink,
      plainTextInvite,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[Valtriox Team] POST error:", error?.message);
    return NextResponse.json(
      { error: "Failed to create invitation", details: process.env.NODE_ENV === "production" ? undefined : error?.message },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

// DELETE: Revoke invitation
export const DELETE = withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("invitationId");

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    await withRetry(async () => {
      return await db.valtrioxTeamInvitation.update({
      where: { id: invitationId },
      data: { status: "revoked" },
    })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Valtriox Team] DELETE error:", error?.message);
    return NextResponse.json(
      { error: "Failed to revoke invitation", details: process.env.NODE_ENV === "production" ? undefined : error?.message },
      { status: 500 }
    );
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });
