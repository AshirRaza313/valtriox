#!/usr/bin/env node
// ============================================================================
// Negative-path tests for the trusted audit harness (Round 11 R3).
// ============================================================================
// Each test forces a specific fail-closed violation and asserts on the
// EXACT AuditError message emitted by notification-inventory.mjs.
//
// Uses `run-with-mocks.mjs` (function-parameter injection — no env override
// exists in production). Mock psql scenario control is via the
// MOCK_PSQL_SCENARIO env var (see mock-psql.mjs).
// ============================================================================

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wrapperPath = join(__dirname, "run-with-mocks.mjs");
const realScriptPath = join(__dirname, "..", "notification-inventory.mjs");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Same hash the script computes on startup (import.meta.url → real file).
const scriptHash = createHash("sha256")
  .update(readFileSync(realScriptPath))
  .digest("hex");

// Mock-git.mjs ALWAYS returns "b".repeat(40) for `git rev-parse HEAD`.
const MOCK_HEAD = "b".repeat(40);
const UPSTREAM_SHA = "a".repeat(40);

// Base env: every gate passes in the default mock scenario. Individual
// tests override exactly ONE field to trigger exactly ONE fail-closed path.
function baseEnv() {
  return {
    ...process.env,
    AUDIT_MODE: "real",
    DATABASE_URL_READONLY:
      "postgresql://audit_readonly.testref:password@fake-host.example.com:5432/postgres",
    EXPECTED_PIN_SHA: MOCK_HEAD,
    PG_EXPECTED_HOST: "fake-host.example.com",
    PG_EXPECTED_PORT: "5432",
    PG_EXPECTED_DATABASE: "postgres",
    PG_EXPECTED_USERNAME: "audit_readonly.testref",
    PG_EXPECTED_EFFECTIVE_ROLE: "audit_readonly",
    PG_EXPECTED_VERSION: "17.6",
    EXPECTED_SCRIPT_SHA256: scriptHash,
    UPSTREAM_WORKFLOW_SHA: UPSTREAM_SHA,
    UPSTREAM_RUN_ID: "1234567890",
    UPSTREAM_RUN_ATTEMPT: "1",
    UPSTREAM_PR_NUMBER: "15",
    TRUSTED_RUN_ID: "9876543210",
    TRUSTED_RUN_ATTEMPT: "1",
  };
}

function runWithEnv(env) {
  const result = spawnSync("node", [wrapperPath], {
    env,
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

console.log("\nNegative-path tests (Round 11 R3):\n");

// ── N1: Bad pin (wrong SHA) ────────────────────────────────────────────
test("N1: bad pin fails with 'Pin identity mismatch'", () => {
  const env = baseEnv();
  env.EXPECTED_PIN_SHA = "c".repeat(40); // ≠ mock-git's "b".repeat(40)
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Pin identity mismatch.")) {
    throw new Error(`expected 'Pin identity mismatch.' — got: ${output.slice(0, 400)}`);
  }
});

// ── N2: Wrong target role ──────────────────────────────────────────────
test("N2: wrong target role fails with 'Target identity mismatch'", () => {
  const env = baseEnv();
  env.PG_EXPECTED_USERNAME = "wrong_role"; // ≠ audit_readonly.testref
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Target identity mismatch.")) {
    throw new Error(`expected 'Target identity mismatch.' — got: ${output.slice(0, 400)}`);
  }
});

// ── N3: Unsafe connection (localhost in real mode) ─────────────────────
test("N3: unsafe connection (localhost) fails in real mode", () => {
  const env = baseEnv();
  env.DATABASE_URL_READONLY =
    "postgresql://audit_readonly.testref:password@localhost:5432/postgres";
  env.PG_EXPECTED_HOST = "localhost"; // hash matches first; localhost gate fires next
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Real audit requires non-localhost target.")) {
    throw new Error(`expected 'Real audit requires non-localhost target.' — got: ${output.slice(0, 400)}`);
  }
});

