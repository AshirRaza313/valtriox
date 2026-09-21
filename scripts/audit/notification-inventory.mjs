#!/usr/bin/env node
// ============================================================================
// TRUSTED audit harness — zero npm dependencies.
// Uses psql CLI (pre-installed on ubuntu-latest runners) for PostgreSQL access.
// This file is the immutable baseline; PRs cannot modify it after merge to main.
//
// Round 5 → Round 9 fixes:
// - Fixed `actualGitSha` undefined reference (was `harnessGitSha`)
// - Fixed `writeGrants` undefined reference
// - Removed duplicate `grants_summary` key
// - Strict version fail-closed with regex match
// - Real mode rejects unknown Git HEAD + missing EXPECTED_SCRIPT_SHA256
// - safeParseInt() strict numeric + range validation
// - Core notification counts single snapshot-consistent query
// - Count invariants: total=read+unread, total=orgWide+targeted
//
// Round 9 — GENUINELY SEPARATE test boundary:
// - Command injection via FUNCTION PARAMETERS only (no env var override)
// - Real CLI: uses hardcoded ["psql"] and ["git"]
// - Tests: scripts/audit/tests/run-with-mocks.mjs imports runInventory()
//   and passes mock commands explicitly
// - NO override capability exists in production path
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

// ── Script identity (module-level self-hash) ─────────────────────────────
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_SHA256 = createHash("sha256")
  .update(readFileSync(SCRIPT_PATH))
  .digest("hex");

// ── Error type for fail-closed exits ─────────────────────────────────────
class AuditError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "AuditError";
  }
}

// ── Utility: safe integer parser ─────────────────────────────────────────
function safeParseInt(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new AuditError(`${label} returned non-numeric value: "${value}"`);
  }
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < min || n > max) {
    throw new AuditError(`${label} out of range [${min}, ${max}]: ${n}`);
  }
  return n;
}

// ── Identity hash ────────────────────────────────────────────────────────
function hashIdentity({ username, host, port, database }) {
  return createHash("sha256")
    .update(`${username}@${host}:${port}/${database}`)
    .digest("hex");
}

/**
 * Run the protected inventory audit.
 *
 * @param {Object} options
 * @param {string[]} [options.psqlCmd=["psql"]] - Command array for psql
 * @param {string[]} [options.gitCmd=["git"]]   - Command array for git
 * @returns {Promise<{receipt: object, receiptPath: string, receiptHash: string}>}
 * @throws {AuditError} on any fail-closed violation
 */
