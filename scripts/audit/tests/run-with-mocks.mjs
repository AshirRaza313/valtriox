#!/usr/bin/env node
// ============================================================================
// Test-only wrapper for notification-inventory.mjs
// ============================================================================
// This file is NEVER invoked in production.
//
// Purpose:
//   - Production CLI (`notification-inventory.mjs`) uses hardcoded binaries
//     (`psql`, `git`) with NO override capability.
//   - Tests need to inject mock commands (`mock-psql.mjs`, `mock-git.mjs`).
//   - This wrapper imports the real `runInventory()` function and passes
//     the mock commands explicitly as function parameters.
//
// Trust boundary:
//   - Production: `node notification-inventory.mjs` → ["psql"], ["git"]
//   - Tests:      `node run-with-mocks.mjs`        → mock commands
//
//   Command injection is a FUNCTION PARAMETER only — no env var override
//   exists in the real script.
//
// Usage (from test files):
//   spawnSync("node", ["scripts/audit/tests/run-with-mocks.mjs"], { env })
//
// Environment (read by real script, unchanged):
//   AUDIT_MODE, DATABASE_URL_READONLY, UPSTREAM_*,
//   PG_EXPECTED_*, EXPECTED_SCRIPT_SHA256
// ============================================================================

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInventory } from "../notification-inventory.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPsqlPath = join(__dirname, "mock-psql.mjs");
const mockGitPath = join(__dirname, "mock-git.mjs");

runInventory({
  psqlCmd: [process.execPath, mockPsqlPath],
  gitCmd: [process.execPath, mockGitPath],
}).catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});