#!/usr/bin/env node
// ============================================================================
// Focused crash-path tests for the trusted audit harness.
// ============================================================================
// Uses `run-with-mocks.mjs` as the spawn target so mock commands are
// injected via FUNCTION PARAMETERS — not env vars. Production script has
// no override capability whatsoever.
// ============================================================================

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

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

console.log("\nFocused crash-path tests:\n");

// ── Test 1: Missing DATABASE_URL_READONLY ───────────────────────────────
test("exits cleanly when DATABASE_URL_READONLY missing", () => {
  const env = { ...process.env, AUDIT_MODE: "ci-smoke" };
  delete env.DATABASE_URL_READONLY;

  const result = spawnSync("node", [wrapperPath], { env, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status !== 1) {
    throw new Error(`expected exit 1, got ${result.status} — output: ${output.slice(0, 200)}`);
  }
  if (!output.includes("DATABASE_URL_READONLY")) {
    throw new Error(`expected DATABASE_URL_READONLY message — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 2: Real mode without UPSTREAM_* ────────────────────────────────
test("real mode fails when UPSTREAM_WORKFLOW_SHA missing", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "real",
    EXPECTED_PIN_SHA: "b".repeat(40),   // ← YE ADD KARO (matches mock git SHA)
  };
  delete env.UPSTREAM_WORKFLOW_SHA;
  delete env.UPSTREAM_RUN_ID;
  delete env.UPSTREAM_PR_NUMBER;
  delete env.UPSTREAM_RUN_ATTEMPT;
  delete env.AUDIT_ALLOW_CMD_OVERRIDE;
  delete env.AUDIT_TEST_REAL;

  const result = spawnSync("node", [wrapperPath], { env, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status !== 1) {
    throw new Error(`expected exit 1, got ${result.status} — output: ${output.slice(0, 200)}`);
  }
  if (!output.includes("UPSTREAM_WORKFLOW_SHA")) {
    throw new Error(`expected UPSTREAM_WORKFLOW_SHA message — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 3: No ReferenceError on startup ────────────────────────────────
test("actualGitSha is declared (no ReferenceError on startup)", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "ci-smoke",
  };

  const result = spawnSync("node", [wrapperPath], { env, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (output.includes("ReferenceError")) {
    throw new Error(`ReferenceError present: ${output.slice(0, 300)}`);
  }
  if (output.includes("actualGitSha is not defined")) {
    throw new Error("actualGitSha undefined bug not fixed");
  }
});

// ── Test 4: Source-level check (no runtime) ─────────────────────────────
test("no reference to old writeGrants variable in source", () => {
  const src = readFileSync(realScriptPath, "utf8");
  // Should not contain `const writeGrants = ` (old broken name)
  if (/^const writeGrants\s*=/m.test(src)) {
    throw new Error("Old writeGrants variable still present");
  }
  // Should contain tableWriteGrants + columnWriteGrants
  if (!src.includes("tableWriteGrants") || !src.includes("columnWriteGrants")) {
    throw new Error("Unified tableWriteGrants/columnWriteGrants not found");
  }
});

// ── Test 5: Script self-hash computes ───────────────────────────────────
test("script self-hash computes (Windows path compatible)", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "ci-smoke",
  };

  const result = spawnSync("node", [wrapperPath], { env, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (output.includes("ENOENT") || output.includes("no such file")) {
    throw new Error(`Script self-hash path failed: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Script SHA256:")) {
    throw new Error(`Expected "Script SHA256:" in output — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 6: psql enforces per-connection read-only guard (R12-3d) ──────
test("psql wraps every query in BEGIN READ ONLY (R12-3d)", () => {
  const src = readFileSync(realScriptPath, "utf8");
  // Guard must be present in the psql function
  if (!src.includes("BEGIN READ ONLY;")) {
    throw new Error("BEGIN READ ONLY guard missing from psql function");
  }
  // Guard must default to enabled
  if (!/function psql\(sql, \{ readOnlyGuard = true \}/.test(src)) {
    throw new Error("psql() readOnlyGuard default not `true`");
  }
});

// ── Test 7: role check opts out of guard (R12-3d) ──────────────────────
test("ambient role check opts out via readOnlyGuard: false (R12-3d)", () => {
  const src = readFileSync(realScriptPath, "utf8");
  if (!src.includes("readOnlyGuard: false")) {
    throw new Error("role check does not opt out of read-only guard");
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);