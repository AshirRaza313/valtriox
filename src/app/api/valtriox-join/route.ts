import { NextRequest, NextResponse } from "next/server";
import { db, withRetry} from "@/lib/db";
import bcrypt from "bcryptjs";
import { withRateLimit } from "@/lib/rate-limit";
import { sanitizeObject, sanitizeEmail } from "@/lib/sanitize";
import { z } from "zod";

// ── Input validation schemas ──
const verifySchema = z.object({
  action: z.literal("verify"),
  email: z.string().email().max(254),
  token: z.string().min(1).max(128),
});

const acceptSchema = z.object({
  action: z.literal("accept"),
  email: z.string().email().max(254),
  token: z.string().min(1).max(128),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

const joinActionSchema = z.discriminatedUnion("action", [verifySchema, acceptSchema]);

// POST: Accept Valtriox team invitation
// SECURITY: Rate-limited to prevent brute-force token guessing
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const rawBody = await req.json();
    const sanitizedBody = sanitizeObject(rawBody);

    // Validate input with Zod
    const parseResult = joinActionSchema.safeParse(sanitizedBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.issues.map(i => i.message).join(", ") },
        { status: 400 }
      );
    }

    const body = parseResult.data;
    const { action, email, token } = body;

    // ── ACTION: VERIFY ──
    if (action === "verify") {
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
      // Zod already validated: email, token, name, password

      const invitation = await withRetry(async () => {
        return await db.valtrioxTeamInvitation.findFirst({
        where: {
          email: sanitizeEmail(email).toLowerCase(),
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

      const existingUser = await withRetry(async () => {
        return await db.user.findUnique({
        where: { email: sanitizeEmail(email).toLowerCase() },
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
            email: sanitizeEmail(email).toLowerCase(),
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
          email: sanitizeEmail(email).toLowerCase(),
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
      { error: "Failed to process invitation" },
      { status: 500 }
    );
  }
}, { maxRequests: 5, windowSeconds: 60 });
