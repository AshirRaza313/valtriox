#!/usr/bin/env node
// ============================================================================
// TRUSTED audit harness — zero npm dependencies.
// Uses psql CLI (pre-installed on ubuntu-latest runners) for PostgreSQL access.
// This file is the immutable baseline; PRs cannot modify it after merge to main.
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { URL } from "node:url";

const SCRIPT_PATH = new URL(import.meta.url).pathname;
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

// ── Config ───────────────────────────────────────────────────────────────
const readonlyUrl = process.env.DATABASE_URL_READONLY;
if (!readonlyUrl) fail("DATABASE_URL_READONLY is required.");

const prHeadSha = process.env.PR_HEAD_SHA || "unknown";
const expectedVersion = process.env.PG_EXPECTED_VERSION;
const expectedHost = process.env.PG_EXPECTED_HOST;
const expectedPort = process.env.PG_EXPECTED_PORT || "5432";
const expectedDatabase = process.env.PG_EXPECTED_DATABASE || "postgres";
const expectedUsername = process.env.PG_EXPECTED_USERNAME;
const expectedScriptHash = process.env.EXPECTED_SCRIPT_SHA256;

// ── Verify HEAD SHA ──────────────────────────────────────────────────────
let actualGitSha = "unknown";
try {
  actualGitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {}

if (prHeadSha !== "unknown" && prHeadSha !== actualGitSha) {
  fail(`PR_HEAD_SHA (${prHeadSha}) does not match checked-out HEAD (${actualGitSha}).`);
}

log(`Audit Mode: ${AUDIT_MODE}${IS_REAL ? " (STRICT)" : " (smoke)"}`);
log(`Verified HEAD SHA: ${actualGitSha}`);
log(`Script SHA256: ${SCRIPT_SHA256.slice(0, 16)}...`);

// ── Verify script integrity ──────────────────────────────────────────────
if (IS_REAL && expectedScriptHash && expectedScriptHash !== SCRIPT_SHA256) {
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

// ── Write privilege check ────────────────────────────────────────────────
const writeCheck = psql(`
  SELECT COUNT(*) FROM (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_table_privilege(current_user, c.oid, p.privilege_type)
  ) t
`);
const writeGrants = parseInt(writeCheck, 10);
if (writeGrants > 0) fail(`Current user has ${writeGrants} write grants on public tables.`);
log(`Checked table/column DML privileges verified.`);

// ── Version check ────────────────────────────────────────────────────────
const pgVersion = psql("SELECT version()");
log(`PostgreSQL Version: ${pgVersion}`);
if (IS_REAL && expectedVersion) {
  if (!pgVersion.includes(expectedVersion)) {
    fail(`Version mismatch. Expected "${expectedVersion}", got "${pgVersion}"`);
  }
  log(`✅ PostgreSQL version matches expected "${expectedVersion}"`);
}

// ── Inventory queries ────────────────────────────────────────────────────
const total = parseInt(psql('SELECT COUNT(*) FROM "Notification"'), 10);
const readCount = parseInt(psql('SELECT COUNT(*) FROM "Notification" WHERE read = true'), 10);
const unreadCount = parseInt(psql('SELECT COUNT(*) FROM "Notification" WHERE read = false'), 10);
log(`\nTotal notifications: ${total}`);
log(`Read: ${readCount}`);
log(`Unread: ${unreadCount}`);

if (IS_REAL && total === 0) {
  fail("Real audit requires non-empty notification table. Got 0 rows.");
}

// ── Receipt ──────────────────────────────────────────────────────────────
const receipt = {
  receipt_type: "PROTECTED_EXACT_HEAD_EXECUTION_RECEIPT",
  audit_mode: AUDIT_MODE,
  timestamp: new Date().toISOString(),
  pr_head_sha: prHeadSha,
  verified_git_sha: actualGitSha,
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
  grants_summary: { write_grants: writeGrants },
  pg_version: pgVersion,
  pg_expected_version: expectedVersion || null,
  pg_version_match: IS_REAL ? pgVersion.includes(expectedVersion || "") : null,
  read_only_mode_status: String(readOnly).toLowerCase() === "on" ? "on" : "off",
  inventory_summary: {
    total_notifications: total,
    read_count: readCount,
    unread_count: unreadCount,
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