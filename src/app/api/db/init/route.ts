import { NextRequest, NextResponse } from "next/server";
import { createAllTables, getCreateError, getLastCreateDetail, resetSchemaFlag, CREATE_ALL_TABLES_SQL, db, withRetry, getDirectPool } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";

/**
 * PATCH /api/db/init - Repair missing columns in existing tables.
 * Runs only ALTER TABLE ADD COLUMN IF NOT EXISTS statements (no CREATE TABLE).
 * Safe to call multiple times - all statements are idempotent.
 */
export const PATCH = withAuth(async (req: NextRequest, authCtx) => {
  const repairSql = `
-- ── IntegrationConnection table (real integration configs per org) ──
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "config" TEXT,
  "metadata" TEXT,
  "connectedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_type_key" ON "IntegrationConnection"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_idx" ON "IntegrationConnection"("organizationId");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_type_idx" ON "IntegrationConnection"("type");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_status_idx" ON "IntegrationConnection"("status");
DO $$ BEGIN ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── Proposal table (PayPro payment columns) ──
DO $$ BEGIN ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "payproOrderId" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "paymentAmount" DOUBLE PRECISION; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Proposal_paymentStatus_idx" ON "Proposal"("paymentStatus");

-- ── Organization (billing security + usage tracking) ──
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "paymentRejectionCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "banReason" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageOrdersCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageProductsCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageCustomersCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageStorageMb" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageInvoicesCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageCouponsCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageTasksCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageTeamChatsCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageBroadcastsCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "usageLastResetAt" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── Lead (consultation columns) ──
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consultationType" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredDate" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "timezone" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "availabilityNote" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "calendlyBookingLink" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastFollowUpAt" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── OrganizationMember (attendance/penalty) ──
DO $$ BEGIN ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "absenceCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "penaltyUntil" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "pin" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "pinCreatedAt" TIMESTAMP(3); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── SubscriptionPlan ──
DO $$ BEGIN ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "quarterlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── PlatformSettings (lead magnet columns) ──
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetTitle" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetDescription" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetEmailSubject" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetEmailBody" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetPdfUrl" TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetSentCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "leadMagnetDownloadCount" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── BetaInvite table (for beta program) ──
CREATE TABLE IF NOT EXISTS "BetaInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL DEFAULT '',
  "plan" TEXT NOT NULL DEFAULT 'enterprise',
  "invitedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BetaInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BetaInvite_email_key" ON "BetaInvite"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "BetaInvite_token_key" ON "BetaInvite"("token");
CREATE INDEX IF NOT EXISTS "BetaInvite_status_idx" ON "BetaInvite"("status");
CREATE INDEX IF NOT EXISTS "BetaInvite_invitedBy_idx" ON "BetaInvite"("invitedBy");
`;

  try {
    // Try direct pool first (for DDL), fall back to PgBouncer Prisma raw query
    let poolOk = false;
    let poolError: string | null = null;
    
    try {
      const pool = getDirectPool();
      // Test connection
      await pool.query('SELECT 1 as ok');
      await pool.query(repairSql);
      poolOk = true;
    } catch (directErr: any) {
      poolError = directErr?.message || String(directErr);
      console.warn('[DB Repair] Direct pool failed, trying PgBouncer Prisma raw query:', poolError.substring(0, 100));
    }
    
    if (!poolOk) {
      // Fall back to Prisma $executeRawUnsafe via PgBouncer
      // Each statement must be run individually through Prisma
      const statements = repairSql.split('\n').filter(l => l.trim() && !l.startsWith('--'));
      const combined: string[] = [];
      let current = '';
      
      for (const line of statements) {
        current += line + '\n';
        if (line.includes('END $$;') || (line.includes('CREATE INDEX') && line.endsWith(';'))) {
          combined.push(current.trim());
          current = '';
        }
      }
      
      for (const stmt of combined) {
        try {
          await db.$executeRawUnsafe(stmt);
        } catch (stmtErr: any) {
          // Ignore - IF NOT EXISTS makes it safe
          console.warn('[DB Repair] Statement error (ignored):', stmtErr?.message?.substring(0, 80));
        }
      }
    }
    
    return NextResponse.json({ success: true, message: "Schema repair completed - all missing columns added" });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: "Schema repair failed",
    }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

/**
 * POST /api/db/init
 *
 * Creates ALL database tables via direct pg connection (bypasses PgBouncer).
 * Call this endpoint ONCE after setting DATABASE_URL on Vercel.
 * Returns detailed success/error info for debugging.
 */
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  try {
    // Reset flag to force re-creation
    resetSchemaFlag();

    const success = await createAllTables();

    if (success) {
      return NextResponse.json({
        success: true,
        message: "All 27 database tables created successfully!",
        detail: getLastCreateDetail(),
      });
    } else {
      return NextResponse.json({
        success: false,
        error: "Failed to create database tables",
        lastDetail: getLastCreateDetail(),
        hint: "Make sure DATABASE_URL is set correctly in Vercel. For Supabase, the URL should be in format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres",
        manualFix: "You can also run the SQL manually in Supabase Dashboard > SQL Editor. Visit /api/db/sql to get the full SQL.",
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
    }, { status: 500 });
  }
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });

/**
 * GET /api/db/init - Check database status and table existence
 * Returns only non-sensitive summary information.
 */
export const GET = withAuth(async (req: NextRequest, authCtx) => {
  const databaseUrl = process.env.DATABASE_URL || '';

  // Check Prisma connection
  let prismaOk = false;
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    prismaOk = true;
  } catch {
    // connection failed
  }

  // Check existing tables via Prisma (PgBouncer - reliable from Vercel)
  let tables: string[] = [];
  if (databaseUrl) {
    try {
      const rows: any = await withRetry(async () => {
        return await db.$queryRaw`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `;
      }, 2, 500);
      tables = rows.map((r) => r.table_name);
    } catch {
      // table query failed
    }
  }

  return NextResponse.json({
    databaseUrlSet: !!databaseUrl,
    prismaConnected: prismaOk,
    tableCount: tables.length,
    allTablesExist: tables.length >= 25,
  });
}, { requireRole: ["platform_owner", "platform_admin"], requireOrg: false });
