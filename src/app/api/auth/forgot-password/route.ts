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
    // to prevent email enumeration attacks
    if (!user || !user.password) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
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

    // Send OTP email
    const emailConfigured = isEmailConfigured();
    if (emailConfigured) {
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

      await sendEmail({
        to: email,
        subject: `Password Reset Verification — ${platformName}`,
        html,
        text: `Your password reset code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, please ignore this email.`,
      });
    }

    console.log(`[ForgotPassword] OTP generated for ${email}${emailConfigured ? ' (email sent)' : ' (email NOT configured - check RESEND_API_KEY)'}`);

    // When email is not configured (testing/development), return OTP in response
    // so the flow can be tested end-to-end without email provider setup.
    // SECURITY: This only activates when NO email provider is configured at all.
    if (!emailConfigured) {
      console.log(`[ForgotPassword/TESTING] OTP for ${email}: ${otp}`);
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
        _testingOtp: otp,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a verification code has been sent.",
    });
  } catch (err: any) {
    console.error("[ForgotPassword] Error:", err?.message || err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, { maxRequests: 3, windowSeconds: 60 });