// ── N9a: Invalid URI protocol (Round 12 R12-3a) ────────────────────────
test("N9a: invalid URI protocol fails with 'Unsupported database URI protocol'", () => {
  const env = baseEnv();
  env.DATABASE_URL_READONLY =
    "mysql://audit_readonly.testref:password@fake-host.example.com:5432/postgres";
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Unsupported database URI protocol")) {
    throw new Error(
      `expected 'Unsupported database URI protocol' — got: ${output.slice(0, 400)}`
    );
  }
});

// ── N9b: Weak sslmode (Round 12 R12-3b) ────────────────────────────────
test("N9b: weak sslmode fails with 'Weak sslmode rejected'", () => {
  const env = baseEnv();
  env.DATABASE_URL_READONLY =
    "postgresql://audit_readonly.testref:password@fake-host.example.com:5432/postgres?sslmode=disable";
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Weak sslmode rejected")) {
    throw new Error(
      `expected 'Weak sslmode rejected' — got: ${output.slice(0, 400)}`
    );
  }
  if (!output.includes("disable")) {
    throw new Error(`expected 'disable' in message — got: ${output.slice(0, 400)}`);
  }
});

// ── N10: Returned role mismatch (Round 12 R12-3c) ──────────────────────
test("N10: returned role mismatch fails with 'Effective role mismatch'", () => {
  const env = baseEnv();
  env.PG_EXPECTED_EFFECTIVE_ROLE = "wrong_expected_role"; // mock returns "audit_readonly"
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Effective role mismatch")) {
    throw new Error(`expected 'Effective role mismatch' — got: ${output.slice(0, 400)}`);
  }
});

// ── N11: Object-kind mismatch (Round 12 R12-4a) ────────────────────────
test("N11: unexpected relation kind fails with 'Unexpected relation kind'", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "wrong_relation_kind"; // mock returns 'v' for Notification
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Unexpected relation kind")) {
    throw new Error(
      `expected 'Unexpected relation kind' — got: ${output.slice(0, 400)}`
    );
  }
  if (!output.includes("Notification")) {
    throw new Error(`expected 'Notification' in message — got: ${output.slice(0, 400)}`);
  }
});

// ── N14: Inherited PGHOSTADDR cannot redirect connection (R14-1) ──────
test("N14: inherited PGHOSTADDR/PGSERVICE/PGOPTIONS stripped from psql env", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "env_dump"; // mock prints its own PG* env vars
  env.PGHOSTADDR = "192.0.2.1";        // TEST-NET-1, non-routable
  env.PGSERVICE = "malicious_service";
  env.PGOPTIONS = "-c search_path=malicious";
  // Note: runInventory will fail at role-check parsing because env_dump
  // overrides ALL psql query responses. Status is irrelevant — we only
  // inspect the mock's stdout for leaked PG* variable NAMES. The mock
  // prints every PG* var it receives; if PGHOSTADDR/PGSERVICE/PGOPTIONS
  // leak through, their names appear in the output.
  const { output } = runWithEnv(env);
  if (output.includes("PGHOSTADDR")) {
    throw new Error(
      `PGHOSTADDR leaked into psql env — vulnerability not fixed: ` +
      output.slice(0, 400)
    );
  }
  if (output.includes("PGSERVICE")) {
    throw new Error(
      `PGSERVICE leaked into psql env — vulnerability not fixed: ` +
      output.slice(0, 400)
    );
  }
  if (output.includes("PGOPTIONS")) {
    throw new Error(
      `PGOPTIONS leaked into psql env — vulnerability not fixed: ` +
      output.slice(0, 400)
    );
  }
});

