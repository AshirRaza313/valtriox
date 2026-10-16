# Valtriox RLS Audit — Phase A Containment

**Status:** Awaiting expert written approval (Phase A containment)  
**Prepared by:** Ashir Raza  
**Audit owner:** Abdul Nafay (@abdulnafa) — reviewer  
**Started:** 2026-10-04  
**Current wave:** Phase 11, Wave 3 (PR migration)

---

## 1. Purpose

This directory contains the complete evidence bundle for the Valtriox Row-Level Security (RLS) Broader Audit. The audit's immediate goal is **Phase A containment**: removing unauthorized public access to three production tables that were confirmed exposed.

**Phase A containment requires explicit written approval before any production mutation.** No `ALTER ROLE`, `REVOKE`, `GRANT`, `DROP`, or `NOLOGIN` has been executed or will be executed without that approval.

A separate approval track covers **NOLOGIN** (role login lockdown), which is intentionally held apart from Phase A per expert direction.

---

## 2. Scope — Phase A Containment

Three tables are in scope, all confirmed exposed in the pre-change snapshot:

1. `public."Subscription"`
2. `public."Notification"`
3. `public."PaymentProof"`

Containment action: revoke all privileges from `PUBLIC`, `anon`, and `authenticated` on these three tables. Rollback restores the pre-change grant set (including PostgreSQL 17 `MAINTAIN` privilege).

Out of scope for this PR:

- Broader RLS audit (Phase B — 9 additional tables)
- `42P17` recursion issue
- Default privileges
- `_prisma_migrations` RLS
- Frontend, dashboard, i18n, or any non-security changes

---

## 3. Approval Status

| Item | Status |
|---|---|
| Phase A containment (v3 SQL) | **PENDING** — awaiting expert written approval |
| Phase A rollback (v2 SQL) | Reference; execution separately authorized (break-glass only) |
| NOLOGIN (`execute.sql`) | **PENDING** — separate approval track |
| NOLOGIN rollback | Reference; break-glass only |

**Pre-execution requirements (per expert review):**

1. Full SQL hashes — see `bundle-manifest-v5.txt`
2. Target project / ref binding — see `evidence/` (Wave 4)
3. Clean branch SHA — this PR's head commit
4. Pre/post verification — see `post-verification-v5.md`
5. Precise table scope — this README, §2

---

## 4. File Manifest

See `bundle-manifest-v5.txt` for authoritative SHA256 + byte size per file. Summary below:

### Authoritative (approval-bound)

| File | Purpose |
|---|---|
| `phase-a-containment-v3.sql` | Exact containment SQL (revoke) |
| `phase-a-rollback-v2.sql` | Exact rollback SQL (grant) |
| `jit-checklist-v5.md` | Pre-execution checklist |
| `post-verification-v5.md` | Post-execution verification |
| `nologin-revalidation-checklist-v4.md` | NOLOGIN safety checklist (separate approval) |
| `break-glass-policy-v2.md` | Break-glass rollback policy |
| `maintain-pre-state-comparison.md` | Pre-state reference (PG17 `MAINTAIN`) |
| `pr-ci-binding-note.md` | CI/deployment binding note |
| `pg-version-proof.txt` | PG version evidence (17.6 production) |
| `bundle-manifest-v5.txt` | This manifest |

### Evidence (supporting)

| File | Purpose |
|---|---|
| `evidence/pg17-test-evidence-2026-10-12T18-45-06Z.txt` | Combined PG17 execution output |
| `evidence/pg17-fixtures.sql` | Reproducible fixture (roles, tables, RLS) |
| `evidence/jit-test-queries.sql` | Source SQL for JIT queries |
| `evidence/nl-test-queries.sql` | Source SQL for NOLOGIN queries |
| `evidence/pv-test-queries.sql` | Source SQL for post-verification |
| `evidence/pv-do-block-failtest.sql` | DO-block fail-path test |
| `evidence/anon-http-probe.ps1` | Anon HTTP probe script |
| `evidence/anon-http-probe-failtest.ps1` | Probe fail-path test |
| `evidence/pg17-test-outputs/` | Raw per-section outputs (see folder) |

