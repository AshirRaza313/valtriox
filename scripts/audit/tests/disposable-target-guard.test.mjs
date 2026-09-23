#!/usr/bin/env node
// ============================================================================
// Disposable-target guard — unit tests (Round 15 R15-1)
// ============================================================================
// Verifies the guard rejects non-disposable targets BEFORE any DDL.
// Pure unit test — no DB connection required.
// ============================================================================

import { assertDisposableTarget } from "./disposable-target-guard.mjs";

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
  try {
    fn();
  } catch (err) {
    if (!pattern.test(err.message)) {
      throw new Error(
        `${label}: error message did not match ${pattern}: got "${err.message}"`
      );
    }
    return;
  }
  throw new Error(`${label}: expected throw, but no error was raised`);
}

console.log("\nDisposable-target guard tests (Round 15 R15-1):\n");

// ── Positive cases ──────────────────────────────────────────────────────
test("accepts localhost with audit_test dbname", () => {
  const r = assertDisposableTarget(
    "postgresql://user:pass@localhost:5432/audit_test"
  );
  if (r.host !== "localhost") throw new Error(`host: ${r.host}`);
  if (r.dbName !== "audit_test") throw new Error(`dbName: ${r.dbName}`);
});

test("accepts 127.0.0.1 with test_db dbname", () => {
  assertDisposableTarget("postgresql://u:p@127.0.0.1:5432/test_db");
});

test("accepts ::1 (IPv6 loopback) with disposable_db", () => {
  assertDisposableTarget("postgresql://u:p@[::1]:5432/disposable_db");
});

test("accepts test-db.local with ci_test dbname", () => {
  assertDisposableTarget("postgresql://u:p@test-db.local:5432/ci_test");
});

test("accepts postgres:// scheme", () => {
  assertDisposableTarget("postgres://u:p@localhost:5432/audit_test");
});

// ── Negative cases: non-disposable host ─────────────────────────────────
test("rejects remote host (not disposable) — before any DDL", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@prod.example.com:5432/audit_test"),
    /Refusing destructive DDL.*not a disposable target/,
    "reject-remote-host"
  );
});

test("rejects Supabase pooler host — before any DDL", () => {
  expectThrow(
    () => assertDisposableTarget(
      "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/audit_test"
    ),
    /Refusing destructive DDL/,
    "reject-supabase-pooler"
  );
});

// ── Negative cases: non-disposable dbname ───────────────────────────────
test("rejects production dbname on localhost", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@localhost:5432/production"),
    /does not match disposable pattern/,
    "reject-prod-dbname"
  );
});

test("rejects dbname 'main' on localhost", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@localhost:5432/main"),
    /does not match disposable pattern/,
    "reject-main-dbname"
  );
});

// ── Negative cases: invalid URL ─────────────────────────────────────────
test("rejects non-postgres protocol", () => {
  expectThrow(
    () => assertDisposableTarget("mysql://u:p@localhost:3306/audit_test"),
    /protocol must be/,
    "reject-mysql-protocol"
  );
});

test("rejects empty/missing URL", () => {
  expectThrow(
    () => assertDisposableTarget(""),
    /not set or not a string/,
    "reject-empty"
  );
});

test("rejects invalid URL string", () => {
  expectThrow(
    () => assertDisposableTarget("not-a-url"),
    /invalid URL/,
    "reject-invalid"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);