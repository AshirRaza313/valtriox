import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { sanitizeEmail } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { getPasswordResetOtpEmailHtml } from "@/lib/email-templates";
import { validateBody, forgotPasswordSchema } from "@/lib/validations";

const OTP_EXPIRY_MINUTES = 10;

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const bodyResult = await validateBody(req, forgotPasswordSchema);
    if (!bodyResult.success) return bodyResult.response;
    const { email: rawEmail } = bodyResult.data;

    const email = sanitizeEmail(rawEmail);

    // Anti-enumeration: always return success regardless of whether user exists
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // FIX 1.1: Remove _debug field — never expose internal state to client
    if (!user || !user.password) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a verification code has been sent.",
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const identifier = `password-reset:${email}`;
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.verificationToken.deleteMany({ where: { identifier } });
    await db.verificationToken.create({
      data: { identifier, token: otp, expires },
    });

    const emailConfigured = isEmailConfigured();
    let emailSent = false;

    if (emailConfigured) {
      try {
        const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Valtriox";
        const platformWebsite = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://valtriox.com";
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
      } catch (emailErr: unknown) {
        const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        logger.error("[ForgotPassword] Email send error:", msg);
      }
    }

    // Phase 4: OTP is NEVER logged — not even in development
    // Previously this was logged with NODE_ENV check but staging environments
    // may have NODE_ENV=production while still exposing Vercel logs to team.
    // Use logger.info for audit trail without exposing the OTP value.
    logger.info("OTP generated and email send attempted", { email, emailSent });

    // FIX 1.1: NEVER return OTP in response — not even in testing mode
    // If email is not configured, tell the user to check server logs
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a verification code has been sent.",
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[ForgotPassword] Error:", msg);
    // FIX: Never expose internal error details to client
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}, { maxRequests: 5, windowSeconds: 60 });
