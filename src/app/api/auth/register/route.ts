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

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
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

    const user = await withRetry(async () => {
      return await db.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: assignedRole,
      },
      select: { id: true, name: true, email: true, role: true },
    })
    }, 2, 500);

    logger.info("New user registered", { userId: user.id, email: cleanEmail, role: assignedRole, orgName: cleanBrandName });

    const organization = await withRetry(async () => {
      return await db.organization.create({
      data: {
        name: cleanBrandName,
        slug,
        email: cleanEmail,
        currency: "PKR",
      },
      select: { id: true, name: true, slug: true },
    })
    }, 2, 500);

    await withRetry(async () => {
      return await db.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: assignedRole,
      },
      select: { id: true },
    })
    }, 2, 500);

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
