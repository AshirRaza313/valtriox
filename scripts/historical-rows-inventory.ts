import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { execSync } from "child_process";

// ============================================================================
// Historical Notification Inventory — Protected Read-Only Audit
// ============================================================================
// Modes:
//   AUDIT_MODE=ci-smoke  → disposable CI Postgres, empty data allowed
//   AUDIT_MODE=real      → real read-only DB, empty data FORBIDDEN,
//                          PG version must match PG_EXPECTED_VERSION
// Default: ci-smoke (backward compatible)
// ============================================================================

const AUDIT_MODE = (process.env.AUDIT_MODE || "ci-smoke").toLowerCase();
const IS_REAL_AUDIT = AUDIT_MODE === "real";

const readonlyUrl = process.env.DATABASE_URL_READONLY;
if (!readonlyUrl) {
  console.error("ERROR: DATABASE_URL_READONLY is required. Refusing to run with default DATABASE_URL.");
  process.exit(1);
}

const pgExpectedVersion = process.env.PG_EXPECTED_VERSION;

// Expected target identity — required in real mode
const expectedHost = process.env.PG_EXPECTED_HOST;           // e.g., aws-1-ap-south-1.pooler.supabase.com
const expectedPort = process.env.PG_EXPECTED_PORT || "5432";
const expectedDatabase = process.env.PG_EXPECTED_DATABASE || "postgres";
if (IS_REAL_AUDIT && !pgExpectedVersion) {
  console.error("ERROR: PG_EXPECTED_VERSION is required in AUDIT_MODE=real. Refusing to run without version assertion.");
  process.exit(1);
}
if (IS_REAL_AUDIT && !expectedHost) {
  console.error("ERROR: PG_EXPECTED_HOST is required in AUDIT_MODE=real. Refusing to run without target host assertion.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: readonlyUrl } } });

function sanitizeOrgId(orgId: string | null): string {
  if (!orgId) return "null";
  return orgId.slice(0, 8) + "...";
}

// ============================================================================
// Extract non-secret target identity from connection URL.
// Proves which database the audit actually ran against without exposing
// credentials.
// ============================================================================
function extractTargetFingerprint(url: string): {
  host: string;
  port: string;
  database: string;
  scheme: string;
  is_localhost: boolean;
  is_supabase_pooler: boolean;
} {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return {
      host,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, ""),
      scheme: parsed.protocol.replace(":", ""),
      is_localhost: host === "localhost" || host === "127.0.0.1" || host === "::1",
      is_supabase_pooler: /\.pooler\.supabase\.com$/i.test(host),
    };
  } catch {
    return {
      host: "unknown",
      port: "unknown",
      database: "unknown",
      scheme: "unknown",
      is_localhost: false,
      is_supabase_pooler: false,
    };
  }
}

// Compute a non-secret fingerprint hash for disclosure-safe verification.
// SHA-256 of host:port/database — deterministic, one-way, no PII.
function hashTargetIdentity(host: string, port: string, database: string): string {
  return crypto
    .createHash("sha256")
    .update(`${host}:${port}/${database}`)
    .digest("hex");
}

function computeScriptHash(): string {
  // Compute this script's source hash for independent harness verification.
  try {
    const content = fs.readFileSync(__filename);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return "unknown";
  }
}

const scriptSha256 = computeScriptHash();
const expectedScriptSha256 = process.env.EXPECTED_SCRIPT_SHA256;

if (IS_REAL_AUDIT && expectedScriptSha256 && expectedScriptSha256 !== scriptSha256) {
  console.error("ERROR: Script integrity check failed.");
  console.error(`  expected_script_sha256: ${expectedScriptSha256}`);
  console.error(`  actual_script_sha256:   ${scriptSha256}`);
  console.error("  The audit script has been modified since review.");
  process.exit(1);
}

