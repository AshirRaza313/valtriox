import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sanitizeEmail, validatePassword } from "@/lib/sanitize";
import { withRateLimit } from "@/lib/rate-limit";
import { validateBody, resetPasswordSchema } from "@/lib/validations";
import { z } from "zod";
import logger from "@/lib/logger";

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    // Phase 3: Zod validation
    const bodyResult = await validateBody(req, resetPasswordSchema.extend({ resetToken: z.string().min(1) }));
    if (!bodyResult.success) return bodyResult.response;
    const { email: rawEmail, otp: resetToken, newPassword } = bodyResult.data;

    const email = sanitizeEmail(rawEmail);

    // Validate password strength
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    // Verify the reset token
    const resetIdentifier = `password-confirmed:${email}`;
    const record = await db.verificationToken.findUnique({
      where: { identifier_token: { identifier: resetIdentifier, token: resetToken } },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired reset session. Please start over." }, { status: 400 });
    }

    if (new Date() > record.expires) {
      await db.verificationToken.delete({ where: { identifier_token: { identifier: resetIdentifier, token: resetToken } } });
      return NextResponse.json({ error: "This reset session has expired. Please request a new OTP." }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // Delete the reset token (one-time use)
    await db.verificationToken.delete({ where: { identifier_token: { identifier: resetIdentifier, token: resetToken } } });

    // Also delete any remaining password-reset OTPs for this email (cleanup)
    await db.verificationToken.deleteMany({ where: { identifier: `password-reset:${email}` } });

    logger.info(`[ResetPassword] Password updated for ${email}`);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (err: unknown) {
    logger.error("[ResetPassword] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, { maxRequests: 3, windowSeconds: 60 });
