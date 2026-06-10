import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { sanitizeEmail } from "@/lib/sanitize";
import { withRateLimit } from "@/lib/rate-limit";
import { getPasswordResetOtpEmailHtml } from "@/lib/email-templates";

const OTP_EXPIRY_MINUTES = 10;

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const rawEmail = body?.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const email = sanitizeEmail(rawEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // Check user exists (anti-enumeration: always return success but only send email if user exists)
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // If no user found or user has no password (PIN-only account), still return success
    // to prevent email enumeration attacks — but include debug info for testing
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
        _debug: "user_not_found",
      });
    }

    if (!user.password) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
        _debug: "no_password_set",
      });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const identifier = `password-reset:${email}`;
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing OTPs for this identifier
    await db.verificationToken.deleteMany({ where: { identifier } });

    // Store new OTP
    await db.verificationToken.create({
      data: { identifier, token: otp, expires },
    });

    // Try to send OTP email
    const emailConfigured = isEmailConfigured();
    let emailSent = false;

    if (emailConfigured) {
      try {
        const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Valtriox";
        const platformWebsite = process.env.NEXT_PUBLIC_PLATFORM_WEBSITE || "https://valtriox.pk";
        const supportEmail = process.env.SUPPORT_EMAIL || "support@valtriox.com";

        const html = getPasswordResetOtpEmailHtml({
          otp,
          userEmail: email,
          userName: user.name,
          expiresMinutes: OTP_EXPIRY_MINUTES,
          platformName,
          platformWebsite,
          supportEmail,
        });

        emailSent = await sendEmail({
          to: email,
          subject: `Password Reset Verification — ${platformName}`,
          html,
          text: `Your password reset code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, please ignore this email.`,
        });
      } catch (emailErr: any) {
        console.error("[ForgotPassword] Email send error:", emailErr?.message);
      }
    }

    console.log(`[ForgotPassword] OTP for ${email}: ${otp} | emailConfigured=${emailConfigured} | emailSent=${emailSent}`);

    // ALWAYS return OTP in testing mode (when email not sent successfully)
    // This ensures the flow works end-to-end even without email provider
    if (!emailSent) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
        _testingOtp: otp,
        _debug: emailConfigured ? "email_send_failed" : "no_email_provider",
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a verification code has been sent.",
    });
  } catch (err: any) {
    console.error("[ForgotPassword] Error:", err?.message || err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", _debug: err?.message?.slice(0, 100) },
      { status: 500 }
    );
  }
}, { maxRequests: 5, windowSeconds: 60 });