async function main() {
  console.log(`Historical Notification Inventory (Read-Only Audit)`);
  console.log(`===================================================`);
  console.log(`Audit Mode: ${AUDIT_MODE}${IS_REAL_AUDIT ? " (STRICT)" : " (smoke)"}`);

  const nowIso = new Date().toISOString();
  const env = process.env.NODE_ENV || "development";

  const prHeadSha = process.env.PR_HEAD_SHA || "unknown";
  let actualGitSha = "unknown";
  try {
    actualGitSha = execSync("git rev-parse HEAD").toString().trim();
  } catch (e) {
    console.error("Warning: Could not verify checked-out HEAD SHA.", e);
  }

  if (prHeadSha !== "unknown" && prHeadSha !== actualGitSha) {
    console.error(
      `ERROR: PR_HEAD_SHA (${prHeadSha}) does not match checked-out HEAD (${actualGitSha}). Tampering or drift detected.`
    );
    process.exit(1);
  }

  const headSha = actualGitSha;
  console.log(`Timestamp: ${nowIso}`);
  console.log(`Environment: ${env}`);
  console.log(`Verified HEAD SHA: ${headSha}`);

  // ──────────────────────────────────────────────────────────────────────
  // SECURITY: Verify target identity BEFORE any database query.
  // Fail-closed: if expected host doesn't match, exit immediately.
  // Uses hash-based comparison — no raw host in logs/receipt.
  // ──────────────────────────────────────────────────────────────────────
  const targetFingerprint = extractTargetFingerprint(readonlyUrl!);
  const expectedHash = hashTargetIdentity(expectedHost!, expectedPort, expectedDatabase);
  const actualHash = hashTargetIdentity(
    targetFingerprint.host,
    targetFingerprint.port,
    targetFingerprint.database
  );

  if (IS_REAL_AUDIT) {
    if (expectedHash !== actualHash) {
      console.error("ERROR: Target identity mismatch. Refusing to proceed.");
      console.error(`  expected_hash: ${expectedHash}`);
      console.error(`  actual_hash:   ${actualHash}`);
      console.error("  (Full target details withheld from logs for security.)");
      process.exit(1);
    }
    console.log(`✅ Target identity verified (hash match: ${actualHash.slice(0, 16)}...)`);

    // Defense in depth: real audits must never use localhost.
    if (targetFingerprint.is_localhost) {
      console.error("ERROR: Real audit mode requires non-localhost target.");
      process.exit(1);
    }
  } else {
    console.log(`Target: ${targetFingerprint.host}:${targetFingerprint.port}/${targetFingerprint.database}`);
    console.log(`  is_localhost: ${targetFingerprint.is_localhost}`);
  }

  // ── Table-level write privilege check ───────────────────────────────────
  const tableWriteGrants = (await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name, p.privilege_type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_table_privilege(current_user, c.oid, p.privilege_type)
  `)) as any[];

  // ── Column-level write privilege check ──────────────────────────────────
  const columnWriteGrants = (await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name, a.attname AS column_name, p.privilege_type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('REFERENCES')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_column_privilege(current_user, c.oid, a.attname, p.privilege_type)
  `)) as any[];

  const writePrivilegesFound = tableWriteGrants.length > 0 || columnWriteGrants.length > 0;
  if (writePrivilegesFound) {
    console.error("ERROR: current user has effective write privileges on public tables/columns; SELECT-only role required.");
    if (tableWriteGrants.length) console.error(JSON.stringify(tableWriteGrants, null, 2));
    if (columnWriteGrants.length) console.error(JSON.stringify(columnWriteGrants, null, 2));
    process.exit(1);
  }

  // ── Role / read-only mode check ─────────────────────────────────────────
  const roleRows = (await prisma.$queryRawUnsafe(`
    SELECT current_user, session_user, current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation
  `)) as any[];
  if (!roleRows.length) {
    console.error("ERROR: role query failed");
    process.exit(1);
  }
  const row = roleRows[0];
  console.log(`Database role: current_user=${row.current_user}, session_user=${row.session_user}`);
  console.log(`Read-only mode: ${row.read_only}, isolation: ${row.isolation}`);
  if (String(row.read_only).toLowerCase() !== "on") {
    console.error("ERROR: transaction_read_only off");
    process.exit(1);
  }

  console.log("Checked table/column DML privileges verified.");

  // ── PostgreSQL version ──────────────────────────────────────────────────
  const pgVersionRow = (await prisma.$queryRawUnsafe(`SELECT version() AS version`)) as any[];
  const pgVersion = pgVersionRow?.[0]?.version || "unknown";
  console.log(`PostgreSQL Version: ${pgVersion}`);

  if (IS_REAL_AUDIT && pgExpectedVersion) {
    const matches = pgVersion.includes(pgExpectedVersion!);
    if (!matches) {
      console.error(
        `ERROR: PostgreSQL version mismatch. Expected "${pgExpectedVersion}" but got "${pgVersion}".`
      );
      process.exit(1);
    }
    console.log(`✅ PostgreSQL version matches expected "${pgExpectedVersion}"`);
  } else if (IS_REAL_AUDIT) {
    console.error("ERROR: PG_EXPECTED_VERSION missing in real audit mode.");
    process.exit(1);
  }

  // ── Inventory queries ───────────────────────────────────────────────────
  const total = await prisma.notification.count();
  const readCount = await prisma.notification.count({ where: { read: true } });
  const unreadCount = await prisma.notification.count({ where: { read: false } });
  console.log(`\nTotal notifications: ${total}`);
  console.log(`Read: ${readCount}`);
  console.log(`Unread: ${unreadCount}`);

  // STRICT mode: empty data is not a valid audit
  if (IS_REAL_AUDIT && total === 0) {
    console.error(
      "ERROR: Real audit mode requires non-empty notification table. Got 0 rows. Refusing to emit receipt."
    );
    process.exit(1);
  }

  const byType = await prisma.notification.groupBy({
    by: ["type"],
    _count: { _all: true },
    orderBy: { type: "asc" },
  });
  console.log("\nCounts by type:");
  for (const r of byType) console.log(`  ${r.type}: ${r._count._all}`);

  const byOrg = await prisma.notification.groupBy({
    by: ["orgId"],
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  console.log("\nTop 10 orgs:");
  for (const r of byOrg) console.log(`  org ${sanitizeOrgId(r.orgId)}: ${r._count._all}`);

  const orgWide = await prisma.notification.count({ where: { userId: null } });
  const targeted = await prisma.notification.count({ where: { userId: { not: null } } });
  console.log(`\nOrg-wide: ${orgWide}, Targeted: ${targeted}`);

  let receiptCount = 0;
  let distinctUsers = 0;
  try {
    receiptCount = await prisma.notificationReadReceipt.count();
    const distinct = await prisma.notificationReadReceipt.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    distinctUsers = distinct.length;
    console.log(`\nNotificationReadReceipt rows: ${receiptCount}, Distinct users: ${distinctUsers}`);
  } catch (e) {
    console.error("Receipt table query failed, fail-closed.", e);
    process.exit(1);
  }

  const genericTypes = ["info", "success", "warning", "error"];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const type of genericTypes) {
    const totalType = await prisma.notification.count({ where: { type } });
    const last7 = await prisma.notification.count({
      where: { type, createdAt: { gte: sevenDaysAgo } },
    });
    const last30 = await prisma.notification.count({
      where: { type, createdAt: { gte: thirtyDaysAgo } },
    });
    if (totalType > 0) {
      console.log(`\n${type}: Total ${totalType}, 7d ${last7}, 30d ${last30}`);
    }
  }

  // ── Target identity classification ──────────────────────────────────────
  console.log(`\nTarget identity hash: ${actualHash.slice(0, 16)}...`);
  console.log(`  is_localhost: ${targetFingerprint.is_localhost}`);
  console.log(`  is_supabase_pooler: ${targetFingerprint.is_supabase_pooler}`);

  // ── Receipt ─────────────────────────────────────────────────────────────
  const executionReceipt = {
    receipt_type: "PROTECTED_EXACT_HEAD_EXECUTION_RECEIPT",
    audit_mode: AUDIT_MODE,
    timestamp: nowIso,
    pr_head_sha: prHeadSha,
    verified_git_sha: headSha,
    script_sha256: scriptSha256,
    script_hash_verified: IS_REAL_AUDIT && !!expectedScriptSha256
      ? expectedScriptSha256 === scriptSha256
      : null,
    database_role: {
      current_user: row.current_user,
      session_user: row.session_user,
    },
    target_identity: {
      // Minimum-disclosure: hashes only, no raw values.
      expected_hash: expectedHash,
      actual_hash: actualHash,
      match: expectedHash === actualHash,
      is_localhost: targetFingerprint.is_localhost,
      scheme: targetFingerprint.scheme,
    },
    grants_summary: {
      table_write_count: tableWriteGrants.length,
      column_write_count: columnWriteGrants.length,
    },
    pg_version: pgVersion,
    pg_expected_version: pgExpectedVersion || null,
    pg_version_match: IS_REAL_AUDIT ? pgVersion.includes(pgExpectedVersion!) : null,
    read_only_mode_status: String(row.read_only).toLowerCase() === "on" ? "on" : "off",
    inventory_summary: {
      total_notifications: total,
      read_count: readCount,
      unread_count: unreadCount,
      org_wide: orgWide,
      targeted: targeted,
      distinct_types: byType.length,
      top_orgs_count: byOrg.length,
      notification_read_receipts: receiptCount,
      distinct_receipt_users: distinctUsers,
    },
  };

  const receiptDir = "backups";
  if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });
  const receiptPath = path.join(receiptDir, "historical-rows-inventory-receipt.json");
  const receiptContent = JSON.stringify(executionReceipt, null, 2) + "\n";
  fs.writeFileSync(receiptPath, receiptContent);
  const receiptHash = crypto.createHash("sha256").update(receiptContent).digest("hex");
  fs.writeFileSync(receiptPath + ".sha256", receiptHash + "\n");

  console.log("\n===================================================");
  console.log(JSON.stringify(executionReceipt, null, 2));
  console.log("===================================================");
  console.log(`Receipt saved: ${receiptPath}`);
}

main()
  .catch((e) => {
    console.error("Inventory script failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());