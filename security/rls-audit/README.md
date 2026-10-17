# Valtriox RLS Audit — Phase A Containment

**Status:** Awaiting expert written approval (Phase A containment)
**Prepared by:** Ashir Raza
**Audit owner:** Abdul Nafay (@abdulnafa) — reviewer
**Started:** 2026-10-04
**Current phase:** Phase 11, Wave 7 (final submission)

---

## 1. Purpose

This directory contains the complete evidence bundle for the
Valtriox Row-Level Security (RLS) Broader Audit. The audit's
immediate goal is **Phase A containment**: removing unauthorized
public access to three production tables that were confirmed
exposed.

**Phase A containment requires explicit written approval before
any production mutation.** No `ALTER ROLE`, `REVOKE`, `GRANT`,
`DROP`, or `NOLOGIN` has been executed or will be executed without
that approval.

A separate approval track covers **NOLOGIN** (role login lockdown),
which is intentionally held apart from Phase A per expert direction.

---

## 2. Scope — Phase A Containment

Three tables are in scope, all confirmed exposed in the pre-change
snapshot:

1. `public."Subscription"`
2. `public."Notification"`
3. `public."PaymentProof"`

Containment action: revoke all privileges from `PUBLIC`, `anon`,
and `authenticated` on these three tables. Rollback restores the
pre-change grant set (including PostgreSQL 17 `MAINTAIN` privilege).

Out of scope for this PR:
- Broader RLS audit (Phase B — 9 additional tables)
- `42P17` recursion issue
- Default privileges
- `_prisma_migrations` RLS
- Frontend, dashboard, i18n, or any non-security changes
- Documentation of observations outside Phase A — see
  `OUT-OF-SCOPE-FLAGS.md`

---

## 3. Approval Status

| Item | Status |
|------|--------|
| Phase A containment (v3 SQL) | **PENDING** — awaiting expert written approval |
| Phase A rollback (v2 SQL) | Reference; execution separately authorized (break-glass only) |
| NOLOGIN (execute.sql) | **PENDING** — separate approval track |
| NOLOGIN rollback | Reference; break-glass only |

**Pre-execution requirements (per expert review):**
1. Full SQL hashes — see `bundle-manifest-v6.txt`
2. Target project / ref binding — see `evidence/wave4/`
3. Clean branch SHA — this PR's head commit
4. Pre/post verification — see `post-verification-v6.md` + `evidence/wave6/`
5. Precise table scope — this README, §2

---

## 4. File Manifest

See `bundle-manifest-v6.txt` for authoritative SHA256 + byte
size per file. Summary below:

### Authoritative (approval-bound)

| File | Purpose |
|------|---------|
| `phase-a-containment-v3.sql` | Exact containment SQL (revoke) |
| `phase-a-rollback-v2.sql` | Exact rollback SQL (grant) |
| `jit-checklist-v6.md` | Pre-execution checklist (v6 — Phase 11 corrections) |
| `post-verification-v6.md` | Post-execution verification (v6 — DO-block cleanup fixes) |
| `nologin-revalidation-checklist-v4.md` | NOLOGIN safety checklist (separate approval) |
| `break-glass-policy-v2.md` | Break-glass rollback policy |
| `maintain-pre-state-comparison.md` | Pre-state reference (PG17 `MAINTAIN`) |
| `pr-ci-binding-note.md` | CI/deployment binding note |
| `pg-version-proof.txt` | PG version evidence (17.6 production) |
| `pg17-fixtures-v2.sql` | Reproducible PG17 fixture (D1 fix — service_role grants) |
| `OUT-OF-SCOPE-FLAGS.md` | Audit observations outside Phase A scope |
| `bundle-manifest-v6.txt` | This manifest |

### Evidence (supporting)

| Folder | Purpose |
|--------|---------|
| `evidence/wave4/` | A2/A3 SQL binding evidence (role state, project ref, canonical hashes) |
| `evidence/wave6/` | D1 local PG17 E2E + D2 production anon baseline |
| `evidence/nologin/` | NOLOGIN query source (separate approval track) |
| `evidence/wave10/` | Historical Phase 10 combined execution evidence (superseded, preserved) |

