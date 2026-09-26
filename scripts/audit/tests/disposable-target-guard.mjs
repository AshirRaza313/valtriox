// ============================================================================
// Disposable-target guard — Round 18 R18-2
// ============================================================================
// Round 17 expert feedback (verbatim):
//   "Disposable marker independently trusted identity nahi hai. Workflow
//    pehle jis target se connect hota hai usi par marker create karta hai,
//    phir us marker ko proof maanta hai. Wrong writable target ko bhi
//    workflow khud 'disposable' label kar sakta hai."
//
//   "Disposable identity workflow ke destructive path se pehle
//    independently provisioned/trusted honi chahiye; guard apna proof
//    khud target par create na kare."
//
// Round 18 approach:
//   The per-run marker table is removed entirely. Identity is proven by a
//   fresh random database name provisioned by the CI workflow BEFORE any
//   destructive path runs:
//
//     1. Workflow step "Provision fresh disposable database for this run"
//        generates DB_NAME="audit_<run_id>_<attempt>_<random_hex>", runs
//        CREATE DATABASE "<DB_NAME>" against the disposable service
//        container, and exports DISPOSABLE_DB_NAME + TEST_DATABASE_URL via
//        $GITHUB_ENV.
//
//     2. The test reads DISPOSABLE_DB_NAME and cross-checks it against the
//        URL's dbname (defence in depth).
//
//     3. Before every destructive statement (setup AND cleanup), the test
//        embeds a DO block that asserts current_database() equals
//        DISPOSABLE_DB_NAME. The block runs inside the same psql -1
//        transaction as the DDL — a mismatch aborts before DDL executes.
//
//   The workflow does NOT write any "proof" object into the target — the
//   newly-provisioned database's existence is the identity. A random name
//   cannot accidentally match a pre-existing production database.
//
// Fail-closed: if DISPOSABLE_DB_NAME is missing/empty, we refuse.
// ============================================================================

export function assertDisposableTarget(
  urlString,
  { label = "TEST_DATABASE_URL", expectedDbName } = {}
) {
  if (!urlString || typeof urlString !== "string") {
    throw new Error(`${label}: not set or not a string`);
  }
  if (
    !expectedDbName ||
    typeof expectedDbName !== "string" ||
    expectedDbName.trim().length === 0
  ) {
    throw new Error(
      `DISPOSABLE_DB_NAME: not set or empty. The CI workflow must provision ` +
      `a fresh disposable database and expose its name via the ` +
      `DISPOSABLE_DB_NAME env var before this test runs.`
    );
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

  if (!host) throw new Error(`${label}: host missing`);
  if (!dbName) throw new Error(`${label}: database name missing`);

  if (dbName !== expectedDbName) {
    throw new Error(
      `Disposable-target guard: URL dbname "${dbName}" does not match ` +
      `DISPOSABLE_DB_NAME "${expectedDbName}". Refusing to proceed.`
    );
  }

  return { host, dbName, expectedDbName, parsed };
}

// Returns a SQL DO block that asserts current_database() equals the
// expected fresh database name. Embed at the top of the SAME psql -1
// invocation that runs destructive DDL — RAISE EXCEPTION aborts the
// enclosing transaction before any DDL executes.
export function buildDbNameVerificationDoBlock(expectedDbName) {
  if (
    !expectedDbName ||
    typeof expectedDbName !== "string" ||
    expectedDbName.trim().length === 0
  ) {
    throw new Error("buildDbNameVerificationDoBlock: expectedDbName is empty");
  }
  const escaped = expectedDbName.replace(/'/g, "''");
  return [
    "DO $$",
    "DECLARE actual_db text;",
    "BEGIN",
    "  SELECT current_database() INTO actual_db;",
    "  IF actual_db IS NULL OR actual_db <> '" + escaped + "' THEN",
    "    RAISE EXCEPTION 'Disposable DB name mismatch. Expected <" + escaped + ">, got <%>', actual_db;",
    "  END IF;",
    "END $$;",
  ].join("\n");
}

// Returns a SQL DO block that asserts the current cluster's system
// identifier matches the expected value. system_identifier is a stable,
// initdb-generated 64-bit value that uniquely identifies a PostgreSQL
// cluster (not just a database). It is immutable for the life of the
// cluster and requires superuser (or pg_read_all_stats) to read.
//
// Because roles in PostgreSQL are cluster-wide, proving which cluster
// the mutation will run against is critical: a fresh database name can
// exist on any cluster, so cluster identity is the trustworthy anchor.
// Embed this at the top of the SAME psql -1 transaction as the DDL —
// a mismatch aborts before any mutation runs.
export function buildClusterVerificationDoBlock(expectedClusterId) {
  if (
    !expectedClusterId ||
    typeof expectedClusterId !== "string" ||
    expectedClusterId.trim().length === 0
  ) {
    throw new Error("buildClusterVerificationDoBlock: expectedClusterId is empty");
  }
  const trimmed = expectedClusterId.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(
      "buildClusterVerificationDoBlock: expectedClusterId must be a decimal integer (got " +
      JSON.stringify(expectedClusterId) + ")"
    );
  }
  return [
    "DO $",
    "DECLARE actual_id text;",
    "BEGIN",
    "  SELECT system_identifier::text INTO actual_id FROM pg_control_system();",
    "  IF actual_id IS NULL OR actual_id <> '" + trimmed + "' THEN",
    "    RAISE EXCEPTION 'Cluster mismatch: expected " + trimmed + ", got %', actual_id;",
    "  END IF;",
    "END $;",
  ].join("\n");
}
export const __test__ = { buildDbNameVerificationDoBlock, buildClusterVerificationDoBlock };