export async function runInventory(options = {}) {
  const psqlCmd =
    Array.isArray(options.psqlCmd) && options.psqlCmd.length > 0
      ? options.psqlCmd
      : ["psql"];
  const gitCmd =
    Array.isArray(options.gitCmd) && options.gitCmd.length > 0
      ? options.gitCmd
      : ["git"];

  // codeql[js/clear-text-logging] -- false positive: see docs/codeql-alert-52-disposition.md
  const log = (msg) => console.log(msg);

  // ── Config from env ────────────────────────────────────────────────────
  const AUDIT_MODE = (process.env.AUDIT_MODE || "ci-smoke").toLowerCase();
  const IS_REAL = AUDIT_MODE === "real";

  // Round 12 R12-5: log verbosity control. In real mode, default to
  // "minimal" so receipt JSON and aggregate counts never appear in
  // public workflow logs. Explicit opt-in via AUDIT_LOG_VERBOSITY=full
  // is required to restore full logging (only for private/diagnostic runs).
  const requestedVerbosity = (process.env.AUDIT_LOG_VERBOSITY || "").toLowerCase();
  const LOG_VERBOSITY = IS_REAL
    ? requestedVerbosity === "full"
      ? "full"
      : "minimal"
    : "full";
  const IS_MINIMAL_LOG = LOG_VERBOSITY === "minimal";

  const readonlyUrl = process.env.DATABASE_URL_READONLY;
  if (!readonlyUrl) throw new AuditError("DATABASE_URL_READONLY is required.");

  const expectedVersion = process.env.PG_EXPECTED_VERSION;
  const expectedHost = process.env.PG_EXPECTED_HOST;
  const expectedPort = process.env.PG_EXPECTED_PORT || "5432";
  const expectedDatabase = process.env.PG_EXPECTED_DATABASE || "postgres";
  const expectedUsername = process.env.PG_EXPECTED_USERNAME;
  const expectedEffectiveRole = process.env.PG_EXPECTED_EFFECTIVE_ROLE;
  const expectedScriptHash = process.env.EXPECTED_SCRIPT_SHA256;

  // ── Trusted pin (immutable commit identity) ──────────────────────────────
const expectedPinSha = process.env.EXPECTED_PIN_SHA;

  // ── Git HEAD via injected command ──────────────────────────────────────
  let actualGitSha = "unknown";
  try {
    const [bin, ...prefix] = gitCmd;
    const result = spawnSync(bin, [...prefix, "rev-parse", "HEAD"], {
      encoding: "utf8",
    });
    if (result.status === 0 && result.stdout) {
      actualGitSha = result.stdout.trim();
    }
  } catch {}

  // ── Upstream (triggering baseline run) identity ─────────────────────────
  const upstreamWorkflowSha = process.env.UPSTREAM_WORKFLOW_SHA || "unknown";
  const upstreamRunId = process.env.UPSTREAM_RUN_ID || "unknown";
  const upstreamRunAttempt = process.env.UPSTREAM_RUN_ATTEMPT || "unknown";
  const upstreamPrNumber = process.env.UPSTREAM_PR_NUMBER || "unknown";

  // ── Trusted (current audit-harness run) identity ────────────────────────
  // Round 12 R12-2: trusted run identity is bound separately from upstream
  // identity, so receipts unambiguously identify both workflows.
  const trustedRunId = process.env.TRUSTED_RUN_ID || "unknown";
  const trustedRunAttempt = process.env.TRUSTED_RUN_ATTEMPT || "unknown";

  log(`Trusted harness SHA:   ${actualGitSha}`);
  log(`Upstream workflow SHA: ${upstreamWorkflowSha}`);
  log(`Upstream run ID:       ${upstreamRunId}`);
  log(`Upstream run attempt:  ${upstreamRunAttempt}`);
  log(`Upstream PR number:    ${upstreamPrNumber}`);
  log(`Trusted run ID:        ${trustedRunId}`);
  log(`Trusted run attempt:   ${trustedRunAttempt}`);
  log(`Audit Mode: ${AUDIT_MODE}${IS_REAL ? " (STRICT)" : " (smoke)"}`);
  log(`Script SHA256: ${SCRIPT_SHA256.slice(0, 16)}...`);

  // ── Real-mode: pin identity fail-closed ──────────────────────────────────
  if (IS_REAL) {
    if (!expectedPinSha) {
      throw new AuditError("EXPECTED_PIN_SHA required in real mode.");
    }
    if (actualGitSha === "unknown") {
      throw new AuditError("Real mode requires valid git HEAD for pin verification.");
    }
    if (expectedPinSha !== actualGitSha) {
      throw new AuditError(
        `Pin identity mismatch.\n  expected_pin: ${expectedPinSha}\n  checked_out_head: ${actualGitSha}`
      );
    }
    log(`✅ Pin identity verified (${actualGitSha.slice(0, 8)}...)`);
  }

  // ── Real-mode: enforce UPSTREAM_* presence ─────────────────────────────
  if (IS_REAL) {
    if (upstreamWorkflowSha === "unknown") {
      throw new AuditError("UPSTREAM_WORKFLOW_SHA required in real mode.");
    }
    if (upstreamRunId === "unknown") {
      throw new AuditError("UPSTREAM_RUN_ID required in real mode.");
    }
    if (upstreamPrNumber === "unknown") {
      throw new AuditError("UPSTREAM_PR_NUMBER required in real mode.");
    }
    if (upstreamRunAttempt === "unknown") {
      throw new AuditError("UPSTREAM_RUN_ATTEMPT required in real mode.");
    }
    if (trustedRunId === "unknown") {
      throw new AuditError("TRUSTED_RUN_ID required in real mode.");
    }
    if (trustedRunAttempt === "unknown") {
      throw new AuditError("TRUSTED_RUN_ATTEMPT required in real mode.");
    }
    if (actualGitSha === "unknown") {
      throw new AuditError("Real mode requires valid git HEAD (git rev-parse failed).");
    }
    if (!expectedScriptHash) {
      throw new AuditError("EXPECTED_SCRIPT_SHA256 required in real mode.");
    }
  }

  // ── Script integrity check ─────────────────────────────────────────────
  if (IS_REAL && expectedScriptHash !== SCRIPT_SHA256) {
    throw new AuditError(
      `Script integrity check failed.\n  expected: ${expectedScriptHash}\n  actual:   ${SCRIPT_SHA256}`
    );
  }

  // ── Parse + verify target identity ─────────────────────────────────────
  const parsed = new URL(readonlyUrl);

  // Round 12 R12-3a: reject non-PostgreSQL URI schemes fail-closed.
  // Follows existing repo pattern (scripts/baseline/safety-guard.cjs,
  // scripts/baseline/capture-full-catalog.cjs).
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new AuditError(
      `Unsupported database URI protocol: "${parsed.protocol}". ` +
      `Expected "postgres:" or "postgresql:".`
    );
  }

  const actualUsername = decodeURIComponent(parsed.username);
  const actualHost = parsed.hostname;
  const actualPort = parsed.port || "5432";
  const actualDatabase = parsed.pathname.replace(/^\//, "");

  const expectedHash =
    expectedUsername && expectedHost
      ? hashIdentity({
          username: expectedUsername,
          host: expectedHost,
          port: expectedPort,
          database: expectedDatabase,
        })
      : null;
  const actualHash = hashIdentity({
    username: actualUsername,
    host: actualHost,
    port: actualPort,
    database: actualDatabase,
  });

  if (IS_REAL) {
    if (!expectedUsername) throw new AuditError("PG_EXPECTED_USERNAME required in real mode.");
    if (!expectedHost) throw new AuditError("PG_EXPECTED_HOST required in real mode.");
    if (!expectedEffectiveRole) {
      throw new AuditError("PG_EXPECTED_EFFECTIVE_ROLE required in real mode.");
    }
    if (expectedHash !== actualHash) {
      throw new AuditError(
        `Target identity mismatch.\n  expected_hash: ${expectedHash}\n  actual_hash:   ${actualHash}`
      );
    }
    if (actualHost === "localhost" || actualHost === "127.0.0.1") {
      throw new AuditError("Real audit requires non-localhost target.");
    }
    log(`✅ Target identity verified (hash: ${actualHash.slice(0, 16)}...)`);
  }

  // ── psql runner via injected command ───────────────────────────────────
  const sslmode = parsed.searchParams.get("sslmode") || "require";

  // Round 12 R12-3b: reject weak sslmode values fail-closed.
  // Reference: PostgreSQL libpq sslmode values.
  //   disable / allow / prefer → weak (allow plaintext fallback or no TLS)
  //   require / verify-ca / verify-full → acceptable (TLS enforced)
  const ALLOWED_SSLMODES = new Set(["require", "verify-ca", "verify-full"]);
  if (!ALLOWED_SSLMODES.has(sslmode)) {
    throw new AuditError(
      `Weak sslmode rejected: "${sslmode}". ` +
      `Allowed: require, verify-ca, verify-full.`
    );
  }

  const pgEnv = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGUSER: actualUsername,
    PGHOST: actualHost,
    PGPORT: actualPort,
    PGDATABASE: actualDatabase,
    PGSSLMODE: sslmode,
  };

  // Bounded psql execution (Round 11 R6):
  //   - maxBuffer: 10 MB  — prevents unbounded stdout accumulation
  //   - timeout:   30 s    — prevents indefinite hangs
  const PSQL_TIMEOUT_MS = 30_000;
  const PSQL_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

  // Round 12 R12-3d: every psql invocation runs inside an explicit
  // `BEGIN READ ONLY; ... COMMIT;` transaction so PostgreSQL itself
  // enforces read-only mode per-connection, not just the ambient
  // session default. This closes the gap where only the first connection
  // (role check) was verified.
  //
  // The ambient role-check query opts out via `readOnlyGuard: false` — it
  // needs to read the session's true `transaction_read_only` value.
  function psql(sql, { readOnlyGuard = true } = {}) {
    const [bin, ...prefix] = psqlCmd;
    const guardedSql = readOnlyGuard
      ? `BEGIN READ ONLY;\n${sql}\nCOMMIT;`
      : sql;
    const args = [...prefix, "-t", "-A", "-F", "\t", "-c", guardedSql];
    const result = spawnSync(bin, args, {
      env: pgEnv,
      encoding: "utf8",
      maxBuffer: PSQL_MAX_BUFFER_BYTES,
      timeout: PSQL_TIMEOUT_MS,
    });
    // Explicit timeout handling — spawnSync sets signal=SIGTERM, status=null
    // when the timeout fires. Without this, the generic error below would
    // report the misleading "psql failed: unknown".
    if (result.signal === "SIGTERM" && result.status === null) {
      throw new AuditError(
        `psql timed out after ${PSQL_TIMEOUT_MS}ms (SIGTERM)`
      );
    }
    if (result.status !== 0) {
      throw new AuditError(
        `psql failed: ${result.stderr || result.error?.message || "unknown"}`
      );
    }
    return result.stdout.trim();
  }

  // ── Role check (ambient session state — NO read-only guard) ────────────
  const roleLine = psql(
    "SELECT current_user, session_user, current_setting('transaction_read_only')",
    { readOnlyGuard: false }
  );
  const [currentUser, sessionUser, readOnly] = roleLine.split("\t");
  log(`Database role: current_user=${currentUser}, session_user=${sessionUser}`);
  log(`Read-only mode: ${readOnly}`);
  if (String(readOnly).toLowerCase() !== "on") {
    throw new AuditError("transaction_read_only is not on");
  }

  // Round 12 R12-3c: match returned role against expected effective role.
  // Fail-closed on either mismatch so SET ROLE / session authorization
  // side effects are surfaced.
  if (IS_REAL) {
    if (currentUser !== expectedEffectiveRole) {
      throw new AuditError(
        `Effective role mismatch (current_user). ` +
        `Expected "${expectedEffectiveRole}", got "${currentUser}"`
      );
    }
    if (sessionUser !== expectedEffectiveRole) {
      throw new AuditError(
        `Effective role mismatch (session_user). ` +
        `Expected "${expectedEffectiveRole}", got "${sessionUser}"`
      );
    }
    log(`✅ Effective role verified: ${expectedEffectiveRole}`);
  }

  // ── Schema binding check (explicit public schema) ──────────────────────
  const searchPath = psql("SHOW search_path");
  log(`search_path: ${searchPath}`);
  
  const schemaCheck = psql(`
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_namespace 
      WHERE nspname = 'public'
    )
  `);
  if (schemaCheck !== "t") {
    throw new AuditError("public schema not accessible");
  }
  log("✅ Schema qualification: public schema accessible");

  // ── Relation-kind check (fail-closed object identity) ──────────────────
  // Round 12 R12-4a: verify intended relations are ordinary or partitioned
  // tables (relkind in ('r','p')). This is the strongest object-identity
  // guarantee the harness supports. It is explicitly NOT a full object
  // identity check (columns, constraints, defaults, indexes are not
  // inspected) — that scope note is recorded in the receipt.
  const relationKindRow = psql(`
    SELECT c.relname, c.relkind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('Notification', 'NotificationReadReceipt')
    ORDER BY c.relname
  `);
  const relationKindLines = relationKindRow.split("\n").filter(Boolean);
  const expectedRelations = ["Notification", "NotificationReadReceipt"];
  const actualKinds = {};
  for (const line of relationKindLines) {
    const [name, kind] = line.split("\t");
    actualKinds[name] = kind;
  }
  for (const name of expectedRelations) {
    if (!actualKinds[name]) {
      throw new AuditError(`Expected relation public."${name}" not found.`);
    }
    if (actualKinds[name] !== "r" && actualKinds[name] !== "p") {
      throw new AuditError(
        `Unexpected relation kind for public."${name}": "${actualKinds[name]}". ` +
        `Expected "r" (ordinary) or "p" (partitioned).`
      );
    }
  }
  log(
    `✅ Relation kind verified: ${expectedRelations
      .map((n) => `public."${n}"=${actualKinds[n]}`)
      .join(", ")}`
  );

  // ── Table-level write privilege check ──────────────────────────────────
  const tableWriteCheck = psql(`
    SELECT COUNT(*) FROM (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(privilege_type)
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        AND pg_catalog.has_table_privilege(current_user, c.oid, p.privilege_type)
    ) t
  `);
  const tableWriteGrants = safeParseInt(tableWriteCheck, "table write grants");

  // ── Column-level write privilege check ─────────────────────────────────
  const columnWriteCheck = psql(`
    SELECT COUNT(*) FROM (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        AND a.attnum > 0 AND NOT a.attisdropped
      CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('REFERENCES')) AS p(privilege_type)
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        AND pg_catalog.has_column_privilege(current_user, c.oid, a.attname, p.privilege_type)
    ) t
  `);
  const columnWriteGrants = safeParseInt(columnWriteCheck, "column write grants");

  if (tableWriteGrants > 0 || columnWriteGrants > 0) {
    throw new AuditError(
      `Write grants detected. table=${tableWriteGrants}, column=${columnWriteGrants}`
    );
  }
  log(
    `Checked table (${tableWriteGrants}) and column (${columnWriteGrants}) DML privileges verified.`
  );

  // ── Version check (strict fail-closed) ─────────────────────────────────
  const pgVersion = psql("SELECT version()");
  log(`PostgreSQL Version: ${pgVersion}`);

  let pgVersionMatch = null;
  if (IS_REAL) {
    if (!expectedVersion) throw new AuditError("PG_EXPECTED_VERSION required in real mode.");
    const versionMatch = pgVersion.match(/PostgreSQL\s+(\d+\.\d+)/);
    if (!versionMatch) {
      throw new AuditError(`Could not parse PostgreSQL version from: ${pgVersion}`);
    }
    const actualVersion = versionMatch[1];
    if (actualVersion !== expectedVersion) {
      throw new AuditError(
        `Version mismatch. Expected "${expectedVersion}", got "${actualVersion}"`
      );
    }
    pgVersionMatch = true;
    log(`✅ PostgreSQL version strictly matches expected "${expectedVersion}"`);
  }

  // ── Core notification counts (single snapshot query) ───────────────────
  const inventoryRow = psql(`
    SELECT
      (SELECT COUNT(*) FROM public."Notification") AS total,
      (SELECT COUNT(*) FROM public."Notification" WHERE read = true) AS read_count,
      (SELECT COUNT(*) FROM public."Notification" WHERE read = false) AS unread_count,
      (SELECT COUNT(*) FROM public."Notification" WHERE "userId" IS NULL) AS org_wide,
      (SELECT COUNT(*) FROM public."Notification" WHERE "userId" IS NOT NULL) AS targeted,
      (SELECT COUNT(DISTINCT type) FROM public."Notification") AS distinct_types
  `);
  const [totalS, readS, unreadS, orgWideS, targetedS, typesS] = inventoryRow.split("\t");

  const total = safeParseInt(totalS, "notification total");
  const readCount = safeParseInt(readS, "read count");
  const unreadCount = safeParseInt(unreadS, "unread count");
  const orgWide = safeParseInt(orgWideS, "org-wide count");
  const targeted = safeParseInt(targetedS, "targeted count");
  const distinctTypes = safeParseInt(typesS, "distinct types");

  if (total !== readCount + unreadCount) {
    throw new AuditError(
      `Snapshot inconsistency: total=${total}, read=${readCount}, unread=${unreadCount}`
    );
  }
  if (total !== orgWide + targeted) {
    throw new AuditError(
      `Snapshot inconsistency: total=${total}, orgWide=${orgWide}, targeted=${targeted}`
    );
  }

  // ── Receipt counts (separate query — not same snapshot) ────────────────
  let receiptCount = 0;
  let distinctReceiptUsers = 0;
  try {
    receiptCount = safeParseInt(
      psql('SELECT COUNT(*) FROM public."NotificationReadReceipt"'),
      "notification receipt count"
    );
    distinctReceiptUsers = safeParseInt(
      psql('SELECT COUNT(DISTINCT "userId") FROM public."NotificationReadReceipt"'),
      "distinct receipt user count"
    );
  } catch (err) {
    throw new AuditError(
      `NotificationReadReceipt query failed (fail-closed): ${err.message}`
    );
  }

  if (IS_MINIMAL_LOG) {
    log(
      `Inventory counts captured (aggregate values withheld in real mode; ` +
      `see receipt artifact for details).`
    );
  } else {
    log(`\nTotal notifications: ${total}`);
    log(`Read: ${readCount}, Unread: ${unreadCount}`);
    log(`Org-wide: ${orgWide}, Targeted: ${targeted}`);
    log(`Distinct types: ${distinctTypes}`);
    log(`Read receipts: ${receiptCount}, distinct users: ${distinctReceiptUsers}`);
  }

  if (IS_REAL) {
    if (total === 0) throw new AuditError("Real audit requires non-empty Notification table.");
    if (distinctTypes === 0) {
      throw new AuditError("Real audit requires at least one notification type.");
    }
    if (orgWide === 0 && targeted === 0) {
      throw new AuditError("Real audit requires notification audience coverage.");
    }
  }

  // ── Receipt ────────────────────────────────────────────────────────────
  const receipt = {
    receipt_type: "PROTECTED_EXACT_HEAD_EXECUTION_RECEIPT",
    snapshot_scope: "core_notification_counts_only",
    schema_qualification: {
      search_path: searchPath,
      public_schema_verified: true,
      objects_used: [
        'public."Notification"',
        'public."NotificationReadReceipt"',
      ],
      relation_kinds: actualKinds,
      relation_kind_verified: true,
      scope_note:
        "Qualification covers public schema accessibility and relation " +
        "kind (relkind in {r, p}) only. It is NOT a full object identity " +
        "check — columns, constraints, defaults, indexes, and row-level " +
        "security policies are not inspected.",
    },

  // Trusted pin identity (mutually consistent identities)
    pin_identity: {
      expected_pin: expectedPinSha || null,
      checked_out_head: actualGitSha,
      match: IS_REAL ? expectedPinSha === actualGitSha : null,
    },
    audit_mode: AUDIT_MODE,
    timestamp: new Date().toISOString(),
    harness_git_sha: actualGitSha,
    upstream_workflow_sha: upstreamWorkflowSha,
    upstream_run_id: upstreamRunId,
    upstream_run_attempt: upstreamRunAttempt,
    upstream_pr_number: upstreamPrNumber,
    trusted_run_id: trustedRunId,
    trusted_run_attempt: trustedRunAttempt,
    evidence_binding: "upstream_workflow_sha",
    script_sha256: SCRIPT_SHA256,
    script_hash_verified: IS_REAL ? SCRIPT_SHA256 === expectedScriptHash : null,
    database_role: {
      current_user: currentUser,
      session_user: sessionUser,
      expected_effective_role: expectedEffectiveRole || null,
      match: IS_REAL
        ? currentUser === expectedEffectiveRole && sessionUser === expectedEffectiveRole
        : null,
    },
    target_identity: {
      expected_hash: expectedHash,
      actual_hash: actualHash,
      match: expectedHash === actualHash,
      has_project_ref: actualUsername.includes("."),
      is_localhost: actualHost === "localhost" || actualHost === "127.0.0.1",
    },
    grants_summary: {
      table_write_grants: tableWriteGrants,
      column_write_grants: columnWriteGrants,
    },
    pg_version: pgVersion,
    pg_expected_version: expectedVersion || null,
    pg_version_match: pgVersionMatch,
    read_only_mode_status: String(readOnly).toLowerCase() === "on" ? "on" : "off",
    inventory_summary: {
      total_notifications: total,
      read_count: readCount,
      unread_count: unreadCount,
      org_wide: orgWide,
      targeted: targeted,
      distinct_types: distinctTypes,
      core_counts_snapshot_consistent: true,
      notification_read_receipts: receiptCount,
      distinct_receipt_users: distinctReceiptUsers,
      receipt_counts_snapshot_consistent: false,
    },
  };

  mkdirSync("backups", { recursive: true });
  const receiptPath = "backups/historical-rows-inventory-receipt.json";
  const content = JSON.stringify(receipt, null, 2) + "\n";
  writeFileSync(receiptPath, content);
  const receiptHash = createHash("sha256").update(content).digest("hex");
  writeFileSync(receiptPath + ".sha256", receiptHash + "\n");

  if (IS_MINIMAL_LOG) {
    log(`Receipt written to ${receiptPath} (contents not printed in real mode).`);
  } else {
    log("\n===================================================");
    log(JSON.stringify(receipt, null, 2));
    log("===================================================");
    log(`Receipt saved: ${receiptPath}`);
  }

  return { receipt, receiptPath, receiptHash };
}

// ── CLI entry point (only runs when invoked directly) ────────────────────
const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  runInventory().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}