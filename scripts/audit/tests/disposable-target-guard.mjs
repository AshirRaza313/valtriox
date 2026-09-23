// ============================================================================
// Disposable-target guard — Round 15 R15-1
// ============================================================================
// Expert Round 14 feedback: "production-path.test.mjs supplied
// TEST_DATABASE_URL par disposable target prove karne se pehle Notification
// tables aur role drop/create karta hai. Is destructive setup ke liye
// fail-closed disposable-target boundary chahiye."
//
// This guard refuses to proceed if the target URL is not provably
// disposable. Called BEFORE any DDL statement in test setup.
//
// Allowed hosts: localhost, 127.0.0.1, ::1, test-db.local
// Allowed dbname pattern: must contain one of test/audit/disposable/tmp/ci
//
// Throws Error (not process.exit) so callers and tests can handle it.
// ============================================================================

const ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "test-db.local",
]);

const DISPOSABLE_DB_PATTERN = /(test|audit|disposable|tmp|ci)/i;

export function assertDisposableTarget(urlString, { label = "TEST_DATABASE_URL" } = {}) {
  if (!urlString || typeof urlString !== "string") {
    throw new Error(`${label}: not set or not a string`);
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`${label}: invalid URL`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      `${label}: protocol must be postgres:// or postgresql:// (got "${parsed.protocol}")`
    );
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `Refusing destructive DDL: ${label} host "${host}" is not a disposable target ` +
      `(allowed: ${[...ALLOWED_HOSTS].join(", ")})`
    );
  }

  if (!DISPOSABLE_DB_PATTERN.test(dbName)) {
    throw new Error(
      `Refusing destructive DDL: ${label} database name "${dbName}" does not match ` +
      `disposable pattern (must contain one of: test, audit, disposable, tmp, ci)`
    );
  }

  return { host, dbName, parsed };
}

export const __test__ = {
  ALLOWED_HOSTS,
  DISPOSABLE_DB_PATTERN,
};