#!/usr/bin/env node
// ============================================================================
// TRUSTED audit harness — zero npm dependencies.
// Uses psql CLI (pre-installed on ubuntu-latest runners) for PostgreSQL access.
// This file is the immutable baseline; PRs cannot modify it after merge to main.
//
// Round 5 → Round 6 fixes (13 Sep 2026):
// - Fixed `actualGitSha` undefined reference (was `harnessGitSha`)
// - Fixed `writeGrants` undefined reference (was `tableWriteGrants`)
// - Removed duplicate `grants_summary` key
// - Removed unused `PR_HEAD_SHA` (binding via `upstream_workflow_sha`)
// - Strict version fail-closed with regex match
// - Explicit fail on missing UPSTREAM_* in real mode
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { URL, fileURLToPath } from "node:url";

// FIX: fileURLToPath handles Windows paths correctly (unlike .pathname).
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_SHA256 = createHash("sha256")
  .update(readFileSync(SCRIPT_PATH))
  .digest("hex");

const AUDIT_MODE = (process.env.AUDIT_MODE || "ci-smoke").toLowerCase();
const IS_REAL = AUDIT_MODE === "real";

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}
function log(msg) {
  console.log(msg);
}
function safeParseInt(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    fail(`${label} returned non-numeric value: "${value}"`);
  }
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < min || n > max) {
    fail(`${label} out of range [${min}, ${max}]: ${n}`);
  }
  return n;
}

// ── Config ───────────────────────────────────────────────────────────────
const readonlyUrl = process.env.DATABASE_URL_READONLY;
if (!readonlyUrl) fail("DATABASE_URL_READONLY is required.");

const expectedVersion = process.env.PG_EXPECTED_VERSION;
const expectedHost = process.env.PG_EXPECTED_HOST;
const expectedPort = process.env.PG_EXPECTED_PORT || "5432";
const expectedDatabase = process.env.PG_EXPECTED_DATABASE || "postgres";
const expectedUsername = process.env.PG_EXPECTED_USERNAME;
const expectedScriptHash = process.env.EXPECTED_SCRIPT_SHA256;

