import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import bcrypt from "bcryptjs";

// POST: Accept Valtriox team invitation (public - no auth required)
// Actions:
//   action=verify - Check if email+token is valid and return invite details
//   action=accept - Create user account (if needed) and add to Valtriox team
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, token } = body;

    // ── ACTION: VERIFY ──
    if (action === "verify") {
      if (!email || !token) {
        return NextResponse.json(
          { error: "Email and token are required" },
          { status: 400 }
        );
      }

      const invitation = await withRetry(async () => {
        return await db.valtrioxTeamInvitation.findFirst({
        where: {
          email: email.toLowerCase(),
          token,
          status: "pending",
        },
      })
      }, 2, 500);

      if (!invitation) {
        return NextResponse.json(
          { error: "Invalid or expired invitation. Please contact the team for a new invitation." },
          { status: 404 }
        );
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        await withRetry(async () => {
          return await db.valtrioxTeamInvitation.update({
          where: { id: invitation.id },
          data: { status: "expired" },
        })
        }, 2, 500);
        return NextResponse.json(
          { error: "This invitation has expired. Please contact the team for a new invitation." },
          { status: 410 }
        );
      }

      return NextResponse.json({
        valid: true,
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        expiresAt: invitation.expiresAt,
      });
    }

    // ── ACTION: ACCEPT ──
    if (action === "accept") {
      const { name, password } = body;

      // Validate required fields
      if (!email || !token || !name) {
        return NextResponse.json(
          { error: "Email, token, and name are required" },
          { status: 400 }
        );
      }

      if (!password || password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      // Find pending invitation
      const invitation = await withRetry(async () => {
        return await db.valtrioxTeamInvitation.findFirst({
        where: {
          email: email.toLowerCase(),
          token,
          status: "pending",
        },
      })
      }, 2, 500);

      if (!invitation) {
        return NextResponse.json(
          { error: "Invalid or expired invitation. Please contact the team for a new invitation." },
          { status: 404 }
        );
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        await withRetry(async () => {
          return await db.valtrioxTeamInvitation.update({
          where: { id: invitation.id },
          data: { status: "expired" },
        })
        }, 2, 500);
        return NextResponse.json(
          { error: "This invitation has expired. Please contact the team for a new invitation." },
          { status: 410 }
        );
      }

      // Check if user already exists - if so, use their account
      const existingUser = await withRetry(async () => {
        return await db.user.findUnique({
        where: { email: email.toLowerCase() },
      })
      }, 2, 500);

      let userId: string;

      if (existingUser) {
        // User exists - verify password matches
        const passwordMatch = await bcrypt.compare(password, existingUser.password || "");
        if (!passwordMatch) {
          return NextResponse.json(
            { error: "An account with this email already exists but the password does not match. Please use the correct password." },
            { status: 403 }
          );
        }
        userId = existingUser.id;
      } else {
        // Create new user account (no organization needed - platform-level member)
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await withRetry(async () => {
          return await db.user.create({
          data: {
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            role: invitation.role,
          },
        })
        }, 2, 500);
        userId = newUser.id;
      }

      // Check if already a Valtriox team member
      const existingMember = await withRetry(async () => {
        return await db.valtrioxTeamMember.findFirst({
        where: { userId },
      })
      }, 2, 500);
      if (existingMember) {
        return NextResponse.json(
          { error: "You are already a Valtriox team member" },
          { status: 409 }
        );
      }

      // Mark invitation as accepted
      await withRetry(async () => {
        return await db.valtrioxTeamInvitation.update({
        where: { id: invitation.id },
        data: { status: "accepted", acceptedAt: new Date() },
      })
      }, 2, 500);

      // Create Valtriox team member
      const member = await withRetry(async () => {
        return await db.valtrioxTeamMember.create({
        data: {
          userId,
          email: email.toLowerCase(),
          name: name.trim(),
          role: invitation.role,
          department: invitation.department,
          status: "active",
          invitedBy: invitation.invitedBy,
        },
      })
      }, 2, 500);

      // Update the User's role to match the invitation
      try {
        await withRetry(async () => {
          return await db.user.update({
          where: { id: userId },
          data: { role: invitation.role },
        })
        }, 2, 500);
      } catch (err: any) {
        console.warn("[Valtriox Join] Could not update User role:", err?.message);
      }

      return NextResponse.json({
        success: true,
        message: `Welcome to the Valtriox team, ${name.trim()}!`,
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          department: member.department,
        },
      });
    }

    // ── NO VALID ACTION ──
    return NextResponse.json(
      { error: "Invalid action. Use 'verify' or 'accept'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Valtriox Join] POST error:", error?.message);
    return NextResponse.json(
      { error: "Failed to process invitation", details: process.env.NODE_ENV === "production" ? undefined : error?.message },
      { status: 500 }
    );
  }
}
