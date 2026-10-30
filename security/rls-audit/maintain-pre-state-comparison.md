# MAINTAIN Pre-State Comparison Guide

**File:** `phase6-verification/maintain-pre-state-comparison.md`  
**Status:** DOCUMENTED GUIDE — NOT EXECUTED  
**Date:** 2026-10-08

---

## 1. Purpose

PG 17.6 proves MAINTAIN **syntax** is valid. It does not prove MAINTAIN was **originally granted** to `anon` / `authenticated`.

This guide compares the JIT pre-execution ACL against `phase-a-rollback-v2.sql` to verify an exact match. Any difference → STOP + regenerate rollback.

---

## 2. Comparison Columns

For each Phase A table, compare these 4 fields between:

- **Source A:** JIT pre-execution ACL snapshot (execution-day)
- **Source B:** Rollback-v2 grant statements

| Field | Purpose |
|---|---|
| `grantee` | PUBLIC / anon / authenticated |
| `privilege_type` | SELECT / INSERT / UPDATE / DELETE / TRUNCATE / REFERENCES / TRIGGER / MAINTAIN |
| `grantor` | Who granted it |
| `is_grantable` | Grant option yes/no |

---

## 3. Comparison Query

```sql
SELECT
    c.relname AS table_name,
    CASE
        WHEN a.grantee = 0 THEN 'PUBLIC'
        ELSE a.grantee::regrole::text
    END AS grantee,
    a.privilege_type,
    COALESCE(a.grantor::regrole::text, 'N/A') AS grantor,
    a.is_grantable
FROM pg_class c
JOIN pg_namespace n
    ON n.oid = c.relnamespace
JOIN LATERAL aclexplode(c.relacl) AS a
    ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN (
      'Subscription',
      'Notification',
      'PaymentProof'
  )
  AND (
      a.grantee = 0
      OR a.grantee::regrole::text IN (
          'anon',
          'authenticated'
      )
  )
ORDER BY c.relname, grantee, a.privilege_type;
```

---

## 4. Expected Reference (from Phase 2.1)

For each of `Subscription`, `Notification`, and `PaymentProof`:

- `anon` — 8 privileges: DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated` — 8 privileges: same list

Rollback-v2 must restore these 8 privileges per role.

---

## 5. Comparison Procedure

1. Capture the JIT ACL snapshot using the Section 3 query.
2. Diff against Phase 2.1 snapshot values.
3. Diff against rollback-v2 GRANT statements.
4. If **all three match** → proceed (still subject to the full JIT checklist).
5. If **any mismatch** → STOP. Regenerate rollback. Re-verify. No execution.

---

## 6. Mismatch Scenarios

| Scenario | Action |
|---|---|
| JIT shows MAINTAIN, rollback has MAINTAIN | Continue |
| JIT shows MAINTAIN, rollback missing MAINTAIN | Regenerate rollback |
| JIT missing MAINTAIN, rollback has MAINTAIN | Regenerate rollback |
| JIT shows extra privileges (e.g., new grant since Phase 2.1) | STOP + report; rollback must match JIT |

---

## 7. Broad Rollback Status

Per expert: broad rollback is **not pre-approved** from JIT pre-state alone. Even after JIT-match verification, executing rollback requires **separate written break-glass authorization**.

---

## 8. Status

`DOCUMENTED GUIDE`

`NOT EXECUTED`

**Prepared by:** Ashir Raza  
**Date:** 2026-10-08