// ── Identity capture (FIX #1) ────────────────────────────────────────────
// was: harnessGitSha computed but `actualGitSha` referenced later — now unified.
let actualGitSha = "unknown";
try {
  actualGitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {}

const upstreamWorkflowSha = process.env.UPSTREAM_WORKFLOW_SHA || "unknown";
const upstreamRunId = process.env.UPSTREAM_RUN_ID || "unknown";
const upstreamPrNumber = process.env.UPSTREAM_PR_NUMBER || "unknown";

log(`Trusted harness SHA:   ${actualGitSha}`);
log(`Upstream workflow SHA: ${upstreamWorkflowSha}`);
log(`Upstream run ID:       ${upstreamRunId}`);
log(`Upstream PR number:    ${upstreamPrNumber}`);
log(`Audit Mode: ${AUDIT_MODE}${IS_REAL ? " (STRICT)" : " (smoke)"}`);
log(`Script SHA256: ${SCRIPT_SHA256.slice(0, 16)}...`);

// ── Real-mode: enforce UPSTREAM_* presence (FIX #1b) ─────────────────────
if (IS_REAL) {
  if (upstreamWorkflowSha === "unknown") fail("UPSTREAM_WORKFLOW_SHA required in real mode.");
  if (upstreamRunId === "unknown") fail("UPSTREAM_RUN_ID required in real mode.");
  if (upstreamPrNumber === "unknown") fail("UPSTREAM_PR_NUMBER required in real mode.");
  if (actualGitSha === "unknown") {
    fail("Real mode requires valid git HEAD (git rev-parse failed).");
  }
  if (!expectedScriptHash) {
    fail("EXPECTED_SCRIPT_SHA256 required in real mode.");
  }
}

// ── Verify script integrity ──────────────────────────────────────────────
if (IS_REAL && expectedScriptHash !== SCRIPT_SHA256) {
  fail(`Script integrity check failed.\n  expected: ${expectedScriptHash}\n  actual:   ${SCRIPT_SHA256}`);
}

// ── Parse + verify target identity ───────────────────────────────────────
const parsed = new URL(readonlyUrl);
const actualUsername = decodeURIComponent(parsed.username);
const actualHost = parsed.hostname;
const actualPort = parsed.port || "5432";
const actualDatabase = parsed.pathname.replace(/^\//, "");

function hashIdentity({ username, host, port, database }) {
  return createHash("sha256")
    .update(`${username}@${host}:${port}/${database}`)
    .digest("hex");
}

const expectedHash =
  expectedUsername && expectedHost
    ? hashIdentity({
        username: expectedUsername,
        host: expectedHost,
        port: expectedPort,
        database: expectedDatabase,
      })
    : null;
const actualHash = hashIdentity({
  username: actualUsername,
  host: actualHost,
  port: actualPort,
  database: actualDatabase,
});

if (IS_REAL) {
  if (!expectedUsername) fail("PG_EXPECTED_USERNAME required in real mode.");
  if (!expectedHost) fail("PG_EXPECTED_HOST required in real mode.");
  if (expectedHash !== actualHash) {
    fail(`Target identity mismatch.\n  expected_hash: ${expectedHash}\n  actual_hash:   ${actualHash}`);
  }
  if (actualHost === "localhost" || actualHost === "127.0.0.1") {
    fail("Real audit requires non-localhost target.");
  }
  log(`✅ Target identity verified (hash: ${actualHash.slice(0, 16)}...)`);
}

// ── PostgreSQL via psql CLI ──────────────────────────────────────────────
const sslmode = parsed.searchParams.get("sslmode") || "require";
const pgEnv = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGUSER: actualUsername,
  PGHOST: actualHost,
  PGPORT: actualPort,
  PGDATABASE: actualDatabase,
  PGSSLMODE: sslmode,
};

function psql(sql) {
  const result = spawnSync("psql", ["-t", "-A", "-F", "\t", "-c", sql], {
    env: pgEnv,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`psql failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

// ── Role check ───────────────────────────────────────────────────────────
const roleLine = psql(
  "SELECT current_user, session_user, current_setting('transaction_read_only')"
);
const [currentUser, sessionUser, readOnly] = roleLine.split("\t");
log(`Database role: current_user=${currentUser}, session_user=${sessionUser}`);
log(`Read-only mode: ${readOnly}`);
if (String(readOnly).toLowerCase() !== "on") fail("transaction_read_only is not on");

// ── Table-level write privilege check ────────────────────────────────────
const tableWriteCheck = psql(`
  SELECT COUNT(*) FROM (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_table_privilege(current_user, c.oid, p.privilege_type)
  ) t
`);
const tableWriteGrants = safeParseInt(tableWriteCheck, "table write grants");

// ── Column-level write privilege check ───────────────────────────────────
const columnWriteCheck = psql(`
  SELECT COUNT(*) FROM (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('REFERENCES')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_column_privilege(current_user, c.oid, a.attname, p.privilege_type)
  ) t
`);
const columnWriteGrants = safeParseInt(columnWriteCheck, "column write grants");

if (tableWriteGrants > 0 || columnWriteGrants > 0) {
  fail(`Write grants detected. table=${tableWriteGrants}, column=${columnWriteGrants}`);
}
log(`Checked table (${tableWriteGrants}) and column (${columnWriteGrants}) DML privileges verified.`);

// ── Version check (FIX #8 — strict fail-closed) ──────────────────────────
const pgVersion = psql("SELECT version()");
log(`PostgreSQL Version: ${pgVersion}`);

let pgVersionMatch = null;
if (IS_REAL) {
  if (!expectedVersion) fail("PG_EXPECTED_VERSION required in real mode.");
  // Strict pattern match: "PostgreSQL X.Y" exactly
  const versionMatch = pgVersion.match(/PostgreSQL\s+(\d+\.\d+)/);
  if (!versionMatch) {
    fail(`Could not parse PostgreSQL version from: ${pgVersion}`);
  }
  const actualVersion = versionMatch[1];
  if (actualVersion !== expectedVersion) {
    fail(`Version mismatch. Expected "${expectedVersion}", got "${actualVersion}"`);
  }
  pgVersionMatch = true;
  log(`✅ PostgreSQL version strictly matches expected "${expectedVersion}"`);
}

// ── Required scope (single snapshot-consistent query) ─────────────────────
const inventoryRow = psql(`
  SELECT
    (SELECT COUNT(*) FROM "Notification") AS total,
    (SELECT COUNT(*) FROM "Notification" WHERE read = true) AS read_count,
    (SELECT COUNT(*) FROM "Notification" WHERE read = false) AS unread_count,
    (SELECT COUNT(*) FROM "Notification" WHERE "userId" IS NULL) AS org_wide,
    (SELECT COUNT(*) FROM "Notification" WHERE "userId" IS NOT NULL) AS targeted,
    (SELECT COUNT(DISTINCT type) FROM "Notification") AS distinct_types
`);
const [totalS, readS, unreadS, orgWideS, targetedS, typesS] = inventoryRow.split("\t");

const total = safeParseInt(totalS, "notification total");
const readCount = safeParseInt(readS, "read count");
const unreadCount = safeParseInt(unreadS, "unread count");
const orgWide = safeParseInt(orgWideS, "org-wide count");
const targeted = safeParseInt(targetedS, "targeted count");
const distinctTypes = safeParseInt(typesS, "distinct types");

if (total !== readCount + unreadCount) {
  fail(`Snapshot inconsistency: total=${total}, read=${readCount}, unread=${unreadCount}`);
}
if (total !== orgWide + targeted) {
  fail(`Snapshot inconsistency: total=${total}, orgWide=${orgWide}, targeted=${targeted}`);
}

let receiptCount = 0;
let distinctReceiptUsers = 0;
try {
  receiptCount = safeParseInt(
    psql('SELECT COUNT(*) FROM "NotificationReadReceipt"'),
    "notification receipt count"
  );
  distinctReceiptUsers = safeParseInt(
    psql('SELECT COUNT(DISTINCT "userId") FROM "NotificationReadReceipt"'),
    "distinct receipt user count"
  );
} catch (err) {
  fail(`NotificationReadReceipt query failed (fail-closed): ${err.message}`);
}

log(`\nTotal notifications: ${total}`);
log(`Read: ${readCount}, Unread: ${unreadCount}`);
log(`Org-wide: ${orgWide}, Targeted: ${targeted}`);
log(`Distinct types: ${distinctTypes}`);
log(`Read receipts: ${receiptCount}, distinct users: ${distinctReceiptUsers}`);

if (IS_REAL) {
  if (total === 0) fail("Real audit requires non-empty Notification table.");
  if (distinctTypes === 0) fail("Real audit requires at least one notification type.");
  if (orgWide === 0 && targeted === 0) fail("Real audit requires notification audience coverage.");
}

// ── Receipt (FIX #3 — no duplicate grants_summary) ───────────────────────
const receipt = {
  receipt_type: "PROTECTED_EXACT_HEAD_EXECUTION_RECEIPT",
  audit_mode: AUDIT_MODE,
  timestamp: new Date().toISOString(),
  harness_git_sha: actualGitSha,
  upstream_workflow_sha: upstreamWorkflowSha,
  upstream_run_id: upstreamRunId,
  upstream_pr_number: upstreamPrNumber,
  evidence_binding: "upstream_workflow_sha",
  script_sha256: SCRIPT_SHA256,
  script_hash_verified: IS_REAL ? SCRIPT_SHA256 === expectedScriptHash : null,
  database_role: { current_user: currentUser, session_user: sessionUser },
  target_identity: {
    expected_hash: expectedHash,
    actual_hash: actualHash,
    match: expectedHash === actualHash,
    has_project_ref: actualUsername.includes("."),
    is_localhost: actualHost === "localhost" || actualHost === "127.0.0.1",
  },
  grants_summary: {
    table_write_grants: tableWriteGrants,
    column_write_grants: columnWriteGrants,
  },
  pg_version: pgVersion,
  pg_expected_version: expectedVersion || null,
  pg_version_match: pgVersionMatch,
  read_only_mode_status: String(readOnly).toLowerCase() === "on" ? "on" : "off",
  inventory_summary: {
    total_notifications: total,
    read_count: readCount,
    unread_count: unreadCount,
    org_wide: orgWide,
    targeted: targeted,
    distinct_types: distinctTypes,
    notification_read_receipts: receiptCount,
    distinct_receipt_users: distinctReceiptUsers,
  },
};

mkdirSync("backups", { recursive: true });
const receiptPath = "backups/historical-rows-inventory-receipt.json";
const content = JSON.stringify(receipt, null, 2) + "\n";
writeFileSync(receiptPath, content);
const receiptHash = createHash("sha256").update(content).digest("hex");
writeFileSync(receiptPath + ".sha256", receiptHash + "\n");

log("\n===================================================");
log(JSON.stringify(receipt, null, 2));
log("===================================================");
log(`Receipt saved: ${receiptPath}`);