**Local-only (NOT committed):**
- `bundle-signed-urls-*.txt` — contains ephemeral bearer-capability
  URLs; never committed to git per hygiene rule E11.

---

## 5. Reproduction — Fresh PostgreSQL 17

All catalog queries and failure-path tests were executed on a
disposable PostgreSQL 17.11 environment (WSL2 + Ubuntu 26.04)
before being submitted. To reproduce:

```bash
# 1. Provision a fresh PG17 database
createdb pg17test2

# 2. Apply the fixture (roles, tables, RLS, grants, minimal data)
psql -d pg17test2 -f pg17-fixtures-v2.sql

# 3. Run JIT baseline queries (pre-containment)
psql -d pg17test2 -f evidence/wave6/jit-baseline.sql

# 4. Verify fail-closed DO block behavior (SELECT granted)
psql -d pg17test2 -v ON_ERROR_STOP=0 -f evidence/wave6/do-block-probe.sql
# Expect: 3× ERROR "SELECT SUCCEEDED -- FAIL; cleanup_user=postgres"

# 5. Apply containment
psql -d pg17test2 -f evidence/wave6/containment-v3-copy.sql

# 6. Run post-verification queries (post-containment)
psql -d pg17test2 -f evidence/wave6/pv-verify.sql

# 7. Verify fail-closed DO block behavior (SELECT revoked)
psql -d pg17test2 -f evidence/wave6/do-block-probe.sql
# Expect: 3× NOTICE "SQLSTATE=42501 -- PASS; cleanup_user=postgres"
```

Expected outputs are in `evidence/wave6/step*.log`. Any mismatch
invalidates the test evidence and requires re-execution.

**Note:** PostgREST is not installed in the disposable environment.
The anon HTTP probe's *fail-path* logic is verified locally; the
real production probe runs against the Supabase PostgREST endpoint
using a publishable key (see `evidence/wave6/d2-prod-probe-*.json`).

---

## 6. Wave History

| Wave | Scope | Status |
|------|-------|--------|
| 1 | Working tree clean + SHA binding (branch `fix/security-s1-integration-delete`) | ✅ Complete |
| 2 | Manifest v5 (scope + byte-size + hash re-verification) | ✅ Complete |
| 3 | Dedicated security PR (this PR) + PR #13 cross-reference | ✅ Complete |
| 4 | A2/A3 SQL binding (role state, project ref, canonical hashes) | ✅ Complete |
| 5 | Semantic corrections — jit-checklist-v6, post-verification-v6, pg17-fixtures-v2 | ✅ Complete |
| 6 | Test evidence — D1 local E2E, D2 production anon baseline | ✅ Complete |
| 7 | Final scope + submission (this README, manifest v6, PR comment) | ✅ This submission |

Subsequent evidence will bind to **this PR's final head commit**.
Any SHA change in this PR invalidates prior evidence binding and
requires re-anchoring.

---

## 7. Relationship to PR #13

PR #13 (`fix/dashboard-audit-round2`) is a frontend dashboard
cleanup PR. Between Phases 1–10, the RLS audit discussion was
mistakenly conducted in PR #13's comment thread. Per expert
review, that placement was incorrect in scope.

Historical record: PR #13's comments (IDs 5937660898 through
6131022457) remain **untouched** as historical reference. A
single cross-reference comment was added to PR #13 pointing to
this PR.

This PR (dedicated security) is the **canonical** location for
RLS audit evidence and Phase A approval going forward.

---

## 8. Contact

**Prepared by:** Ashir Raza (GitHub: @AshirRaza313)
**Reviewer:** Abdul Nafay (GitHub: @abdulnafa)
**Project:** Valtriox (valtriox.com)
**Repository:** github.com/AshirRaza313/valtriox

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

PG17 test environment is disposable (WSL2 + Ubuntu, locally
provisioned) and unrelated to production.

---

## 10. License / Handling

This directory contains security-sensitive material. Do not
reproduce outside the project's private channels. Signed URLs
(if any) are never committed; they are distributed via private
WhatsApp only. See `.gitignore` in this directory.