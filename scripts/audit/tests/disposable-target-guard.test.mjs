#!/usr/bin/env node
// ============================================================================
// Disposable-target guard — unit tests (Round 17 R17-1)
// ============================================================================
// Verifies the marker-based disposable-target guard:
//   - accepts valid URL + non-empty expectedMarker
//   - rejects missing/empty expectedMarker
//   - rejects invalid URL shape (protocol, missing host, missing dbname)
// And verifies the same-connection marker DO block is well-formed.
// ============================================================================

import {
  assertDisposableTarget,
  buildMarkerVerificationDoBlock,
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

console.log("\nDisposable-target guard tests (Round 17 R17-1):\n");

// ── Positive ──────────────────────────────────────────
test("accepts valid URL + non-empty marker", () => {
  const r = assertDisposableTarget(
    "postgresql://u:p@localhost:5432/audit_test",
    { expectedMarker: "1234-1" }
  );
  if (r.host !== "localhost" || r.dbName !== "audit_test" || r.expectedMarker !== "1234-1") {
    throw new Error("unexpected return shape");
  }
});

test("accepts postgres:// scheme", () => {
  assertDisposableTarget("postgres://u:p@anyhost:5432/anything", {
    expectedMarker: "run-attempt",
  });
});

test("accepts arbitrary host/dbname (no IP/dbname classification)", () => {
  // Explicitly: private-looking hosts and non-test dbnames are allowed
  // because identity is proven by the marker, not by shape.
  assertDisposableTarget("postgresql://u:p@10.0.0.5:5432/prod", {
    expectedMarker: "run-attempt",
  });
});

// ── Negative: URL shape ────────────────────────────────
test("rejects empty URL", () => {
  expectThrow(
    () => assertDisposableTarget("", { expectedMarker: "x" }),
    /not set|empty/,
    "empty URL"
  );
});

test("rejects non-string URL", () => {
  expectThrow(
    () => assertDisposableTarget(null, { expectedMarker: "x" }),
    /not set|not a string/,
    "null URL"
  );
});

test("rejects invalid URL", () => {
  expectThrow(
    () => assertDisposableTarget("not a url", { expectedMarker: "x" }),
    /invalid URL/,
    "invalid URL"
  );
});

test("rejects non-postgres protocol", () => {
  expectThrow(
    () => assertDisposableTarget("mysql://u:p@h:3306/d", { expectedMarker: "x" }),
    /protocol must be/,
    "mysql protocol"
  );
});

// ── Negative: marker env ────────────────────────────────
test("rejects missing marker", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", {}),
    /DISPOSABLE_DB_MARKER/,
    "missing marker"
  );
});

test("rejects empty marker", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", { expectedMarker: "" }),
    /DISPOSABLE_DB_MARKER/,
    "empty marker"
  );
});

test("rejects whitespace-only marker", () => {
  expectThrow(
    () => assertDisposableTarget("postgresql://u:p@h:5432/d", { expectedMarker: "   " }),
    /DISPOSABLE_DB_MARKER/,
    "whitespace marker"
  );
});

// ── Positive: DO block well-formed ──────────────────
test("buildMarkerVerificationDoBlock embeds expected marker", () => {
  const sql = buildMarkerVerificationDoBlock("run-1-attempt-2");
  if (!sql.includes("run-1-attempt-2")) throw new Error("marker not embedded");
  if (!sql.includes("RAISE EXCEPTION")) throw new Error("no raise");
  if (!sql.includes("__disposable_marker")) throw new Error("no marker table");
});

test("buildMarkerVerificationDoBlock escapes single quotes", () => {
  const sql = buildMarkerVerificationDoBlock("a'b");
  if (!sql.includes("a''b")) throw new Error("quote not escaped");
});

test("buildMarkerVerificationDoBlock rejects empty marker", () => {
  expectThrow(
    () => buildMarkerVerificationDoBlock(""),
    /expectedMarker is empty/,
    "empty marker"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
