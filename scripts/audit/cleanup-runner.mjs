// R19-5: Shared cleanup runner — exercises the EXACT production cleanup
// path so wrong-identity tests are not reduced copies.
//
// Expert Round 18 (P0 Blocker #3):
//   "Real-psql test reduced copied cleanup sequence chalata hai. Actual
//    production cleanup mein REVOKE, DROP OWNED aur DROP ROLE ka different
//    sequence hai."
//
// This module is the single source of truth for the cleanup sequence.
// Both real-psql-integration.test.mjs and production-path.test.mjs import
// from here — no duplication, no drift.

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

// Build the EXACT production cleanup sequence as a single SQL string.
// Order matters — this is the sequence used by production-path.test.mjs
// and any test that needs to exercise the real cleanup.
//
// Parameters:
//   roleName       — per-run role (e.g. audit_ro_<run>_<attempt>_<hex>)
//   dbName         — database name (must match guard)
//   tableNames     — array of fully-qualified table names to drop
//   guardDoBlocks  — output of buildCleanupGuard() — MUST be non-empty
export function buildCleanupSequence({
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

export const __test__ = { buildCleanupGuard, buildCleanupSequence };