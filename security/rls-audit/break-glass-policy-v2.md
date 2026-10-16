# Break-Glass Exposure Restoration Policy (v2)

**File:** phase6-verification/break-glass-policy-v2.md  
**Status:** DRAFT — NOT EXECUTED  
**Supersedes:** break-glass-policy-<old>.md  
**Date:** 2026-10-08

---

## 1. Correction Summary

Prior (incorrect): "Any smoke test fails → execute rollback SQL."
Prior (incorrect): "Direct Data API = yes; Prisma runtime = no" (overconfident classification).

Corrected framing below.

---

## 2. Correct Process on Smoke Test Failure

### 2.1 STOP
Do not execute further SQL. Freeze state. Capture evidence.

### 2.2 Capture (within 5 min)
- Failing flow (UI step or API endpoint)
- HTTP status
- Sanitized response body (no PII)
- Server-side log lines (UTC window)
- Deployed app SHA
- Execution UTC timestamp

### 2.3 Root Cause Determination

**Corrected (expert):**
> "Root cause evidence se determine hogi; no automatic classification and no automatic rollback."

Root cause candidates (evidence-driven, no assumption):
- ACL change (anon/authenticated privileges revoked)
- Connection role change
- Membership change
- View/function dependency
- Incorrect runtime-role evidence
- Unrelated app/deployment issue

**No pre-classification.** No inference from path alone. Evidence from logs, connection traces, and query plans determines root cause.

### 2.4 Prefer Forward Fix
Least-privilege targeted GRANT for the specific failing flow. Submit for separate approval.

### 2.5 Break-Glass (Last Resort)
Broad rollback only after separate written break-glass authorization.

---

## 3. Prohibited Actions

- Executing `phase-a-rollback-v2.sql` without written break-glass approval
- Any DROP, membership revoke, credential change, or session termination
- Modifying containment SQL
- Modifying Phase A tables beyond approved containment

---

## 4. Label Discipline

Terminology: **"break-glass exposure restoration"** — never "safe rollback".

---

## 5. Reference

- Containment SQL: `phase-a-containment-v3.sql`
- Break-glass SQL: `phase-a-rollback-v2.sql`
- v3 Manifest: `phase-a-package-SHA256-v3.txt`

---

## 6. Status

`DRAFT — NOT EXECUTED`  
**Prepared by:** Ashir Raza  
**Date:** 2026-10-08