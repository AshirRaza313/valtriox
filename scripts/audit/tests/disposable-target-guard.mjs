// ============================================================================
// Disposable-target guard — Round 17 R17-1
// ============================================================================
// Round 16 expert feedback (verbatim):
//   "Current runtime check har private/RFC1918/link-local address ko
//    disposable maan leti hai. Private address disposable hone ka proof
//    nahi; private Production database bhi pass ho sakta hai."
//
// Round 17 approach:
//   Network-address classification is removed entirely. Instead, the
//   disposable target's identity is proven by a per-run marker injected
//   into the disposable database by the CI workflow (see the "Mark
//   database as disposable for this run" step in baseline-pr-validation.yml).
//
//   The test must verify the marker in the SAME database connection that
//   runs the destructive DDL (R17-2). This module provides:
//     - assertDisposableTarget(): URL shape + marker env presence check
//     - buildMarkerVerificationDoBlock(): SQL DO block that raises an
//       exception if the marker table content does not match the expected
//       per-run marker — callers embed this at the top of the same psql -c
//       that runs DDL, so a mismatch aborts the transaction before DDL.
//
// Fail-closed: if DISPOSABLE_DB_MARKER is missing/empty, we refuse.
// ============================================================================

export function assertDisposableTarget(
  urlString,
  { label = "TEST_DATABASE_URL", expectedMarker } = {}
) {
  if (!urlString || typeof urlString !== "string") {
    throw new Error(`${label}: not set or not a string`);
  }
  if (
    !expectedMarker ||
    typeof expectedMarker !== "string" ||
    expectedMarker.trim().length === 0
  ) {
    throw new Error(
      `DISPOSABLE_DB_MARKER: not set or empty. The CI workflow must inject ` +
      `a per-run marker into the disposable database and expose it via the ` +
      `DISPOSABLE_DB_MARKER env var before this test runs.`
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

  if (!host) {
    throw new Error(`${label}: host missing`);
  }
  if (!dbName) {
    throw new Error(`${label}: database name missing`);
  }

  return { host, dbName, expectedMarker, parsed };
}

// Same-connection marker verification: returns a SQL DO block that raises
// an exception if __disposable_marker does not contain exactly the expected
// marker. Callers embed this at the top of the SAME psql -c invocation that
// also runs destructive DDL. Because RAISE EXCEPTION aborts the enclosing
// transaction, DDL never executes on mismatch.
//
// The marker is escaped for single quotes to prevent SQL injection from the
// env value. That value is provided by the CI workflow, not by untrusted
// input, but escaping is still done for defence in depth.
export function buildMarkerVerificationDoBlock(expectedMarker) {
  if (
    !expectedMarker ||
    typeof expectedMarker !== "string" ||
    expectedMarker.trim().length === 0
  ) {
    throw new Error("buildMarkerVerificationDoBlock: expectedMarker is empty");
  }
  const escaped = expectedMarker.replace(/'/g, "''");
  return [
    "DO $$",
    "DECLARE m text;",
    "BEGIN",
    "  SELECT marker INTO m FROM __disposable_marker LIMIT 1;",
    "  IF m IS NULL THEN",
    "    RAISE EXCEPTION 'Disposable marker missing \u2014 refusing to proceed';",
    "  END IF;",
    "  IF m <> '" + escaped + "' THEN",
    "    RAISE EXCEPTION 'Disposable marker mismatch \u2014 refusing to proceed';",
    "  END IF;",
    "END $$;",
  ].join("\n");
}

export const __test__ = { buildMarkerVerificationDoBlock };
