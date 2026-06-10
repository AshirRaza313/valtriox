import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeEmail } from "@/lib/sanitize";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const rawEmail = body?.email;
    const rawOtp = body?.otp;

    if (!rawEmail || !rawOtp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    const email = sanitizeEmail(rawEmail);
    const otp = String(rawOtp).trim();

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP must be exactly 6 digits" }, { status: 400 });
    }

    const identifier = `password-reset:${email}`;

    // Find the token
    const record = await db.verificationToken.findUnique({
      where: { identifier_token: { identifier, token: otp } },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
    }

    // Check expiry
    if (new Date() > record.expires) {
      // Delete expired token
      await db.verificationToken.delete({ where: { identifier_token: { identifier, token: otp } } });
      return NextResponse.json({ error: "This code has expired. Please request a new one." }, { status: 400 });
    }

    // OTP is valid — delete it (one-time use)
    await db.verificationToken.delete({ where: { identifier_token: { identifier, token: otp } } });

    // Generate a short-lived reset token (15 min) for the password reset step
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetIdentifier = `password-confirmed:${email}`;

    // Delete any existing reset tokens
    await db.verificationToken.deleteMany({ where: { identifier: resetIdentifier } });

    await db.verificationToken.create({
      data: {
        identifier: resetIdentifier,
        token: resetToken,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      resetToken,
      message: "OTP verified successfully.",
    });
  } catch (err: any) {
    console.error("[VerifyOTP] Error:", err?.message || err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, { maxRequests: 10, windowSeconds: 60 });
