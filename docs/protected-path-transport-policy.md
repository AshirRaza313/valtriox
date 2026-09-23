# Protected Path Transport Policy

**Last Updated:** 2026-09-22

**Related:** PR #15 (`audit-harness`), Round 11 R6 → Round 12 R12-5 → Round 13 R13-4

**Scope:** Real-mode execution of `scripts/audit/notification-inventory.mjs` via `.github/workflows/audit-harness.yml`

## Purpose

This document defines the transport, binding, execution, and exposure controls that are **actually enforced** on the protected (real-mode) audit path. It is intentionally narrow and reflects the current code and workflow state — not aspirational goals. Any control not enforced is listed in **Section 6 (Known Gaps / Not Enforced)**.

## 1. Secure PostgreSQL Transport

### Enforced

- **TLS mode:** `sslmode` is derived from the `sslmode` query parameter on `DATABASE_URL_READONLY`; when absent it defaults to `require`. This is set on the `psql` connection via `PGSSLMODE`.  
  *(Source: `notification-inventory.mjs`, `pgEnv` construction.)*

- **Non-localhost target enforced in real mode:** After target-identity verification, `actualHost` is rejected if it equals the literal strings `"localhost"` or `"127.0.0.1"`.  
  Error: `Real audit requires non-localhost target.`

### Not Enforced (see Section 6)

- Certificate chain verification (`verify-ca` / `verify-full`).
- Blocking of IPv6 loopback (`::1`) or RFC1918 private ranges.

### ⏳ Owner Decision Pending — TLS Server Verification

`sslmode=require` encrypts but does **not** validate the server certificate
chain. Full verification requires `sslmode=verify-full` (or `verify-ca`) plus
a CA certificate on the runner.

**Status:** **Owner decision pending.**

The choice between `require` (current default) and `verify-full` is a
policy decision that requires an explicit owner sign-off. Until decided:

- The code defaults to `require` (encryption without cert-chain verification).
- Weak modes (`disable`, `allow`, `prefer`) are fail-closed rejected (R12-3b).
- `verify-ca` and `verify-full` are accepted if explicitly set on
  `DATABASE_URL_READONLY`.

**Owner action required:**
1. Decide whether the protected path requires `verify-full`.
2. If yes, provision a CA cert on the runner and update the secret URL to
   include `sslmode=verify-full`.
3. Record the decision here with date and reviewer.

**Not an enforced constraint yet.** See Section 6 for the technical impact.

## 2. Trusted Workflow Binding

### Enforced

The real-mode audit receipt binds the following upstream identities. Every field is required in real mode; missing values cause a fail-closed `AuditError`.

| Receipt field | Source | Enforced check |
|---|---|---|
| `upstream_workflow_sha` | `workflow_run.head_sha` (immutable) | `UPSTREAM_WORKFLOW_SHA required in real mode.` |
| `upstream_run_id` | `workflow_run.id` | `UPSTREAM_RUN_ID required in real mode.` |
| `upstream_run_attempt` | `workflow_run.run_attempt` | `UPSTREAM_RUN_ATTEMPT required in real mode.` |
| `upstream_pr_number` | `workflow_run.pull_requests[0].number` | `UPSTREAM_PR_NUMBER required in real mode.` |

The workflow SHA is consumed directly from the immutable `workflow_run` payload — the workflow does **not** re-fetch PR head at runtime.

### Artifact Naming

The protected-path receipt artifact is uploaded with the name:

```text
real-inventory-receipt-<UPSTREAM_WORKFLOW_SHA>-<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT>
```

This triple binds the artifact to a specific trusted workflow execution attempt, not just to a run. Re-running the same workflow re-produces a distinct artifact.

**Uploaded paths:**

```text
backups/historical-rows-inventory-receipt.json
backups/historical-rows-inventory-receipt.json.sha256
```

## 3. Effective Role Binding

### Enforced

- **Effective role match (R12-3c):** `current_user` AND `session_user` are
  read in a single query and **matched fail-closed** against the
  `PG_EXPECTED_EFFECTIVE_ROLE` env var. Mismatch on either raises
  `Effective role mismatch (current_user). ...` or
  `Effective role mismatch (session_user). ...`

- **Ambient read-only state:** `current_setting('transaction_read_only')`
  must equal `on` on the role-check connection.
  Error: `transaction_read_only is not on`.

- **Per-connection read-only enforcement (R12-3d):** every psql invocation
  (except the ambient role check) wraps its SQL in
  `BEGIN READ ONLY; ...; COMMIT;` so PostgreSQL itself rejects writes on
  every connection, not just the first.

- **Target identity:** verified via SHA-256 hash of `user@host:port/database`
  before any data query executes.
  Error: `Target identity mismatch.`

