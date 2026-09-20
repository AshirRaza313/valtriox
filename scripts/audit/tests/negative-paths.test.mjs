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
    PG_EXPECTED_VERSION: "17.6",
    EXPECTED_SCRIPT_SHA256: scriptHash,
    UPSTREAM_WORKFLOW_SHA: UPSTREAM_SHA,
    UPSTREAM_RUN_ID: "1234567890",
    UPSTREAM_RUN_ATTEMPT: "1",
    UPSTREAM_PR_NUMBER: "15",
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