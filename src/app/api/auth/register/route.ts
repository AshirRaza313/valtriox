import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sanitizeEmail, sanitizeString, validatePassword } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/validations";
import { z } from "zod";
import { getAdminEmail } from "@/lib/roles";

// Phase 5: Password length/complexity is solely handled by validatePassword()
// Zod only validates that password is a non-empty string (structural check)
const registerBodySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be 100 characters or less"),
  email: z.string().email("Invalid email address").max(254),
  password: z.string().min(1, "Password is required").max(128, "Password must be 128 characters or less"),
  brandName: z.string().min(2, "Brand name must be at least 2 characters").max(100, "Brand name must be 100 characters or less"),
});

export const POST = withRateLimit(async (req: NextRequest) => {
  // Phase 3: Zod validation replaces all manual if(!field) checks
  const result = await validateBody(req, registerBodySchema);
  if (!result.success) return result.response;
  const { name, email, password, brandName } = result.data;

  // Sanitize inputs (Zod validates structure, sanitize strips XSS/HTML)
  const cleanName = sanitizeString(name);
  const cleanEmail = sanitizeEmail(email);
  const cleanBrandName = sanitizeString(brandName);

  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
  }

  const existingUser = await withRetry(async () => {
    return await db.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
  }, 2, 500);
  if (existingUser) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const existingOrg = await withRetry(async () => {
    return await db.organization.findUnique({ where: { slug: cleanBrandName.toLowerCase().replace(/\s+/g, "-") }, select: { id: true } });
  }, 2, 500);
  if (existingOrg) {
    return NextResponse.json({ error: "Brand name already taken" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const slug = cleanBrandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // Phase 5: Use getAdminEmail() helper instead of inline process.env access
  const adminEmail = getAdminEmail();
  const isAdmin = adminEmail && cleanEmail === adminEmail;
  const assignedRole = isAdmin ? "platform_owner" : "brand_owner";

  // FIX 2.2: Wrap all creation in a single transaction to prevent partial writes
  let user: { id: string; name: string | null; email: string; role: string };
  let organization: { id: string; name: string; slug: string };

  try {
    const txResult = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: assignedRole,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      const newOrg = await tx.organization.create({
        data: {
          name: cleanBrandName,
          slug,
          email: cleanEmail,
          currency: "PKR",
        },
        select: { id: true, name: true, slug: true },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: newOrg.id,
          userId: newUser.id,
          role: assignedRole,
        },
        select: { id: true },
      });

      return { user: newUser, organization: newOrg };
    });

    user = txResult.user;
    organization = txResult.organization;
  } catch (txError: unknown) {
    const msg = txError instanceof Error ? txError.message : String(txError);
    // Handle unique constraint violations gracefully
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Email or brand name already registered" }, { status: 400 });
    }
    throw txError;
  }

  logger.info("New user registered", { userId: user.id, email: cleanEmail, role: assignedRole, orgName: cleanBrandName });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    organization: { id: organization.id, name: organization.name },
  });
}, { maxRequests: 3, windowSeconds: 60 });