- **Receipt fields:** `database_role` records `current_user`, `session_user`,
  `expected_effective_role`, and `match` (boolean).

### Not Enforced (see Section 6)

- `current_role` reconciliation (e.g., `SET ROLE` side effects).
- Role membership / `pg_auth_members` inspection.
- `SET SESSION AUTHORIZATION` detection.

Note: PostgreSQL's `current_role` is a synonym for `current_user`. The R12-3c check against `current_user` already covers `SET ROLE` side effects on the role-check connection; no separate `current_role` query is needed.

## 3b. Test Coverage Note (Round 14 R14-3)

The audit harness has two integration test tiers against real PostgreSQL:

| Test File | What it exercises | Scope |
|-----------|-------------------|-------|
| `real-psql-integration.test.mjs` | Raw `psql` CLI behavior — BEGIN/COMMIT tags, tab output, error propagation, read-only enforcement | **psql command layer only.** Uses a standalone `psql()` helper (a copy of the harness's logic), NOT `runInventory()`. |
| `production-path.test.mjs` | Actual `runInventory()` end-to-end against a disposable SSL-enabled PostgreSQL | **Actual `runInventory()` database path tested against a disposable PostgreSQL with mocked Git** — pin check, target identity, role binding, schema qualification, relation kind, grants, version, counts, receipt. |

**Coverage claim (narrowed):** The real-psql test alone does **not** validate the production path — it validates the underlying psql command contract. Coverage of `runInventory()`'s database path requires `production-path.test.mjs`, which imports and calls `runInventory()`.

Both tests run in CI, each with a disposable non-production database. Neither touches the protected or production database.

## 4. Bounded `psql` Execution

### Enforced

Every `psql` invocation runs with the following bounds:

| Bound | Value | Error on breach |
|---|---|---|
| `maxBuffer` | 10 MB (`10 * 1024 * 1024`) | `psql failed: <stderr>` |
| `timeout` | 30 000 ms (30 s) | `psql timed out after 30000ms (SIGTERM)` |

Constants are defined at module scope inside `runInventory()`:

```javascript
const PSQL_TIMEOUT_MS = 30_000;
const PSQL_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
```

The timeout is detected explicitly via `result.signal === "SIGTERM" && result.status === null`; without this branch the generic error path would emit a misleading `psql failed: unknown`.

## 5. Log / Artifact Exposure Policy

### Enforced

- No secret values are written to stdout, stderr, or the receipt.
- The connection password (`PGPASSWORD`) and the raw `DATABASE_URL_READONLY` string are never printed, logged, or serialized.
- Target identity is represented only as a SHA-256 hash; the raw username, host, port, and database values are not written to the receipt.
- The receipt's target_identity field contains a SHA-256 digest of user@host:port/database; script_sha256 contains a SHA-256 digest of the harness file. pin_identity stores raw 40-character git SHAs (public identifiers, not secrets, not SHA-256 computed by us).

### Log Verbosity in Real Mode (Round 12 R12-5)

In real mode (`AUDIT_MODE=real`), the harness defaults to **minimal logging**:

| Output | Minimal (default in real) | Full (opt-in via `AUDIT_LOG_VERBOSITY=full`) |
|--------|---------------------------|----------------------------------------------|
| Status checks (✅/❌ lines) | Printed | Printed |
| `pg_version` string | Printed | Printed |
| `search_path` | Printed | Printed |
| Receipt JSON dump | **Suppressed** | Printed |
| Aggregate inventory counts (total, read, unread, etc.) | **Suppressed** | Printed |
| Receipt file written to disk | ✅ (uploaded as artifact) | ✅ |

Rationale: the repository is public. Aggregate Production counts and the full
receipt (which includes bound identities, target hash, etc.) must not leak
into public workflow logs or public artifacts. The receipt file is uploaded
as a build artifact, so its contents are also subject to repository visibility.

**Exposure status — Owner decision pending:**

- Minimal logging in real mode is the code-level default (R12-5).
- Receipt artifact visibility is governed by repository visibility.
- Owner decision on public-repo artifact exposure is **pending** (see
  "Receipt Artifact Visibility" below).

**Correction (R14-2):** Prior revisions of this document implied the
exposure policy was "owner-approved" and the receipt was "aggregate-free".
Both claims were **inaccurate**. The actual state: the receipt **redacts**
aggregate counts by default in real mode; raw counts appear only when
`AUDIT_RECEIPT_REDACT=false` is explicitly set. The owner has not yet
decided whether public artifact exposure is acceptable.

**Count redaction (R14-2):** In real mode, receipt `inventory_summary`
counts are **redacted by default** (`AUDIT_RECEIPT_REDACT` unset → redacted).
The redacted form:

```json
{
  "inventory_summary": {
    "_redacted": true,
    "_reason": "Aggregate counts withheld from public receipt artifact...",
    "core_counts_snapshot_consistent": true,
    "receipt_counts_snapshot_consistent": false
  }
}
```

### ⏳ Owner Decision Pending — Receipt Artifact Visibility

The protected-path receipt artifact (`real-inventory-receipt-...`) is uploaded
via `actions/upload-artifact@v4`. **Its visibility depends on repository
visibility**, which is a separate policy decision.

**Current state:**
- Repository visibility: **public** (needs confirmation via owner decision).
- Artifact visibility: inherits repository-level access controls.
- Artifact content (R14-2 default): sanitized — target identity stored as
SHA-256 digest, script stored as SHA-256 digest, raw 40-char git SHAs
(public identifiers), no raw secrets, and aggregate counts redacted
(inventory_summary._redacted: true).
- Artifact content (if `AUDIT_RECEIPT_REDACT=false` set): contains raw
  aggregate counts. The protected workflow does not set this env var.

**Owner decision required:**
1. Confirm whether the repository (and therefore the receipt artifact) is
   intended to be public or private.
2. If public: confirm that the receipt's contents are acceptable for public
exposure. Current default (R14-2): target identity stored as SHA-256
digest, script stored as SHA-256 digest, raw 40-char git SHAs (public
identifiers), no raw secrets, and aggregate counts are redacted
(inventory_summary._redacted: true). If AUDIT_RECEIPT_REDACT=false is
ever set, the receipt will contain raw aggregate counts — this must not be
enabled in the protected path without explicit owner review.
3. If restricted: move receipt artifacts to a private location or restrict
   access via GitHub artifact permissions.

**Not an enforced constraint yet.** Until the owner decides, the receipt
artifact is accessible to anyone with repository read access.

### Retention

| Workflow | Artifact | Retention |
|----------|----------|-----------|
| `audit-harness.yml` (protected path) | `real-inventory-receipt-...` | 90 days |
| `baseline-pr-validation.yml` (ordinary CI) | `catalog-comparison-...`, `path-b-*` | 30 days |

The protected-path retention is 90 days; ordinary CI uses 30 days.

## 6. Known Gaps / Not Enforced

The following items are **not currently enforced by code or workflow**.
They are listed for transparency and are candidates for a follow-up PR.

### Owner Decisions Pending

The following items are **owner-controlled gates**. They are not enforced by code and cannot be progressed from this PR branch — each requires an explicit owner (or independent custodian) action outside this PR.

| Item | Status | Owner action |
|------|--------|--------------|
| TLS server verification (`verify-full` vs `require`) | **Pending owner-controlled gate** | Owner — see Section 1 |
| Receipt artifact visibility (public repo) | **Pending owner-controlled gate** | Owner — see Section 5 |
| `PG_EXPECTED_EFFECTIVE_ROLE` value | **Pending owner-controlled gate** | Independent custodian — no real value configured in this PR |
| production-audit secret config | **Pending owner-controlled gate** | Separate authorization — secret provisioning outside this PR |
| `TRUSTED_HARNESS_SHA` re-pin | **Pending owner-controlled gate** | Post-merge — pin advances only after merge |
| Admin-bypass disable (branch protection) | **Pending owner-controlled gate** | Repository admin (@abdulnafa) — settings change outside code |

| # | Gap | Impact | Mitigation today |
|---|---|---|---|
| 1 | `sslmode=require` default does not verify the certificate chain | MITM risk during transport if a hostile endpoint is reachable | **Owner decision pending** — see Section 1 |
| 2 | Non-localhost check only blocks literal `"localhost"` / `"127.0.0.1"` | IPv6 `::1`, RFC1918 private ranges, and DNS aliases are not rejected | Relies on target-identity hash match (`PG_EXPECTED_HOST`) |
| 3 | No role-membership inspection | Inherited privileges via group roles not enumerated | Write-grant checks (has_table_privilege) run as current_user and cover inherited privileges |
| 4 | Retention inconsistent between workflows (90 vs 30 days) | Cosmetics / policy clarity | None — documented here |
| 5 | No explicit statement_timeout set on the DB session | A slow but non-hanging query could consume up to 30 s per psql invocation | Client-side timeout: 30 s per psql call |

## 7. References

- `scripts/audit/notification-inventory.mjs` — real-mode audit harness
- `.github/workflows/audit-harness.yml` — trusted workflow (`workflow_run`)
- `.github/workflows/baseline-pr-validation.yml` — ordinary CI
- `docs/audit-privilege-scope.md` — privilege scope documentation (R5)
- PostgreSQL libpq docs — `sslmode` values
- GitHub Actions docs — `workflow_run` payload, `run_attempt`

---

**End of documentation**