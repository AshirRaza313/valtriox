#!/usr/bin/env node
// ============================================================================
// Disposable-target guard — unit tests (Round 18 R18-2)
// ============================================================================
// Verifies the DB-name-based disposable-target guard:
//   - accepts URL whose dbname matches expectedDbName
//   - rejects URL whose dbname does NOT match expectedDbName
//   - rejects missing/empty/whitespace expectedDbName
//   - rejects invalid URL shape (protocol, missing host, missing dbname)
// And verifies the DO block is well-formed.
// ============================================================================

import {
  assertDisposableTarget,
  buildDbNameVerificationDoBlock,
  buildClusterVerificationDoBlock,
} from "./disposable-target-guard.mjs";

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

function expectThrow(fn, pattern, label) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  if (!threw) throw new Error(`${label}: expected throw, none occurred`);
  if (pattern && !pattern.test(threw.message)) {
    throw new Error(`${label}: message did not match ${pattern}; got "${threw.message}"`);
  }
}

console.log("\nDisposable-target guard tests (Round 18 R18-2):\n");

// ── Positive ──────────────────────────────────────────
test("accepts URL whose dbname matches expectedDbName", () => {
  const r = assertDisposableTarget(
    "postgresql://u:p@localhost:5432/audit_1234_1_abc",
    { expectedDbName: "audit_1234_1_abc" }
  );
  if (r.host !== "localhost" || r.dbName !== "audit_1234_1_abc" || r.expectedDbName !== "audit_1234_1_abc") {
    throw new Error("unexpected return shape");
  }
});

test("accepts postgres:// scheme", () => {
  assertDisposableTarget("postgres://u:p@anyhost:5432/audit_x", {
    expectedDbName: "audit_x",
  });
});

// ── Negative: URL/dbname mismatch ──────────────────────
test("rejects URL whose dbname does not match expectedDbName", () => {
  expectThrow(
    () => assertDisposableTarget(
      "postgresql://u:p@localhost:5432/production",
      { expectedDbName: "audit_1234_1_abc" }
    ),
    /does not match DISPOSABLE_DB_NAME/,
    "dbname mismatch"
  );
});

// ── Negative: URL shape ────────────────────────────────
test("rejects empty URL", () => {
  expectThrow(
    () => assertDisposableTarget("", { expectedDbName: "x" }),
    /not set|empty/,
    "empty URL"
  );
});

test("rejects non-string URL", () => {
  expectThrow(
    () => assertDisposableTarget(null, { expectedDbName: "x" }),
    /not set|not a string/,
    "null URL"
  );
});

test("rejects invalid URL", () => {
  expectThrow(
    () => assertDisposableTarget("not a url", { expectedDbName: "x" }),
    /invalid URL/,
    "invalid URL"
  );
});

test("rejects non-postgres protocol", () => {
  expectThrow(
    () => assertDisposableTarget("mysql://u:p@h:3306/d", { expectedDbName: "x" }),
    /protocol must be/,
    "mysql protocol"
  );
});

// ── Negative: expectedDbName env ────────────────────────
test("rejects missing expectedDbName", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", {}),
    /DISPOSABLE_DB_NAME/,
    "missing expectedDbName"
  );
});

test("rejects empty expectedDbName", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", { expectedDbName: "" }),
    /DISPOSABLE_DB_NAME/,
    "empty expectedDbName"
  );
});

test("rejects whitespace-only expectedDbName", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", { expectedDbName: "   " }),
    /DISPOSABLE_DB_NAME/,
    "whitespace expectedDbName"
  );
});

// ── Positive: DO block well-formed ──────────────────
test("buildDbNameVerificationDoBlock embeds expected dbname", () => {
  const sql = buildDbNameVerificationDoBlock("audit_1234_1_abc");
  if (!sql.includes("audit_1234_1_abc")) throw new Error("dbname not embedded");
  if (!sql.includes("RAISE EXCEPTION")) throw new Error("no raise");
  if (!sql.includes("current_database()")) throw new Error("no current_database()");
});

test("buildDbNameVerificationDoBlock escapes single quotes", () => {
  const sql = buildDbNameVerificationDoBlock("a'b");
  if (!sql.includes("a''b")) throw new Error("quote not escaped");
});

test("buildDbNameVerificationDoBlock rejects empty dbname", () => {
  expectThrow(
    () => buildDbNameVerificationDoBlock(""),
    /expectedDbName is empty/,
    "empty dbname"
  );
});

// ── Positive: cluster verification DO block ────────────
test("buildClusterVerificationDoBlock embeds expected cluster id", () => {
  const sql = buildClusterVerificationDoBlock("7381530940514998842");
  if (!sql.includes("7381530940514998842")) throw new Error("cluster id not embedded");
  if (!sql.includes("RAISE EXCEPTION")) throw new Error("no raise");
  if (!sql.includes("pg_control_system")) throw new Error("no pg_control_system");
});

test("buildClusterVerificationDoBlock rejects empty", () => {
  expectThrow(
    () => buildClusterVerificationDoBlock(""),
    /expectedClusterId is empty/,
    "empty cluster id"
  );
});

test("buildClusterVerificationDoBlock rejects undefined", () => {
  expectThrow(
    () => buildClusterVerificationDoBlock(undefined),
    /expectedClusterId is empty/,
    "undefined cluster id"
  );
});

test("buildClusterVerificationDoBlock rejects non-numeric", () => {
  expectThrow(
    () => buildClusterVerificationDoBlock("123abc"),
    /must be a decimal integer/,
    "non-numeric cluster id"
  );
});
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
