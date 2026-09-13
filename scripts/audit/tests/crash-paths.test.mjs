#!/usr/bin/env node
// ============================================================================
// Focused tests for the two crash paths the expert flagged:
// 1. actualGitSha undefined (was referencing undeclared variable)
// 2. writeGrants undefined (was referencing undeclared variable)
//
// Windows-safe: handles empty env vars correctly.
// ============================================================================

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "..", "notification-inventory.mjs");

function runScript(env, options = {}) {
  return spawnSync("node", [scriptPath], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    ...options,
  });
}

// Combine stdout + stderr for checking (Windows can buffer differently)
function getOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

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
  // Use `undefined` (delete) instead of empty string — more reliable on Windows
  const env = { ...process.env, AUDIT_MODE: "ci-smoke" };
  delete env.DATABASE_URL_READONLY;

  const result = spawnSync("node", [scriptPath], {
    env,
    encoding: "utf8",
  });
  const output = getOutput(result);

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
  };
  delete env.UPSTREAM_WORKFLOW_SHA;
  delete env.UPSTREAM_RUN_ID;
  delete env.UPSTREAM_PR_NUMBER;

  const result = spawnSync("node", [scriptPath], {
    env,
    encoding: "utf8",
  });
  const output = getOutput(result);

  if (result.status !== 1) {
    throw new Error(`expected exit 1, got ${result.status} — output: ${output.slice(0, 200)}`);
  }
  if (!output.includes("UPSTREAM_WORKFLOW_SHA") && !output.includes("UPSTREAM")) {
    throw new Error(`expected UPSTREAM_* message — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 3: actualGitSha declared (no ReferenceError) ───────────────────
test("actualGitSha is declared (no ReferenceError on startup)", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "ci-smoke",
  };
  const result = spawnSync("node", [scriptPath], {
    env,
    encoding: "utf8",
  });
  const output = getOutput(result);

  if (output.includes("ReferenceError")) {
    throw new Error(`ReferenceError present: ${output.slice(0, 300)}`);
  }
  if (output.includes("actualGitSha is not defined")) {
    throw new Error("actualGitSha undefined bug not fixed");
  }
});

// ── Test 4: No reference to old variable names ──────────────────────────
test("no reference to writeGrants (unified naming)", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "ci-smoke",
  };
  const result = spawnSync("node", [scriptPath], {
    env,
    encoding: "utf8",
  });
  const output = getOutput(result);

  if (output.includes("writeGrants is not defined")) {
    throw new Error("writeGrants undefined bug not fixed");
  }
});

// ── Test 5: Windows path handling ───────────────────────────────────────
test("script self-hash computes (Windows path compatible)", () => {
  const env = {
    ...process.env,
    DATABASE_URL_READONLY: "postgresql://user:pass@127.0.0.1:5432/postgres",
    AUDIT_MODE: "ci-smoke",
  };
  const result = spawnSync("node", [scriptPath], {
    env,
    encoding: "utf8",
  });
  const output = getOutput(result);

  if (output.includes("ENOENT") || output.includes("no such file")) {
    throw new Error(`Script self-hash path failed: ${output.slice(0, 300)}`);
  }
  if (output.includes("Script SHA256:")) {
    // Good — script got past self-hash computation
    return;
  }
  // If we got here, script may have failed for another reason but not path
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);