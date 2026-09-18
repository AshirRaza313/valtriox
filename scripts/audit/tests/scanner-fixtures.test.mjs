#!/usr/bin/env node
// ============================================================================
// Scanner fixture tests
// ============================================================================
// Verifies `scripts/find-identical-i18n.js` behavior on three fixtures:
//   1. i18n-clean.ts     → exit 0, 0 duplicates, 0 missing
//   2. i18n-duplicate.ts → exit 1, "DUPLICATE KEYS DETECTED"
//   3. i18n-missing.ts   → exit 1, "Missing in UR"
//
// Standalone test — run via:
//   node scripts/audit/tests/scanner-fixtures.test.mjs
//
// Excluded from Vitest via vitest.config.ts.
// ============================================================================

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scannerPath = join(__dirname, "..", "..", "find-identical-i18n.js");
const fixturesDir = join(__dirname, "fixtures");

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

function runScanner(fixtureFile) {
  const result = spawnSync(
    "node",
    [scannerPath, join(fixturesDir, fixtureFile)],
    { encoding: "utf8" }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return { status: result.status, output };
}

console.log("\nScanner fixture tests:\n");

// ── Test 1: Clean fixture ───────────────────────────────────────────────
test("clean fixture → exit 0, no duplicates, no missing", () => {
  const { status, output } = runScanner("i18n-clean.txt");

  if (status !== 0) {
    throw new Error(`expected exit 0, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (output.includes("DUPLICATE KEYS DETECTED")) {
    throw new Error(`unexpected duplicate detection: ${output.slice(0, 300)}`);
  }
  if (output.includes("Missing in UR") || output.includes("Missing in EN")) {
    throw new Error(`unexpected missing detection: ${output.slice(0, 300)}`);
  }
  if (!output.includes("EN keys: 3") || !output.includes("UR keys: 3")) {
    throw new Error(`expected EN=3, UR=3 — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 2: Duplicate fixture ───────────────────────────────────────────
test("duplicate fixture → exit 1, duplicate detected", () => {
  const { status, output } = runScanner("i18n-duplicate.txt");

  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("DUPLICATE KEYS DETECTED")) {
    throw new Error(`expected duplicate detection — got: ${output.slice(0, 300)}`);
  }
  if (!output.includes("hello")) {
    throw new Error(`expected duplicate key "hello" — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 3: Missing fixture ─────────────────────────────────────────────
test("missing fixture → exit 1, missing key detected", () => {
  const { status, output } = runScanner("i18n-missing.txt");

  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status} — output: ${output.slice(0, 300)}`);
  }
  if (!output.includes("Missing in UR")) {
    throw new Error(`expected "Missing in UR" — got: ${output.slice(0, 300)}`);
  }
  if (!output.includes("welcome")) {
    throw new Error(`expected missing key "welcome" — got: ${output.slice(0, 300)}`);
  }
});

// ── Test 4: Non-existent file → clear error ─────────────────────────────
test("non-existent file → exit 1, clear error", () => {
  const { status, output } = runScanner("does-not-exist.ts");

  if (status !== 1) {
    throw new Error(`expected exit 1, got ${status}`);
  }
  if (!output.includes("i18n file not found")) {
    throw new Error(`expected "i18n file not found" — got: ${output.slice(0, 300)}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);