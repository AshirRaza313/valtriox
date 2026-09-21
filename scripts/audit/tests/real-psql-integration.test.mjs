#!/usr/bin/env node
// ============================================================================
// Real psql integration test — Round 13 R13-2
// ============================================================================
// Purpose:
//   Expert feedback: "Mock tests real psql output represent nahi karte.
//   BEGIN/COMMIT ke saath actual psql output aur error behaviour ko
//   disposable, non-production database par validate karein."
//
// Approach:
//   - Uses a disposable PostgreSQL instance (postgres:16 in CI).
//   - Sets up a dedicated NON-superuser role (superuser bypasses
//     BEGIN READ ONLY enforcement — production uses non-superuser).
//   - Runs real psql invocations with BEGIN READ ONLY; ...; COMMIT;
//     wrappers exactly as the harness does.
//   - Validates actual stdout/stderr/exit-code behavior.
//
// Local dev behavior:
//   - If TEST_DATABASE_URL is not set, the test SKIPS (exit 0).
//   - No local PostgreSQL required.
// ============================================================================

import { spawnSync } from "node:child_process";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  console.log("\nSKIP: TEST_DATABASE_URL not set (local dev / no DB).\n");
  process.exit(0);
}

// ── Setup: derive superuser + readonly role URLs ────────────────────────
const superUrl = new URL(TEST_DATABASE_URL);

const ROLE_NAME = "audit_r13_ro";
const ROLE_PASSWORD = "audit_r13_ro_pass_xyz";

const roUrl = new URL(TEST_DATABASE_URL);
roUrl.username = ROLE_NAME;
roUrl.password = ROLE_PASSWORD;

const TEST_TABLE = "test_r13_readonly_enforcement";

// ── psql runner (mirrors harness: -t -A -F \t + optional BEGIN READ ONLY) ──
function makePsqlEnv(urlObj) {
  return {
    ...process.env,
    PGPASSWORD: decodeURIComponent(urlObj.password),
    PGUSER: decodeURIComponent(urlObj.username),
    PGHOST: urlObj.hostname,
    PGPORT: urlObj.port || "5432",
    PGDATABASE: urlObj.pathname.replace(/^\//, ""),
    PGSSLMODE: "prefer",
  };
}

const superEnv = makePsqlEnv(superUrl);
const roEnv = makePsqlEnv(roUrl);

function psql(sql, { guard = true, env = superEnv } = {}) {
  // Semicolon after ${sql} required — see R13-2b.
  const guardedSql = guard ? `BEGIN READ ONLY;\n${sql};\nCOMMIT;` : sql;
  return spawnSync(
    "psql",
    ["-t", "-A", "-F", "\t", "-c", guardedSql],
    { env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 30_000 }
  );
}

// ── Test harness ────────────────────────────────────────────────────────
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

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(cond, label) {
  if (!cond) throw new Error(`${label}: expected true`);
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${label}: expected to contain ${JSON.stringify(needle)}, got: ${haystack.slice(0, 400)}`
    );
  }
}

console.log("\nReal psql integration tests (Round 13 R13-2):\n");

// ── Setup (as superuser, no guard) ──────────────────────────────────────
const setupSql = `
  DROP TABLE IF EXISTS ${TEST_TABLE};
  DROP ROLE IF EXISTS ${ROLE_NAME};
  CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '${ROLE_PASSWORD}';
  CREATE TABLE ${TEST_TABLE} (id int);
  GRANT SELECT, INSERT ON ${TEST_TABLE} TO ${ROLE_NAME};
`;
const setup = psql(setupSql, { guard: false });
if (setup.status !== 0) {
  console.error("SETUP FAILED:");
  console.error(setup.stderr);
  process.exit(1);
}

// ── N-a: BEGIN READ ONLY produces no stdout noise ───────────────────────
test("N-a: BEGIN READ ONLY; SELECT 1; COMMIT; produces just '1'", () => {
  const r = psql("SELECT 1 AS n");
  assertEq(r.status, 0, "exit code");
  assertEq(r.stdout.trim(), "1", "stdout");
  assertTrue(!r.stdout.includes("BEGIN"), "no BEGIN in stdout");
  assertTrue(!r.stdout.includes("COMMIT"), "no COMMIT in stdout");
});

// ── N-b: Multiple columns tab-separated (real psql -F \t) ───────────────
test("N-b: multiple columns are tab-separated", () => {
  const r = psql("SELECT 'a' AS x, 'b' AS y, 42 AS z");
  assertEq(r.status, 0, "exit code");
  assertEq(r.stdout.trim(), "a\tb\t42", "stdout");
});

// ── N-c: Role check query with guard opt-out (ambient state) ────────────
test("N-c: role check query works with guard opt-out", () => {
  const r = psql(
    "SELECT current_user, session_user, current_setting('transaction_read_only')",
    { guard: false }
  );
  assertEq(r.status, 0, "exit code");
  const parts = r.stdout.trim().split("\t");
  assertEq(parts.length, 3, "column count");
  assertEq(parts[0], parts[1], "current_user === session_user");
  assertTrue(["on", "off"].includes(parts[2]), `read_only value: ${parts[2]}`);
});

// ── N-d: SHOW search_path produces expected format ──────────────────────
test("N-d: SHOW search_path returns a string containing 'public'", () => {
  const r = psql("SHOW search_path");
  assertEq(r.status, 0, "exit code");
  assertContains(r.stdout, "public", "stdout");
});

// ── N-e: Error propagation — invalid SQL returns non-zero exit ──────────
test("N-e: invalid SQL returns non-zero exit + stderr", () => {
  const r = psql("SELECT * FROM table_that_does_not_exist_r13");
  assertTrue(r.status !== 0, "exit code should be non-zero");
  assertContains(
    r.stderr.toLowerCase(),
    "does not exist",
    "stderr should mention 'does not exist'"
  );
});

// ── N-f: Read-only enforcement — INSERT WITH guard FAILS ────────────────
test("N-f: INSERT inside BEGIN READ ONLY fails as non-superuser role", () => {
  const r = psql(
    `INSERT INTO ${TEST_TABLE} VALUES (100)`,
    { guard: true, env: roEnv }
  );
  assertTrue(r.status !== 0, "exit code should be non-zero");
  assertContains(
    r.stderr.toLowerCase(),
    "read-only",
    "stderr should mention 'read-only'"
  );
});

// ── N-g: Same INSERT WITHOUT guard SUCCEEDS (proves privilege) ──────────
test("N-g: same INSERT without guard succeeds (role has INSERT privilege)", () => {
  const r = psql(
    `INSERT INTO ${TEST_TABLE} VALUES (200)`,
    { guard: false, env: roEnv }
  );
  assertEq(r.status, 0, "exit code");
});

// ── N-h: SELECT in guard mode as non-superuser role ─────────────────────
test("N-h: SELECT inside guard mode works for readonly role", () => {
  const r = psql(`SELECT COUNT(*) FROM ${TEST_TABLE}`, { env: roEnv });
  assertEq(r.status, 0, "exit code");
  const count = Number(r.stdout.trim());
  assertTrue(count >= 1, `count >= 1 (got ${count})`);
});

// ── Cleanup (as superuser) ──────────────────────────────────────────────
psql(
  `DROP TABLE IF EXISTS ${TEST_TABLE}; DROP ROLE IF EXISTS ${ROLE_NAME};`,
  { guard: false }
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);