**Local-only (NOT committed):**

- `bundle-signed-urls-*.txt` — contains ephemeral bearer-capability URLs; never committed to git per hygiene rule E11.

---

## 5. Reproduction — Fresh PostgreSQL 17

All catalog queries and failure-path tests were executed on a disposable PostgreSQL 17.11 environment (WSL2 + Ubuntu 26.04) before being submitted. To reproduce:

```bash
# 1. Provision a fresh PG17 database
createdb pg17test

# 2. Apply the fixture (roles, tables, RLS, grants, minimal data)
psql -d pg17test -f evidence/pg17-fixtures.sql

# 3. Run JIT queries
psql -d pg17test -f evidence/jit-test-queries.sql

# 4. Run NOLOGIN revalidation queries
psql -d pg17test -f evidence/nl-test-queries.sql

# 5. Run post-verification queries (this includes the DO-block
#    fail-closed probes; expect 42501 on the pass path)
psql -d pg17test -f evidence/pv-test-queries.sql
```

Expected outputs are in `evidence/pg17-test-outputs/`. Any mismatch invalidates the test evidence and requires re-execution.

**Note:** PostgREST is not installed in the disposable environment. The anon HTTP probe's *fail-path* logic is verified locally; the real production probe runs against the Supabase PostgREST endpoint during Phase A execution.

---

## 6. Wave History

| Wave | Scope | Status |
|---|---|---|
| 1 | Working tree clean + SHA binding (branch `fix/security-s1-integration-delete`) | ✅ Complete |
| 2 | Manifest v5 (scope + byte-size + hash re-verification) | ✅ Complete |
| 3 | Dedicated security PR (this PR) + PR #13 cross-reference | ✅ This PR |
| 4 | SQL binding (project ref, canonical hashes, target binding) | ⏳ Pending |
| 5 | Semantic corrections (JIT pre-state, DO-block wording, pg_catalog filtering) | ⏳ Pending |
| 6 | Test evidence (fresh PG17 E2E, real Supabase anon probe) | ⏳ Pending |
| 7 | Scope confirmation + final combined submission | ⏳ Pending |

Waves 4–7 evidence will bind to **this PR's head commit**. Any SHA change in this PR invalidates prior evidence binding and requires re-anchoring.

---

## 7. Relationship to PR #13

PR #13 (`fix/dashboard-audit-round2`) is a frontend dashboard cleanup PR. Between Phases 1–10, the RLS audit discussion was mistakenly conducted in PR #13's comment thread. Per expert review, that placement was incorrect in scope.

Historical record: PR #13's comments (IDs 5937660898 through 6131022457) remain **untouched** as historical reference. A single cross-reference comment was added to PR #13 pointing to this PR.

This PR (dedicated security) is the **canonical** location for RLS audit evidence and Phase A approval going forward.

---

## 8. Contact

**Prepared by:** Ashir Raza (GitHub: @AshirRaza313)  
**Reviewer:** Abdul Nafay (GitHub: @abdulnafa)  
**Project:** Valtriox ([valtriox.com](https://valtriox.com/))  
**Repository:** [github.com/AshirRaza313/valtriox](https://github.com/AshirRaza313/valtriox)

---

## 9. No-Mutation Attestation

As of this README's generation (see commit timestamp):

- No `ALTER ROLE` executed
- No `DROP ROLE` executed
- No `REVOKE` executed
- No `GRANT` executed
- No `NOLOGIN` executed
- No membership change executed
- No credential rotation executed
- No production mutation of any kind

PG17 test environment is disposable (WSL2 + Ubuntu, locally provisioned) and unrelated to production.

---

## 10. License / Handling

This directory contains security-sensitive material. Do not reproduce outside the project's private channels. Signed URLs (if any) are never committed; they are distributed via private WhatsApp only. See `.gitignore` in this directory.