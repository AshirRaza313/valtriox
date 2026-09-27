// R19-5 / R20-4b: Shared cleanup runner — exercises the EXACT production
// cleanup path so wrong-identity tests are not reduced copies.
//
// Expert Round 18 (P0 Blocker #3):
//   "Real-psql test reduced copied cleanup sequence chalata hai. Actual
//    production cleanup mein REVOKE, DROP OWNED aur DROP ROLE ka different
//    sequence hai."
//
// Expert Round 19 (P0-3):
//   "Runner guard ko internally mandatory banaye."
//
// API design:
//   - buildCleanupSequence()         — production path. Guard is built
//                                      INTERNALLY from authoritative
//                                      identity params; callers cannot
//                                      omit or tamper.
//   - buildCleanupSequenceForTest()  — test-only escape hatch for
//                                      negative tests that must inject a
//                                      deliberately wrong guard. The
//                                      "ForTest" suffix signals intent.
//
// Both callers (production-path.test.mjs, real-psql-integration.test.mjs)
// import from here. No duplication, no drift.

import {
  buildDbNameVerificationDoBlock,
  buildClusterVerificationDoBlock,
} from "./tests/disposable-target-guard.mjs";

// Compose the guard DO blocks that must run FIRST inside the cleanup
// transaction. Both cluster and DB identity must match, or the transaction
// aborts before any destructive statement.
export function buildCleanupGuard({ expectedDbName, expectedClusterId }) {
  if (
    !expectedDbName ||
    typeof expectedDbName !== "string" ||
    expectedDbName.trim().length === 0
  ) {
    throw new Error("buildCleanupGuard: expectedDbName is required (non-empty string)");
  }
  if (
    !expectedClusterId ||
    typeof expectedClusterId !== "string" ||
    expectedClusterId.trim().length === 0
  ) {
    throw new Error("buildCleanupGuard: expectedClusterId is required (non-empty string)");
  }
  return [
    buildDbNameVerificationDoBlock(expectedDbName),
    buildClusterVerificationDoBlock(expectedClusterId),
  ].join("\n");
}

// ── Internal assembler ──────────────────────────────────────────────
// Shared by both public APIs. NOT exported. Only runs after the caller
// has either built a guard internally (production) or supplied one
// explicitly (test-only).
function assembleCleanupSequence({
  roleName,
  dbName,
  tableNames,
  guardDoBlocks,
}) {
  if (!roleName || typeof roleName !== "string" || roleName.trim().length === 0) {
    throw new Error("buildCleanupSequence: roleName is required (non-empty string)");
  }
  if (!dbName || typeof dbName !== "string" || dbName.trim().length === 0) {
    throw new Error("buildCleanupSequence: dbName is required (non-empty string)");
  }
  if (!Array.isArray(tableNames) || tableNames.length === 0) {
    throw new Error("buildCleanupSequence: tableNames must be a non-empty array");
  }
  if (
    !guardDoBlocks ||
    typeof guardDoBlocks !== "string" ||
    guardDoBlocks.trim().length === 0
  ) {
    throw new Error("buildCleanupSequence: guardDoBlocks is required (non-empty string)");
  }

  // Defence in depth: reject obviously unsafe identifiers early.
  const identRe = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!identRe.test(roleName)) {
    throw new Error(
      "buildCleanupSequence: roleName has unexpected characters: " +
        JSON.stringify(roleName)
    );
  }
  if (!identRe.test(dbName)) {
    throw new Error(
      "buildCleanupSequence: dbName has unexpected characters: " +
        JSON.stringify(dbName)
    );
  }
  for (const t of tableNames) {
    if (typeof t !== "string" || t.length === 0) {
      throw new Error("buildCleanupSequence: tableNames must contain non-empty strings");
    }
    // Reject obvious injection: semicolon, comment markers.
    // Schema-qualified names (schema.table, "schema"."table") are allowed.
    if (/;|--|\/\*/.test(t)) {
      throw new Error(
        "buildCleanupSequence: table name contains forbidden characters: " +
          JSON.stringify(t)
      );
    }
  }

  const lines = [
    guardDoBlocks,
    `REVOKE ALL PRIVILEGES ON DATABASE "${dbName}" FROM ${roleName};`,
    `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${roleName};`,
  ];
  for (const t of tableNames) {
    lines.push(`DROP TABLE IF EXISTS ${t};`);
  }
  lines.push(`DROP OWNED BY ${roleName};`);
  lines.push(`DROP ROLE IF EXISTS ${roleName};`);
  return lines.join("\n");
}

// ── Public API 1: production path ───────────────────────────────────
// R20-4b: the guard is constructed INTERNALLY. Callers pass authoritative
// identity params; they cannot omit, weaken, or substitute the guard.
export function buildCleanupSequence({
  roleName,
  dbName,
  tableNames,
  expectedDbName,
  expectedClusterId,
}) {
  const guardDoBlocks = buildCleanupGuard({ expectedDbName, expectedClusterId });
  return assembleCleanupSequence({ roleName, dbName, tableNames, guardDoBlocks });
}

// ── Public API 2: test-only escape hatch ────────────────────────────
// Used EXCLUSIVELY by negative tests (R19-5a, R19-5c, R20-4d) that must
// inject a deliberately wrong guard to prove fail-closed behavior. The
// "ForTest" suffix signals intent and prevents accidental misuse.
export function buildCleanupSequenceForTest({
  roleName,
  dbName,
  tableNames,
  guardDoBlocks,
}) {
  return assembleCleanupSequence({ roleName, dbName, tableNames, guardDoBlocks });
}

export const __test__ = {
  buildCleanupGuard,
  buildCleanupSequence,
  buildCleanupSequenceForTest,
};