// ── N14b: source-level verification of fail-closed pgEnv (R14-1) ──────
test("N14b: pgEnv construction uses allowlist, not process.env spread", () => {
  const src = readFileSync(
    join(__dirname, "..", "notification-inventory.mjs"),
    "utf8"
  );
  // 1. No process.env spread in pgEnv construction
  if (/const pgEnv = \{\s*\.\.\.process\.env/.test(src)) {
    throw new Error("pgEnv still spreads process.env — fail-closed not applied");
  }
  // 2. SAFE_PASSTHROUGH allowlist present
  if (!src.includes("SAFE_PASSTHROUGH")) {
    throw new Error("SAFE_PASSTHROUGH allowlist missing");
  }
  // 3. PGHOSTADDR must NOT appear in the allowlist
  const allowMatch = src.match(/SAFE_PASSTHROUGH\s*=\s*\[([\s\S]*?)\]/);
  if (!allowMatch) {
    throw new Error("SAFE_PASSTHROUGH array literal not found");
  }
  if (allowMatch[1].includes("PGHOSTADDR")) {
    throw new Error("PGHOSTADDR must NOT be in SAFE_PASSTHROUGH allowlist");
  }
  if (allowMatch[1].includes("PGSERVICE")) {
    throw new Error("PGSERVICE must NOT be in SAFE_PASSTHROUGH allowlist");
  }
  // 4. isMockPsql guard present
  if (!src.includes("isMockPsql")) {
    throw new Error("isMockPsql guard missing (test-only passthrough)");
  }
});

// ── N7: Missing EXPECTED_PIN_SHA (workflow env wiring) ─────────────────
test("N7: missing EXPECTED_PIN_SHA fails with 'EXPECTED_PIN_SHA required'", () => {
  const env = baseEnv();
  delete env.EXPECTED_PIN_SHA;
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("EXPECTED_PIN_SHA required in real mode.")) {
    throw new Error(
      `expected 'EXPECTED_PIN_SHA required in real mode.' — got: ${output.slice(0, 400)}`
    );
  }
});

// ── N8: Script hash mismatch ───────────────────────────────────────────
test("N8: script hash mismatch fails with 'Script integrity check failed'", () => {
  const env = baseEnv();
  env.EXPECTED_SCRIPT_SHA256 = "0".repeat(64); // wrong hash
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Script integrity check failed")) {
    throw new Error(
      `expected 'Script integrity check failed' — got: ${output.slice(0, 400)}`
    );
  }
});

// ── N12: psql error (fail-closed on non-zero exit) ─────────────────────
test("N12: psql error fails with 'psql failed'", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "psql_error_on_version"; // mock exits 1 on version query
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("psql failed")) {
    throw new Error(`expected 'psql failed' — got: ${output.slice(0, 400)}`);
  }
  if (!output.includes("FATAL: connection lost")) {
    throw new Error(
      `expected stderr text 'FATAL: connection lost' — got: ${output.slice(0, 400)}`
    );
  }
});

// ── N13: Inconsistent count totals ─────────────────────────────────────
test("N13: inconsistent counts fail with 'Snapshot inconsistency'", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "inconsistent_counts"; // total=100, read+unread=90
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Snapshot inconsistency")) {
    throw new Error(
      `expected 'Snapshot inconsistency' — got: ${output.slice(0, 400)}`
    );
  }
});

// ── N4: Read-only failure ──────────────────────────────────────────────
test("N4: read-only off fails with 'transaction_read_only is not on'", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "readonly_off";
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("transaction_read_only is not on")) {
    throw new Error(`expected 'transaction_read_only is not on' — got: ${output.slice(0, 400)}`);
  }
});

// ── N5: Write grants detected ──────────────────────────────────────────
test("N5: write grants detected fails with grant detection error", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "write_grants_table"; // mock returns 3 for table grants
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Write grants detected.")) {
    throw new Error(`expected 'Write grants detected.' — got: ${output.slice(0, 400)}`);
  }
  if (!output.includes("table=3")) {
    throw new Error(`expected 'table=3' in message — got: ${output.slice(0, 400)}`);
  }
});

// ── N6: Version mismatch ───────────────────────────────────────────────
test("N6: version mismatch fails with 'Version mismatch'", () => {
  const env = baseEnv();
  env.MOCK_PSQL_SCENARIO = "version_17_5"; // mock returns PostgreSQL 17.5
  env.PG_EXPECTED_VERSION = "17.6";        // expected ≠ actual
  const { status, output } = runWithEnv(env);
  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Version mismatch.")) {
    throw new Error(`expected 'Version mismatch.' — got: ${output.slice(0, 400)}`);
  }
  if (!output.includes("17.6") || !output.includes("17.5")) {
    throw new Error(`expected both versions in message — got: ${output.slice(0, 400)}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);