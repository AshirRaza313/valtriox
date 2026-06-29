import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, withRetry} from "@/lib/db";
import bcrypt from "bcryptjs";
import { sanitizeEmail, sanitizeString, validatePassword } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, email, password, brandName } = body;

    if (!name || !email || !password || !brandName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Input length validation
    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
    }
    if (brandName.length > 100) {
      return NextResponse.json({ error: "Brand name must be 100 characters or less" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be between 8 and 128 characters" }, { status: 400 });
    }

    // Sanitize inputs
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeEmail(email);
    const cleanBrandName = sanitizeString(brandName);

    // Validate password strength (FIX 5.4: removed duplicate password.length check below)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    // Check database connectivity
    try {
      await ensureDb();
    } catch (dbErr: any) {
      const errMsg = dbErr?.message || String(dbErr);
      console.error("Database connection error:", errMsg);
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "Database not configured.", code: "DB_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Database connection failed.", code: "DB_ERROR" },
        { status: 503 }
      );
    }

    const existingUser = await withRetry(async () => {
      return await db.user.findUnique({ where: { email: cleanEmail }, select: { id: true } })
    }, 2, 500);
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const existingOrg = await withRetry(async () => {
      return await db.organization.findUnique({ where: { slug: cleanBrandName.toLowerCase().replace(/\s+/g, "-") }, select: { id: true } })
    }, 2, 500);
    if (existingOrg) {
      return NextResponse.json({ error: "Brand name already taken" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const slug = cleanBrandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Admin is determined by ADMIN_EMAIL environment variable
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const isAdmin = adminEmail && cleanEmail === adminEmail;
    const assignedRole = isAdmin ? "platform_owner" : "brand_owner";

    // FIX 2.2: Wrap all creation in a single transaction to prevent partial writes
    let user: { id: string; name: string | null; email: string; role: string };
    let organization: { id: string; name: string; slug: string };

    try {
      const result = await db.$transaction(async (tx) => {
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

      user = result.user;
      organization = result.organization;
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
  } catch (error: any) {
    logger.error("Register error", error, { email: body?.email });
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}, { maxRequests: 3, windowSeconds: 60 });
