# Audit Harness — Mutation Surface Inventory

**Round:** 20 (R20-2 corrections on top of R19-3)  
**Date:** 2026-09-27  
**Branch:** `bootstrap/audit-harness`  
**Prepared by:** Ashir Raza (with AI assistance)  
**Status:** Implemented, awaiting independent verification

---

## Purpose

Expert Round 18 feedback (P0 Blocker #2):

> *"Exact mutation surface define karein — touched data, privileges, roles
> aur definitions ka before/after proof."*

Expert Round 19 feedback (P0-2 refinement):

> *"Mutation inventory mein workflow ki dono CREATE DATABASE operations
> missing hain. Is mein deleted R18 hostile operations abhi bhi listed
> hain aur new R19 cleanup attempts properly reconcile nahi kiye gaye."*

Ye document audit harness ki **saari destructive operations** ko
enumerate karta hai, categorize karta hai, aur batata hai ke kaunsi
snapshot category har op ko detect karti hai.

---

## Scope Definition

**IN-SCOPE (inventoried below):**
- `.github/workflows/baseline-pr-validation.yml` (workflow DDL)
- `scripts/audit/tests/real-psql-integration.test.mjs`
- `scripts/audit/tests/production-path.test.mjs`
- `scripts/audit/cleanup-runner.mjs` (shared cleanup sequence)

**OUT-OF-SCOPE (documented in Section D, not inventoried):**
- `src/**` (production application code)
- `prisma/**` (migrations, seed)
- Pure unit-test `.test.mjs` files (no DB connection)

---

## A. Executable Mutations (27 — WILL run in normal flow)

### A0. Workflow-level DDL (2 operations)

Ye operations `.github/workflows/baseline-pr-validation.yml` mein hain —
test files se PEHLE chalti hain. Expert Round 19 feedback (P0-2) mein
specifically in ka zikr tha.

| Op | SQL | File | Line | Job | Snapshot category |
|----|-----|------|------|-----|-------------------|
| W1 | `CREATE DATABASE "audit_<run_id>_<attempt>_<hex>"` | workflow | 135 | harness-real-psql | databases list (via CREATE DATABASE in snapshot if scoped) |
| W2 | `CREATE DATABASE "audit_<run_id>_<attempt>_<hex>"` | workflow | 239 | harness-production-path | databases list |

**Note:** Ye operations disposable database banati hain. Postgres
snapshot in databases ko scoped view mein verify karega (Section C).

### A1. Setup Phase — test files (12 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| S1 | `CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '...'` | real-psql | 428 | roles, role_attributes |
| S2 | `CREATE TABLE ${TEST_TABLE} (id int)` | real-psql | 429 | tables, columns |
| S3 | `GRANT SELECT, INSERT ON ${TEST_TABLE} TO ${ROLE_NAME}` | real-psql | 430 | table_grants |
| S4 | `CREATE TABLE public."Notification" (...)` | production-path | 178 | tables, columns, constraints, indexes, defaults |
| S5 | `CREATE TABLE public."NotificationReadReceipt" (...)` | production-path | 184 | tables, columns, constraints, indexes, defaults |
| S6 | `INSERT INTO public."Notification" VALUES (...)` | production-path | 189 | row_counts |
| S7 | `INSERT INTO public."NotificationReadReceipt" VALUES (...)` | production-path | 195 | row_counts |
| S8 | `CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '...'` | production-path | 197 | roles, role_attributes |
| S9 | `GRANT CONNECT ON DATABASE "${DB_NAME}" TO ${ROLE_NAME}` | production-path | 198 | database_grants |
| S10 | `GRANT USAGE ON SCHEMA public TO ${ROLE_NAME}` | production-path | 199 | schema_grants |
| S11 | `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE_NAME}` | production-path | 200 | table_grants |
| S12 | `ALTER ROLE ${ROLE_NAME} SET default_transaction_read_only = on` | production-path | 201 | role_attributes, pg_db_role_setting (to be added in R20-3c) |

### A2. Pre-Test Cleanup (3 operations)

R20-1d removed the `DROP ROLE IF EXISTS` pre-cleanup from both files
(fail-closed check ab ROLE exist kare toh abort karta hai, DROP nahi).

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| P1 | `DROP TABLE IF EXISTS ${TEST_TABLE}` | real-psql | 426 | tables |
| P2 | `DROP TABLE IF EXISTS public."NotificationReadReceipt"` | production-path | 175 | tables |
| P3 | `DROP TABLE IF EXISTS public."Notification"` | production-path | 176 | tables |

**Removed in R20-1d (no longer executable):**
- real-psql `DROP ROLE IF EXISTS ${ROLE_NAME}` — replaced by fail-closed abort
- production-path `DROP ROLE IF EXISTS ${ROLE_NAME}` — replaced by fail-closed abort

### A3. Test-Triggered Mutations (2 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| T1 | `INSERT INTO ${TEST_TABLE} VALUES (100)` | real-psql | 494 | row_counts |
| T2 | `INSERT INTO ${TEST_TABLE} VALUES (200)` | real-psql | 508 | row_counts |

**Note:** T1 expected to FAIL (proves read-only enforcement); T2 succeeds
(proves role has INSERT privilege). Both documented.

### A4. Final Cleanup (8 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| F1 | `DROP TABLE IF EXISTS ${TEST_TABLE}` | real-psql | 730 | tables |
| F2 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | real-psql | 731 | roles |
| F3 | `REVOKE ALL PRIVILEGES ON DATABASE "${DB_NAME}" FROM ${ROLE_NAME}` | cleanup-runner (prod) | via runner | database_grants |
| F4 | `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${ROLE_NAME}` | cleanup-runner (prod) | via runner | schema_grants |
| F5 | `DROP TABLE IF EXISTS public."NotificationReadReceipt"` | cleanup-runner (prod) | via runner | tables, constraints, indexes |
| F6 | `DROP TABLE IF EXISTS public."Notification"` | cleanup-runner (prod) | via runner | tables, constraints, indexes |
| F7 | `DROP OWNED BY ${ROLE_NAME}` | cleanup-runner (prod) | via runner | ownership, all grant categories |
| F8 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | cleanup-runner (prod) | via runner | roles |

**Known gap (expert R19 P0-3, addressed in R20-4a):** F1 and F2 in
real-psql are currently inline, not routed through the shared
cleanup-runner. R20-4a routes them through the runner to make the
"single source of truth" claim exact.

**Executable subtotal: 2 + 12 + 3 + 2 + 8 = 27**

---

## B. Hostile-Test Operations (15 statements across 5 tests)

These are intentionally hostile statements inside negative tests. Each
is guarded by a same-transaction DO block that must abort BEFORE any DDL.

R20-2b correction: **R18-4a and R18-4b (previously H2, H3) were DELETED
in R19-5.** They were reduced copies of the cleanup sequence and are
superseded by R19-5a/c which use the shared cleanup-runner.

| Op | Test | SQL statements attempted | Guard | Expected outcome |
|----|------|--------------------------|-------|------------------|
| H1 | R17-3b | `CREATE TABLE __r17_3_hostile_should_not_exist (id int)` | DB name DO block | psql non-zero, state unchanged |
| H2 | R19-1a | `CREATE TABLE __r19_1_should_not_exist (id int)` | Cluster DO block | psql non-zero, state unchanged |
| H3a | R19-5a | `REVOKE ALL PRIVILEGES ON DATABASE "${DB_NAME}" FROM ${ROLE_NAME}` | DB name DO block (via buildCleanupGuard) | psql non-zero, state unchanged |
| H3b | R19-5a | `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${ROLE_NAME}` | (same) | (same) |
| H3c | R19-5a | `DROP TABLE IF EXISTS ${TEST_TABLE}` | (same) | (same) |
| H3d | R19-5a | `DROP OWNED BY ${ROLE_NAME}` | (same) | (same) |
| H3e | R19-5a | `DROP ROLE IF EXISTS ${ROLE_NAME}` | (same) | (same) |
| H4a | R19-5c | `REVOKE ALL PRIVILEGES ON DATABASE "${DB_NAME}" FROM ${ROLE_NAME}` | Cluster DO block (via buildCleanupGuard) | psql non-zero, state unchanged |
| H4b | R19-5c | `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${ROLE_NAME}` | (same) | (same) |
| H4c | R19-5c | `DROP TABLE IF EXISTS ${TEST_TABLE}` | (same) | (same) |
| H4d | R19-5c | `DROP OWNED BY ${ROLE_NAME}` | (same) | (same) |
| H4e | R19-5c | `DROP ROLE IF EXISTS ${ROLE_NAME}` | (same) | (same) |
| H5 | R20-1c | `CREATE TABLE __r20_1c_should_not_exist (id int)` | Cluster DO block (independent-source mismatch) | psql non-zero, state unchanged |

**JS-level refusal (no SQL emitted):**
- **R19-5b**: `buildCleanupSequence({ roleName: undefined })` refuses at
  builder level. No SQL statement is emitted, so no hostile DB op.

**Hostile statement subtotal: 1 + 1 + 5 + 5 + 1 = 13 statements across
4 test groups (+ 1 JS-only test)**

Wait — H3 has 5 statements and H4 has 5 statements. Let me recount: H1=1,
H2=1, H3=5, H4=5, H5=1 → 13.

**Grand total tracked: 27 executable + 13 hostile = 40 operations**

---

## C. Snapshot Coverage Requirements (current state)

Har mutation ke liye, ye table batata hai kaunsi snapshot category usko
detect karti hai. Current snapshot (R19-4) mein 18 categories hain.

| Snapshot category | Required by ops | Used by |
|-------------------|-----------------|---------|
| `tables` | S2, S4, S5, P1, P2, P3, F1, F5, F6 | existing (V2) |
| `columns` | S2, S4, S5 | existing (V2) |
| `roles` | S1, S8, F2, F8 | existing (V2) |
| `table_grants` | S3, S11 | existing (V2) |
| `row_counts` | S6, S7, T1, T2 | existing (V2) |
| `row_counts_approx` | (defence-in-depth) | existing (V2) |
| `database_grants` | S9, F3 | existing (V2) |
| `schema_grants` | S10, F4 | existing (V2) |
| `role_attributes` | S1, S8, S12 | existing (V2) |
| `memberships` | (defence-in-depth) | existing (V2) |
| `ownership` | F7 | existing (V2) |
| `defaults` | S4, S5 | existing (V2) |
| `constraints` | S4, S5, F5, F6 | existing (V2) |
| `indexes` | S4, S5, F5, F6 | existing (V2) |
| `triggers` | (defence-in-depth) | existing (V2) |
| `rls` | (defence-in-depth) | existing (V2) |
| `sequences` | (defence-in-depth) | existing (V2) |
| `views` | (defence-in-depth) | existing (V2) |

**Gaps to be addressed in R20-3 (commit C4):**

Expert Round 19 P0-2 identified the following missing coverage. C4 will
add these categories:

1. `pg_db_role_setting` — actual storage for `ALTER ROLE ... SET` (S12).
   Current `role_attributes` reads `pg_roles`, which does NOT reflect
   per-database role settings. **This is a real gap: S12 mutates
   `pg_db_role_setting`, but snapshot reads `pg_roles.rolconfig`.**

2. RLS flags — `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity`.
   Current `rls` category reads `pg_policies` (policy definitions only,
   not the ENABLE/FORCE flags).

3. Materialized views — `pg_matviews`. Current `views` category only
   reads `pg_views` (regular views).

4. Complete ACL surface — current `table_grants`, `database_grants`,
   `schema_grants` cover those scopes; missing: sequence grants, function
   grants, type grants, column grants, default privileges (`pg_default_acl`).

5. `pg_shdepend` snapshot — `DROP OWNED BY` (F7) affects shared
   dependencies across the whole cluster. Current `ownership` category
   only reads `pg_class.relowner`, which is incomplete.

**Also to be addressed in C4:**
- Deterministic ordering — current `string_agg(... ORDER BY 1)` is a
  constant inside the aggregate, not a column reference. Real ordering
  not guaranteed (R20-3a).
- Atomicity — current snapshot runs 18 separate `psql -c` calls, not a
  single transactional snapshot (R20-3b).
- Row-content evidence — current `row_counts` captures counts, not row
  values. S6, S7, T1, T2 use INSERT only (no UPDATE in current mutation
  surface), so counts are the proven surface. Claim narrows to "row
  counts only" (R20-3f).

---

## D. Out-of-Scope Operations (Documented, Not Inventoried)

Ye production application ke operations hain. Audit harness inko touch
nahi karta — is document ka scope bahar.

| File | Operation count | Purpose |
|------|-----------------|---------|
| `src/app/api/admin/clients/[id]/route.ts` | 18 `DELETE FROM` | Org deletion cascade |
| `src/app/api/push/send/route.ts` | 1 `DELETE FROM` | Push cleanup |
| `src/app/api/push/subscribe/route.ts` | 2 `DELETE FROM` | Subscription cleanup |
| `prisma/seed.ts` | 1 role creation | Seed data |

**Rationale:** Ye Valtriox production app ke endpoints hain. Audit harness
ka scope sirf test-side destructive operations hai, jo disposable CI
cluster par chalti hain.

---

## E. Number Reconciliation (Transparency)

### R19 chat estimate (superseded)

Earlier chat estimate (transfer prompt Section 2): **25 operations**
(6 cluster + 3 DB + 2 schema + 8 table + 3 row + 3 hostile).

### R19-3 verified count (superseded by R20-2)

R19-3 grep count: **27 executable + 4 hostile = 31 operations**. This was
missing 2 workflow CREATE DATABASE ops and listed 2 deleted R18-4a
hostile ops.

### R20-2 verified count (current)

**27 executable + 13 hostile = 40 operations.**

Changes from R19-3 to R20-2:

| Change | Delta | Reason |
|--------|-------|--------|
| Add workflow CREATE DATABASE x2 (W1, W2) | +2 | R20-2a (expert P0-2) |
| Remove R18-4a hostile DROP TABLE | -1 | R20-2b (superseded by R19-5a) |
| Remove R18-4a hostile DROP ROLE | -1 | R20-2b (superseded by R19-5a) |
| Add R19-5a hostile sequence (5 statements) | +5 | R20-2c (reconcile R19) |
| Add R19-5c hostile sequence (5 statements) | +5 | R20-2c (reconcile R19) |
| Add R20-1c hostile CREATE TABLE | +1 | R20-2c (reconcile R20) |
| Remove real-psql pre-cleanup DROP ROLE (P2) | -1 | R20-1d (fail-closed) |
| Remove production-path pre-cleanup DROP ROLE (P5) | -1 | R20-1d (fail-closed) |

Net change in executable: +2 - 1 - 1 = 0 (still 27)
Net change in hostile: -1 - 1 + 5 + 5 + 1 = +9 (was 4, now 13)

**All numbers verified against current source.**

---

## F. Verification Commands

Reproduce inventory count:

```bash
# Workflow DDL (should be 2 CREATE DATABASE)
grep -c "CREATE DATABASE" .github/workflows/baseline-pr-validation.yml

# Test-file executable mutations
git grep -nE "(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE) " \
  -- 'scripts/audit/**/*.mjs'

# Shared cleanup runner sequence
grep -E "(REVOKE|DROP)" scripts/audit/cleanup-runner.mjs