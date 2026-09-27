#!/usr/bin/env node
// ============================================================================
// Contract verification test — Round 13 R13-1b
// ============================================================================
// Purpose:
//   Prevent the R11 and R12 class of bugs where the audit script requires
//   an env var in real mode, but the trusted workflow never passes it.
//
// Approach (static analysis, no runtime, no mocks):
//   1. Parse notification-inventory.mjs for all env vars required in real
//      mode (or always required) — extracted from AuditError messages.
//   2. Parse .github/workflows/audit-harness.yml for all env vars passed
//      in the "Run trusted audit" step.
//   3. Assert every script-required env var is provided by the workflow.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "..", "notification-inventory.mjs");
const workflowPath = join(
  __dirname,
  "..",
  "..",
  "..",
  ".github",
  "workflows",
  "audit-harness.yml"
);

const scriptContent = readFileSync(scriptPath, "utf8");
const workflowContent = readFileSync(workflowPath, "utf8");

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

console.log("\nContract verification tests (Round 13 R13-1b):\n");

// ── Extract script-required env vars ───────────────────────────────────
function extractScriptRequiredEnvVars(content) {
  const required = new Set();
  const patterns = [
    // Real-mode-only gates (e.g. "UPSTREAM_RUN_ID required in real mode.")
    /throw new AuditError\("([A-Z_][A-Z0-9_]*) required in real mode\."\)/g,
    // Always-required gates (e.g. "DATABASE_URL_READONLY is required.")
    /throw new AuditError\("([A-Z_][A-Z0-9_]*) is required\."\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      required.add(m[1]);
    }
  }
  return required;
}

// ── Extract workflow-provided env vars (Run trusted audit step) ────────
function extractWorkflowEnvVars(content) {
  const stepStart = content.indexOf("name: Run trusted audit");
  if (stepStart === -1) {
    throw new Error("Could not find 'Run trusted audit' step in workflow");
  }
  const stepEnd = content.indexOf(
    "run: node scripts/audit/notification-inventory.mjs",
    stepStart
  );
  if (stepEnd === -1) {
    throw new Error(
      "Could not find 'run: node scripts/audit/notification-inventory.mjs' " +
        "after 'Run trusted audit' step"
    );
  }
  const envBlock = content.slice(stepStart, stepEnd);

  const provided = new Set();
  // Match lines like "          KEY: value" (indented env block entries).
  // Comment lines (starting with #) and lowercase keywords (env:, name:)
  // are excluded by the [A-Z_] first-character class.
  const re = /^\s+([A-Z_][A-Z0-9_]*):/gm;
  let m;
  while ((m = re.exec(envBlock)) !== null) {
    provided.add(m[1]);
  }
  return provided;
}

const scriptRequired = extractScriptRequiredEnvVars(scriptContent);
const workflowProvided = extractWorkflowEnvVars(workflowContent);

// ── Test 1: script has at least one required env var (parser sanity) ───
test("script declares at least one real-mode required env var", () => {
  if (scriptRequired.size === 0) {
    throw new Error(
      "No 'X required in real mode' patterns found in script — parser may be broken"
    );
  }
});

// ── Test 2: workflow provides at least one env var (parser sanity) ─────
test("workflow provides env vars in Run trusted audit step", () => {
  if (workflowProvided.size === 0) {
    throw new Error(
      "No env vars found in workflow 'Run trusted audit' step — parser may be broken"
    );
  }
});

// ── Test 3: every script-required env var is provided by workflow ──────
test("every script-required env var is provided by workflow", () => {
  const missing = [];
  for (const req of scriptRequired) {
    if (!workflowProvided.has(req)) {
      missing.push(req);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Script requires env vars that workflow does not provide: ` +
        `${missing.join(", ")}. ` +
        `This is the R11/R12 class of bug — script and workflow contract mismatch. ` +
        `Add the missing env vars to the 'Run trusted audit' step in ` +
        `.github/workflows/audit-harness.yml.`
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);