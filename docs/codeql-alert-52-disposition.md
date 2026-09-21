# CodeQL Alert #52 — Disposition Record

**Alert:** `js/clear-text-logging` (CWE-532)
**Location:** `scripts/audit/notification-inventory.mjs:83`
**Date reviewed:** 2026-09-21
**Reviewer:** Ashir Raza
**Disposition:** **False positive — dismissed with justification**

## Data-Flow Review

### Source → Sink Path

process.env.* (source: all env vars treated as potentially sensitive)
→ local variable assignment
→ template literal interpolation
→ log(msg) call
→ console.log(msg) (sink: line 83)


### Actual Values Logged

All values passed to `log()` are non-sensitive public identifiers:

| Value | Source | Classification |
|-------|--------|----------------|
| `actualGitSha` | `git rev-parse HEAD` | Public commit SHA |
| `upstreamWorkflowSha` | `workflow_run.head_sha` | Public |
| `upstreamRunId`, `trustedRunId` | GitHub run IDs | Public |
| `upstreamRunAttempt`, `trustedRunAttempt` | Attempt numbers | Public |
| `upstreamPrNumber` | PR number | Public |
| `currentUser`, `sessionUser` | DB role names | Non-secret |
| `search_path` | Schema names | Non-secret |
| `pgVersion` | Version string | Public |

### Values NOT Passed to `log()`

- `PGPASSWORD` — never passed
- `DATABASE_URL_READONLY` (raw string) — never passed
- `EXPECTED_PIN_SHA`, `EXPECTED_SCRIPT_SHA256` — only in receipt file
- Aggregate counts — suppressed via `AUDIT_LOG_VERBOSITY` (R12-5)
- Receipt JSON — suppressed in real mode (R12-5)

## Mitigations Already in Place

1. **Real-mode minimal logging (R12-5):** `AUDIT_LOG_VERBOSITY=minimal` default in real mode suppresses receipt JSON dump and aggregate counts.
2. **No secret interpolation:** Secrets are never string-interpolated into any `log()` call. The only env var with a secret value (`PGPASSWORD`, `DATABASE_URL_READONLY`) is never referenced outside the psql subprocess env construction.
3. **Receipt contains hashes only:** The receipt file records SHA-256 digests for target identity and script hash — no raw secrets.

## Why This Is a False Positive

CodeQL's `js/clear-text-logging` rule flags **all** flows from `process.env.*` to `console.log()`. It cannot distinguish a secret env var from a public identifier env var. In this codebase:

- The env vars whose values are logged are **all public identifiers** (SHAs, run IDs, PR numbers, role names).
- The env vars containing secrets (`PGPASSWORD`, `DATABASE_URL_READONLY`) are **never** passed to `log()`.

This is a **known precision limitation** of the rule.

## References

- [CodeQL js/clear-text-logging rule](https://codeql.github.com/codeql-query-help/javascript/js-clear-text-logging/)
- [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- [GitHub code scanning alert triage](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/assessing-code-scanning-alerts-for-your-repository)