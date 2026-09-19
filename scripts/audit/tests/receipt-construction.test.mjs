#!/usr/bin/env node
// ============================================================================
// Extended test: successful receipt-construction path.
// ============================================================================
// Uses `run-with-mocks.mjs` which imports `runInventory()` and passes mock
// commands via FUNCTION PARAMETERS. Production script has no override.
// ============================================================================

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

console.log("\nExtended receipt-construction tests:\n");

const workDir = mkdtempSync(join(tmpdir(), "audit-receipt-test-"));

// Compute hash of the REAL script (not the wrapper) — that's what the
// script hashes on startup via import.meta.url.
const realScriptContent = readFileSync(realScriptPath);
const scriptHash = createHash("sha256").update(realScriptContent).digest("hex");

const testEnv = {
  ...process.env,
  DATABASE_URL_READONLY:
    "postgresql://audit_readonly.testref:password@fake-host.example.com:5432/postgres",
  AUDIT_MODE: "real",
  PG_EXPECTED_HOST: "fake-host.example.com",
  PG_EXPECTED_PORT: "5432",
  PG_EXPECTED_DATABASE: "postgres",
  PG_EXPECTED_USERNAME: "audit_readonly.testref",
  PG_EXPECTED_VERSION: "17.6",
  EXPECTED_SCRIPT_SHA256: scriptHash,
  UPSTREAM_WORKFLOW_SHA: "a".repeat(40),
  UPSTREAM_RUN_ID: "1234567890",
  UPSTREAM_PR_NUMBER: "15",
};

const runResult = spawnSync("node", [wrapperPath], {
  cwd: workDir,
  env: testEnv,
  encoding: "utf8",
});

let receiptJson;

test("successful run completes without crash (exit 0)", () => {
  if (runResult.status !== 0) {
    throw new Error(
      `Expected exit 0, got ${runResult.status}\n` +
        `stderr: ${(runResult.stderr || "").slice(0, 500)}\n` +
        `stdout: ${(runResult.stdout || "").slice(0, 800)}`
    );
  }
});

test("receipt JSON file created", () => {
  const receiptPath = join(workDir, "backups", "historical-rows-inventory-receipt.json");
  if (!existsSync(receiptPath)) {
    throw new Error(`Receipt not found at ${receiptPath}`);
  }
  receiptJson = JSON.parse(readFileSync(receiptPath, "utf8"));
});

test("receipt SHA256 sidecar matches content hash", () => {
  const receiptPath = join(workDir, "backups", "historical-rows-inventory-receipt.json");
  const hashPath = receiptPath + ".sha256";
  if (!existsSync(hashPath)) {
    throw new Error(`SHA256 sidecar not found at ${hashPath}`);
  }
  const expectedHash = readFileSync(hashPath, "utf8").trim();
  const actualHash = createHash("sha256").update(readFileSync(receiptPath)).digest("hex");
  if (expectedHash !== actualHash) {
    throw new Error(`Hash mismatch: expected=${expectedHash}, actual=${actualHash}`);
  }
});

test("receipt has exactly one grants_summary object", () => {
  const receiptPath = join(workDir, "backups", "historical-rows-inventory-receipt.json");
  const content = readFileSync(receiptPath, "utf8");
  const matches = content.match(/"grants_summary"/g) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected 1 grants_summary, found ${matches.length}`);
  }
});

test("receipt includes snapshot_scope clarification", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  if (receiptJson.snapshot_scope !== "core_notification_counts_only") {
    throw new Error(`snapshot_scope missing or wrong: ${receiptJson.snapshot_scope}`);
  }
  if (receiptJson.inventory_summary.core_counts_snapshot_consistent !== true) {
    throw new Error("core_counts_snapshot_consistent not true");
  }
  if (receiptJson.inventory_summary.receipt_counts_snapshot_consistent !== false) {
    throw new Error("receipt_counts_snapshot_consistent not false");
  }
});

test("receipt binds upstream workflow identity", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  if (receiptJson.upstream_workflow_sha !== testEnv.UPSTREAM_WORKFLOW_SHA) {
    throw new Error(`upstream_workflow_sha mismatch`);
  }
  if (receiptJson.upstream_run_id !== testEnv.UPSTREAM_RUN_ID) {
    throw new Error(`upstream_run_id mismatch`);
  }
  if (receiptJson.upstream_pr_number !== testEnv.UPSTREAM_PR_NUMBER) {
    throw new Error(`upstream_pr_number mismatch`);
  }
  if (receiptJson.evidence_binding !== "upstream_workflow_sha") {
    throw new Error(`evidence_binding wrong: ${receiptJson.evidence_binding}`);
  }
});

test("receipt records script hash verification", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  if (receiptJson.script_sha256 !== scriptHash) {
    throw new Error(`script_sha256 mismatch`);
  }
  if (receiptJson.script_hash_verified !== true) {
    throw new Error(`script_hash_verified not true: ${receiptJson.script_hash_verified}`);
  }
});

test("target identity match recorded as true", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  if (!receiptJson.target_identity || receiptJson.target_identity.match !== true) {
    throw new Error(`target_identity.match not true`);
  }
});

test("PostgreSQL version match recorded", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  if (receiptJson.pg_version_match !== true) {
    throw new Error(`pg_version_match not true: ${receiptJson.pg_version_match}`);
  }
});

test("inventory invariants hold", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  const inv = receiptJson.inventory_summary;
  if (inv.total_notifications !== inv.read_count + inv.unread_count) {
    throw new Error(`Invariant 1 failed`);
  }
  if (inv.total_notifications !== inv.org_wide + inv.targeted) {
    throw new Error(`Invariant 2 failed`);
  }
});

test("grants_summary records zero table/column write grants", () => {
  if (!receiptJson) throw new Error("Receipt not loaded");
  const gs = receiptJson.grants_summary;
  if (!gs) throw new Error("grants_summary missing");
  if (gs.table_write_grants !== 0) {
    throw new Error(`table_write_grants not 0`);
  }
  if (gs.column_write_grants !== 0) {
    throw new Error(`column_write_grants not 0`);
  }
});

try {
  rmSync(workDir, { recursive: true, force: true });
} catch {}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);