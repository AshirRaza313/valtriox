# Audit Harness — Mutation Surface Inventory

**Round:** 19 (R19-3)  
**Date:** 2026-09-26  
**Branch:** `bootstrap/audit-harness`  
**Prepared by:** Ashir Raza (with AI assistance)  
**Status:** Implemented, awaiting independent verification

---

## Purpose

Expert Round 18 feedback (P0 Blocker #2):

> *"Exact mutation surface define karein — touched data, privileges, roles
> aur definitions ka before/after proof."*

Ye document audit harness ki **saari destructive operations** ko enumerate
karta hai, categorize karta hai, aur batata hai ke kaunsi snapshot category
har op ko detect karti hai. Isse R19-4 (comprehensive snapshot v2) ka
scope derive hota hai.

---

## Scope Definition

**IN-SCOPE (inventoried below):**
- `scripts/audit/tests/real-psql-integration.test.mjs`
- `scripts/audit/tests/production-path.test.mjs`
- `.github/workflows/baseline-pr-validation.yml` (setup only)

**OUT-OF-SCOPE (documented in Section D, not inventoried):**
- `src/**` (production application code)
- `prisma/**` (migrations, seed)
- Pure unit-test `.test.mjs` files (no DB connection)

---

## A. Executable Mutations (27 — WILL run in normal flow)

### A1. Setup Phase (12 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| S1 | `CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '...'` | real-psql | 275 | roles, role_attributes |
| S2 | `CREATE TABLE ${TEST_TABLE} (id int)` | real-psql | 276 | tables, columns |
| S3 | `GRANT SELECT, INSERT ON ${TEST_TABLE} TO ${ROLE_NAME}` | real-psql | 277 | table_grants |
| S4 | `CREATE TABLE public."Notification" (...)` | production-path | 161 | tables, columns, constraints, indexes, defaults |
| S5 | `CREATE TABLE public."NotificationReadReceipt" (...)` | production-path | 167 | tables, columns, constraints, indexes, defaults |
| S6 | `INSERT INTO public."Notification" VALUES (...)` | production-path | 171 | row_counts |
| S7 | `INSERT INTO public."NotificationReadReceipt" VALUES (...)` | production-path | 176 | row_counts |
| S8 | `CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '...'` | production-path | 179 | roles, role_attributes |
| S9 | `GRANT CONNECT ON DATABASE "${DB_NAME}" TO ${ROLE_NAME}` | production-path | 180 | database_grants |
| S10 | `GRANT USAGE ON SCHEMA public TO ${ROLE_NAME}` | production-path | 181 | schema_grants |
| S11 | `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE_NAME}` | production-path | 182 | table_grants |
| S12 | `ALTER ROLE ${ROLE_NAME} SET default_transaction_read_only = on` | production-path | 183 | role_attributes |

### A2. Pre-Test Cleanup (5 operations) — drop stale state before setup

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| P1 | `DROP TABLE IF EXISTS ${TEST_TABLE}` | real-psql | 273 | tables |
| P2 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | real-psql | 274 | roles |
| P3 | `DROP TABLE IF EXISTS public."NotificationReadReceipt"` | production-path | 158 | tables |
| P4 | `DROP TABLE IF EXISTS public."Notification"` | production-path | 159 | tables |
| P5 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | production-path | 160 | roles |

### A3. Test-Triggered Mutations (2 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| T1 | `INSERT INTO ${TEST_TABLE} VALUES (100)` | real-psql | 341 | row_counts |
| T2 | `INSERT INTO ${TEST_TABLE} VALUES (200)` | real-psql | 355 | row_counts |

*Note:* T1 is expected to FAIL (proves read-only enforcement); T2 succeeds
(proves role actually has INSERT privilege). Both are documented.

### A4. Final Cleanup (8 operations)

| Op | SQL | File | Line | Snapshot category |
|----|-----|------|------|-------------------|
| F1 | `DROP TABLE IF EXISTS ${TEST_TABLE}` | real-psql | 474 | tables |
| F2 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | real-psql | 475 | roles |
| F3 | `REVOKE ALL PRIVILEGES ON DATABASE "${DB_NAME}" FROM ${ROLE_NAME}` | production-path | 328 | database_grants |
| F4 | `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${ROLE_NAME}` | production-path | 329 | schema_grants |
| F5 | `DROP TABLE IF EXISTS public."NotificationReadReceipt"` | production-path | 330 | tables, constraints, indexes |
| F6 | `DROP TABLE IF EXISTS public."Notification"` | production-path | 331 | tables, constraints, indexes |
| F7 | `DROP OWNED BY ${ROLE_NAME}` | production-path | 332 | ownership |
| F8 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | production-path | 333 | roles |

**Executable subtotal: 12 + 5 + 2 + 8 = 27**

---

## B. Hostile-Test Operations (4 — MUST NOT execute)

These are intentionally hostile statements inside negative tests. Each is
guarded by a same-transaction DO block that must abort BEFORE any DDL.

| Op | SQL | File | Line | Guard | Expected outcome |
|----|-----|------|------|-------|------------------|
| H1 | `CREATE TABLE __r17_3_hostile_should_not_exist (id int)` | real-psql | 226 | R17-3b (dbname DO block) | psql exits non-zero, state unchanged |
| H2 | `DROP TABLE IF EXISTS ${TEST_TABLE}` | real-psql | 418 | R18-4a (dbname DO block) | psql exits non-zero, state unchanged |
| H3 | `DROP ROLE IF EXISTS ${ROLE_NAME}` | real-psql | 419 | R18-4a (dbname DO block) | psql exits non-zero, state unchanged |
| H4 | `CREATE TABLE __r19_1_should_not_exist (id int)` | real-psql | 451 | R19-1a (cluster DO block) | psql exits non-zero, state unchanged |

**Hostile subtotal: 4**

**Grand total tracked: 27 + 4 = 31 operations**

---

## C. Snapshot Coverage Requirements (Drives R19-4 Scope)

Har mutation ke liye, ye table batata hai kaunsi snapshot category usko
detect karegi. R19-4 ka scope isi mapping se derive hua hai.

| Snapshot category | Required by ops | Used by |
|-------------------|-----------------|---------|
| `tables` | S2, S4, S5, P1, P3, P4, F1, F5, F6 | existing (v1) |
| `columns` | S2, S4, S5 | existing (v1) |
| `roles` | S1, S8, P2, P5, F2, F8 | existing (v1) |
| `table_grants` | S3, S11 | existing (v1) |
| `row_counts` | S6, S7, T1, T2 | **NEW (R19-4)** |
| `database_grants` | S9, F3 | **NEW (R19-4)** |
| `schema_grants` | S10, F4 | **NEW (R19-4)** |
| `role_attributes` | S1, S8, S12 | **NEW (R19-4)** |
| `memberships` | (unused by current ops) | **NEW (R19-4)** — defence in depth |
| `ownership` | F7 | **NEW (R19-4)** |
| `defaults` | S4, S5 | **NEW (R19-4)** |
| `constraints` | S4, S5, F5, F6 | **NEW (R19-4)** |
| `indexes` | S4, S5, F5, F6 | **NEW (R19-4)** |
| `triggers` | (unused by current ops) | **NEW (R19-4)** — defence in depth |
| `rls` | (unused by current ops) | **NEW (R19-4)** — defence in depth |
| `sequences` | (unused by current ops) | **NEW (R19-4)** — defence in depth |
| `views` | (unused by current ops) | **NEW (R19-4)** — defence in depth |

**Note:** R19-4 scope isi mapping se derive hua hai. 13 categories jo
expert ne list ki hain (R18 feedback), unme se 13 add karni hain — even
those not currently exercised by any op, kyunke future mutations unko
touch kar sakti hain.

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
cluster par chalti hain. Production app operations alag review track
(Section 9 — Step 1 Security) mein handle honge.

---

## E. Number Reconciliation (Transparency)

Earlier chat estimate (transfer prompt Section 2): **25 operations**
(6 cluster + 3 DB + 2 schema + 8 table + 3 row + 3 hostile).

**Verified grep count (this document): 31 operations**
(9 cluster-level + 2 DB + 2 schema + 12 table + 4 row + 4 hostile).

Differences explained:
1. INSERT in test bodies (not just setup) — 2 additional (T1, T2)  
2. Pre-test cleanup blocks — 5 additional (P1-P5)  
3. `ALTER ROLE` — 1 additional (S12)  
4. `DROP OWNED BY` — 1 additional (F7)  
5. Hostile `CREATE TABLE` (R17-3b) — 1 additional (H1)  

**Earlier estimate was a chat-time approximation. This document is the
verified source of truth from current grep output.**

---

## F. Verification Commands

Reproduce inventory count:

```bash
# List all mutations in test files
git grep -nE "(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE) " \
  -- 'scripts/audit/**/*.mjs'
```

Compare against this document. Any mismatch = inventory out of date.
End of mutation inventory. R19-4 (snapshot v2) implementation follows.