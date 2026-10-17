# Post-Verification Checklist — Phase A Containment (v6)

**File:** phase10-corrections/post-verification-v6.md  
**Status:** DOCUMENTED TEMPLATE — Execution evidence filled after PG17 disposable test  
**Supersedes:** post-verification-v5.md  
**Corrections:** Phase 11 Wave 5B — C2:
- DO-block restructured with cleanup-on-all-paths (§5.1, §5.2, §5.3)
- Actual output attachment fields added for PASS + FAIL-succeeded paths
- Pass/fail wording clarified (§5 intro)
- Success criteria updated (§12)
**Prior corrections (carried from v5):** P0-3 (DO-block fail-closed), P0-5 (anon HTTP probe automated), P1-8 (audit_readonly all 3 tables), P1-9 (smoke test non-mutating proof)  
**Date:** 2026-10-17

---

## 0. Evidence Discipline

Each section records either:
- Actual PG17 disposable test output (validation), AND
- Actual production output at execution time (execution record)

"Complete claim" is only made after evidence is attached. Blanks in the template are execution-evidence fields, filled after successful dry-run.

---

## 1. ACL Post-State

```sql
SELECT c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       a.privilege_type,
       COALESCE(a.grantor::regrole::text, 'N/A') AS grantor,
       a.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL aclexplode(c.relacl) AS a ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname, grantee, a.privilege_type;
```

**Expected post-containment:** Zero rows for `anon`, `authenticated`, or `PUBLIC`. `postgres`, `service_role`, `audit_readonly` unchanged from JIT baseline.

Recorded: ___________

---

## 2. Table-Level Effective Privileges — 96-Check Matrix

```sql
WITH tables AS (
  SELECT 'Subscription' AS tbl UNION ALL
  SELECT 'Notification' UNION ALL
  SELECT 'PaymentProof'
),
roles AS (
  SELECT 'anon' AS role_name UNION ALL
  SELECT 'authenticated' UNION ALL
  SELECT 'service_role' UNION ALL
  SELECT 'postgres'
),
privs AS (
  SELECT 'SELECT' AS priv UNION ALL
  SELECT 'INSERT' UNION ALL
  SELECT 'UPDATE' UNION ALL
  SELECT 'DELETE' UNION ALL
  SELECT 'TRUNCATE' UNION ALL
  SELECT 'REFERENCES' UNION ALL
  SELECT 'TRIGGER' UNION ALL
  SELECT 'MAINTAIN'
)
SELECT t.tbl, r.role_name, p.priv,
       has_table_privilege(r.role_name, 'public."' || t.tbl || '"', p.priv) AS has_priv
FROM tables t CROSS JOIN roles r CROSS JOIN privs p
ORDER BY t.tbl, r.role_name, p.priv;
```

**Pass criteria:**
- anon: all 8 false for all 3 tables (0 / 24)
- authenticated: all 8 false for all 3 tables (0 / 24)
- service_role: all 8 true (24 / 24, unchanged)
- postgres: all 8 true (24 / 24, unchanged)

Recorded: ___________

---

## 3. Column-Level Post-State (P0-1 continued)

### 3.1 Direct Column Grants via information_schema

```sql
SELECT cp.table_name,
       cp.column_name,
       cp.grantee,
       cp.privilege_type
FROM information_schema.column_privileges cp
WHERE cp.table_schema = 'public'
  AND cp.table_name IN ('Subscription', 'Notification', 'PaymentProof')
  AND cp.grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY cp.table_name, cp.column_name, cp.grantee, cp.privilege_type;
```

Expected: zero rows.

Recorded: ___________

### 3.2 Direct Column Grants via pg_attribute ACL

```sql
SELECT c.relname AS table_name,
       a.attname AS column_name,
       CASE WHEN ac.grantee = 0 THEN 'PUBLIC' ELSE ac.grantee::regrole::text END AS grantee,
       ac.privilege_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
JOIN LATERAL aclexplode(a.attacl) AS ac ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
  AND (ac.grantee = 0 OR ac.grantee::regrole::text IN ('anon', 'authenticated'))
ORDER BY c.relname, column_name, grantee, ac.privilege_type;
```

Expected: zero rows.

Recorded: ___________

### 3.3 Effective Column Access — Per Column × Per Role

```sql
WITH cols AS (
  SELECT c.relname AS tbl, a.attname AS col
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
),
checks AS (
  SELECT tbl, col, 'anon' AS role_name, 'SELECT' AS priv,
         has_column_privilege('anon', 'public."' || tbl || '"', col, 'SELECT') AS has_pr FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'INSERT',
    has_column_privilege('anon', 'public."' || tbl || '"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'UPDATE',
    has_column_privilege('anon', 'public."' || tbl || '"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'REFERENCES',
    has_column_privilege('anon', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'SELECT',
    has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'SELECT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'INSERT',
    has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'UPDATE',
    has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'REFERENCES',
    has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
)
SELECT * FROM checks WHERE has_pr = true ORDER BY tbl, col, role_name, priv;
```

**Any row returned → FAIL / STOP.**

Recorded: ___________

---

## 4. anon HTTP Probe — Mode-Aware Classification (P0-5, Phase 11 Wave 7 B2)

**Purpose:** Verify anon access state via PostgREST with mode-aware hard-fail assertions. The probe distinguishes pre-containment expected behavior (anon exposed) from post-containment expected behavior (anon denied). Any probe failure (invalid key, transport error) is classified as `PROBE_FAILED`, never as a pass.

**Method:** `curl.exe --write-out` captures HTTP status; script inspects the `sb-error-code` response header (Supabase gateway) for explicit invalid-key detection; body and Content-Range validated per mode; script exits non-zero on any failure.

**Script (single source of truth):** `evidence/wave6/anon-http-probe-prod.ps1`

**Invocation:**

```powershell
cd C:\Users\Aashir\Projects\valtriox-trackb\security\rls-audit\evidence\wave6

powershell -ExecutionPolicy Bypass -File .\anon-http-probe-prod.ps1 -Mode pre
# pre-containment

powershell -ExecutionPolicy Bypass -File .\anon-http-probe-prod.ps1 -Mode post
# post-containment
```

### Classification Matrix (Mode-Aware)

| HTTP | `sb-error-code` | Content-Range | Mode | Classification | Exit |
|---|---|---|---|---|---:|
| 200 / 206 | — | Present (anon SELECT) | `pre` | `EXPECTED_PRE_CONTAINMENT_EXPOSURE` | 0 |
| 200 / 206 | — | Any | `post` | `CRITICAL_LEAK` | 10 |
| 403 | — | Absent | `post` | `EXPECTED_DENIAL` (RLS blocked) | 0 |
| 403 | — | Absent | `pre` | `UNEXPECTED_PRE_CONTAINMENT_DENIAL` | 11 |
| 401 | `UNAUTHORIZED_INVALID_API_KEY` | Any | `pre` / `post` | `PROBE_FAILED` (invalid API key) | 11 |
| 401 | Any other value / absent | Any | `pre` / `post` | `PROBE_FAILED` (auth error) | 11 |
| Any 2xx | — | Present + row-shaped body (`[\s*{\s*"id"`) | Any | `CRITICAL_DATA_LEAK` | 10 |
| — | — | — | Any | Curl transport non-zero | 11 (`PROBE_FAILED`) |

**Exit codes:**

- `0` = clean
- `10` = critical leak
- `11` = probe failed

### Evidence Output

`d2-prod-probe-<mode>-<UTC>.json`

Sanitized fields:

- Mode
- HTTP status per table
- Content-Range presence and truncated value
- Body length
- Body shape (never raw content)
- Anon key SHA256 first-8 (never full key)
- Classification per table

### Lesson Learned (Wave 6B First Attempt, 2026-10-17T10-46-04Z)

The pre-fix probe treated `401` (invalid/expired key) and `403` (RLS denial) identically as `EXPECTED_PRE_CONTAINMENT_DENIAL`. An invalid legacy anon key produced three `401` responses that were misclassified as passing.

Root cause: no `sb-error-code` header inspection and no mode awareness.

The `-Mode` parameter and `sb-error-code` check added in Phase 11 Wave 7 B2 prevent recurrence:

- Invalid-key `401` is now `PROBE_FAILED` (exit 11).
- Mode disambiguates `200/206` (exposure vs. leak) and `403` (unexpected vs. denial).

### Pass Criteria — Pre-Containment Mode (Wave 6B Baseline)

- Script exit code = `0`
- Each table: HTTP `200` or `206` with `Content-Range` present (anon SELECT confirmed)
- Body shape: `[]` — no row data returned (via `limit=0`)
- No `UNAUTHORIZED_INVALID_API_KEY` in any response

### Pass Criteria — Post-Containment Mode (Wave 7 Post-Execution)

- Script exit code = `0`
- Each table: HTTP `403` (RLS denial)
- No `Content-Range` header
- No row-shaped body
- No `UNAUTHORIZED_INVALID_API_KEY` in any response

### Recorded — Wave 6B Pre-Containment Baseline (2026-10-17T11-18-09Z)

- **Evidence:** `evidence/wave6/d2-prod-probe-2026-10-17T11-18-09Z.json`
- **Anon key fingerprint:** `4b07cb15` (publishable key)
- **Subscription:** HTTP `206` | Content-Range `*/2` | Body `[]`
- **Notification:** HTTP `206` | Content-Range `*/21` | Body `[]`
- **PaymentProof:** HTTP `200` | Content-Range `*/0` | Body `[]`

**Note:** This run's JSON was produced by the **pre-fix** script; classifications in that file are labeled via the buggy 401/403 logic. The corrected script (Part 2 of B2) will produce a fresh run with accurate labels.

### Recorded — Invalid-Key Negative Test (To Be Generated Wave 7 B2)

- **Evidence:** `evidence/wave6/d2-prod-probe-invalid-<UTC>.json`
- **Purpose:** Prove the fix correctly classifies invalid-key `401` as `PROBE_FAILED`.
- **Expected:** 3 × `PROBE_FAILED`, exit `11`, `sb-error-code=UNAUTHORIZED_INVALID_API_KEY` recorded per table.

### Recorded — Post-Containment (Fill After Phase A Execution Approval)

- **Evidence:** `evidence/wave6/d2-prod-probe-post-<UTC>.json`
- **Expected:** 3 × `EXPECTED_DENIAL` (HTTP 403), exit `0`.

---

## 5. authenticated SQL-Role Probes — Fail-Closed with Cleanup Verification (P0-3)

**Pass condition:** SQLSTATE 42501 ONLY = PASS.

**Fail conditions (both must be handled and reported as FAIL):**
- Successful SELECT (including count=0) → FAIL (SELECT privilege still active)
- Any SQLSTATE other than 42501 → FAIL (unexpected error)

**Cleanup verification (mandatory):** Every probe confirms role is restored to `postgres` via `set_config('role', 'postgres', true)`, and reports the post-cleanup `current_user` inline in the NOTICE/ERROR message. Cleanup is verified on all 3 paths: PASS (42501), FAIL-succeeded, FAIL-unexpected.

**Fail-closed behavior:** Successful SELECT or unexpected SQLSTATE raises an EXCEPTION that propagates out of the DO block, forcing statement failure so automation stops.

**Isolation:** Each table probe runs in its own `DO $$` block. On PG17 dry-run, run each in a fresh connection to prevent any lingering session state (see §5.4).

**Restructure rationale (C2 fix):** In v5, the cleanup `set_config('role', 'postgres', true)` was placed after the inner `BEGIN...EXCEPTION` block — meaning it was SKIPPED on both FAIL paths (uncaught exception propagation). Additionally, the "successful SELECT" FAIL path raised a deliberate `P0001` that was then caught by the block's own `WHEN OTHERS` handler, producing a confusing "unexpected SQLSTATE=P0001" message. The v6 restructure:
- Places cleanup inside each exception branch AND on the fall-through path
- Uses `RETURN` after PASS-path cleanup to exit cleanly
- Raises the "SELECT SUCCEEDED" exception OUTSIDE the inner handler (so it is not caught by the block itself)
- Reports `cleanup_user=` inline in every outcome message
- Adds post-block `SELECT current_user` assertion for external confirmation

### 5.1 Subscription probe (fail-closed with cleanup on all paths)

```sql
DO $$
DECLARE
  v_count        BIGINT;
  v_state        TEXT;
  v_msg          TEXT;
  v_cleanup_user TEXT;
BEGIN
  -- Switch to authenticated role
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Subscription"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- PASS path: SELECT denied with 42501
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'Subscription: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      -- Unexpected error path
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'Subscription: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%',
        v_state, v_msg, v_cleanup_user;
  END;

  -- Reached only if SELECT succeeded → FAIL
  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'Subscription: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%',
    v_count, v_cleanup_user;
END $$;

-- Post-block cleanup assertion
SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;
```

**Expected outcomes:**

- **PASS path (production, after containment):** `NOTICE: Subscription: SQLSTATE=42501 -- PASS; cleanup_user=postgres`
- **FAIL-succeeded path (PG17 dry-run with SELECT granted):** `ERROR: Subscription: SELECT SUCCEEDED with count=N -- FAIL (SELECT privilege still active); cleanup_user=postgres`
- **FAIL-unexpected path (any other error):** `ERROR: Subscription: unexpected SQLSTATE=X MSG=Y -- FAIL; cleanup_user=postgres`

**Recorded — PASS path (PG17 dry-run, containment applied):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — FAIL-succeeded proof (PG17 dry-run, SELECT granted — must fail-closed):**
- ERROR line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — Production execution (at containment time):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

### 5.2 Notification probe (fail-closed with cleanup on all paths)

```sql
DO $$
DECLARE
  v_count        BIGINT;
  v_state        TEXT;
  v_msg          TEXT;
  v_cleanup_user TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Notification"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'Notification: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'Notification: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%',
        v_state, v_msg, v_cleanup_user;
  END;

  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'Notification: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%',
    v_count, v_cleanup_user;
END $$;

SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;
```

**Expected outcomes:**

- **PASS path:** `NOTICE: Notification: SQLSTATE=42501 -- PASS; cleanup_user=postgres`
- **FAIL-succeeded path:** `ERROR: Notification: SELECT SUCCEEDED with count=N -- FAIL (SELECT privilege still active); cleanup_user=postgres`
- **FAIL-unexpected path:** `ERROR: Notification: unexpected SQLSTATE=X MSG=Y -- FAIL; cleanup_user=postgres`

**Recorded — PASS path (PG17 dry-run, containment applied):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — FAIL-succeeded proof (PG17 dry-run, SELECT granted — must fail-closed):**
- ERROR line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — Production execution (at containment time):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

### 5.3 PaymentProof probe (fail-closed with cleanup on all paths)

```sql
DO $$
DECLARE
  v_count        BIGINT;
  v_state        TEXT;
  v_msg          TEXT;
  v_cleanup_user TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."PaymentProof"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'PaymentProof: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'PaymentProof: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%',
        v_state, v_msg, v_cleanup_user;
  END;

  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'PaymentProof: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%',
    v_count, v_cleanup_user;
END $$;

SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;
```

**Expected outcomes:**

- **PASS path:** `NOTICE: PaymentProof: SQLSTATE=42501 -- PASS; cleanup_user=postgres`
- **FAIL-succeeded path:** `ERROR: PaymentProof: SELECT SUCCEEDED with count=N -- FAIL (SELECT privilege still active); cleanup_user=postgres`
- **FAIL-unexpected path:** `ERROR: PaymentProof: unexpected SQLSTATE=X MSG=Y -- FAIL; cleanup_user=postgres`

**Recorded — PASS path (PG17 dry-run, containment applied):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — FAIL-succeeded proof (PG17 dry-run, SELECT granted — must fail-closed):**
- ERROR line: ___________
- Post-block `SELECT current_user`: ___________

**Recorded — Production execution (at containment time):**
- NOTICE line: ___________
- Post-block `SELECT current_user`: ___________

### 5.4 Recommended Execution Isolation (PG17 dry-run)

On PG17 disposable, run each DO block as a **separate statement** in a fresh connection (`psql -c '...'` or fresh SQL Editor tab) to prevent any lingering session state.

For each table, exercise BOTH paths:
1. **PASS path:** Apply containment (REVOKE) first, then run DO block → expect 42501 NOTICE
2. **FAIL-succeeded path:** Grant SELECT first (or run before containment), then run DO block → expect fail-closed ERROR
3. **Post-block assertion:** After each, run `SELECT current_user;` in a fresh connection → expect `postgres`

Example:
```powershell
# PASS path — containment applied
psql $dsn -c "REVOKE ALL PRIVILEGES ON public.\"Subscription\" FROM authenticated;"
psql $dsn -c "DO $$ ... $$;"   # expect NOTICE 42501
psql $dsn -c "SELECT current_user;"   # expect postgres

# FAIL-succeeded path — SELECT granted (do NOT leave this in place)
psql $dsn -c "GRANT SELECT ON public.\"Subscription\" TO authenticated;"
psql $dsn -c "DO $$ ... $$;"   # expect ERROR "SELECT SUCCEEDED -- FAIL"
psql $dsn -c "SELECT current_user;"   # expect postgres
psql $dsn -c "REVOKE ALL PRIVILEGES ON public.\"Subscription\" FROM authenticated;"   # clean up
```

Recorded isolation method: ___________

---

## 6. service_role + postgres + audit_readonly — Verify Unchanged (P1-8)

### 6.1 service_role

```sql
SELECT has_table_privilege('service_role', 'public."Subscription"', 'SELECT') AS sr_sub,
       has_table_privilege('service_role', 'public."Notification"', 'SELECT') AS sr_notif,
       has_table_privilege('service_role', 'public."PaymentProof"', 'SELECT') AS sr_pay;
```

Expected: all `true`.

Recorded: ___________

### 6.2 postgres

```sql
SELECT has_table_privilege('postgres', 'public."Subscription"', 'SELECT') AS pg_sub,
       has_table_privilege('postgres', 'public."Notification"', 'SELECT') AS pg_notif,
       has_table_privilege('postgres', 'public."PaymentProof"', 'SELECT') AS pg_pay;
```

Expected: all `true`.

Recorded: ___________

### 6.3 audit_readonly — ALL THREE TABLES (P1-8 fix)

```sql
SELECT has_table_privilege('audit_readonly', 'public."Subscription"', 'SELECT') AS ar_sub,
       has_table_privilege('audit_readonly', 'public."Notification"', 'SELECT') AS ar_notif,
       has_table_privilege('audit_readonly', 'public."PaymentProof"', 'SELECT') AS ar_pay;
```

**Expected per audit_readonly role policy:**
- `ar_sub` = true
- `ar_notif` = true
- `ar_pay` = true

All three must be true (audit role intended to retain read access on all 3 tables). If any is false:
- Was pre-state false? Then no change needed.
- Was pre-state true? Then containment removed audit access — investigate + rollback audit-only grant.

Recorded:
- Subscription: pre=___ post=___
- Notification: pre=___ post=___
- PaymentProof: pre=___ post=___

---

## 7. Application Smoke Tests — Non-Mutating Proof (P1-9)

**No production data insert/delete authorized.** Every smoke test must be proven non-mutating via code inspection AND network capture.

### 7.1 Code Inspection — Prove Selected Endpoints Are Read-Only

For each endpoint used by the smoke tests, inspect the exact deployed source:

```powershell
cd C:\Users\Aashir\Projects\valtriox-trackb
git rev-parse HEAD   # confirm deployed SHA
git status --porcelain   # must be empty

# Find the subscription route source
Get-ChildItem -Recurse -File -Include "route.ts","route.js" |
  Where-Object { $_.FullName -match 'subscription' } |
  Select-Object FullName
```

Then read each route's HTTP method handlers. Record for each:
- HTTP method(s) exposed
- DB writes (`create`, `update`, `delete`, `upsert`, `$executeRaw` with mutation) — YES/NO
- Notifications created — YES/NO
- Sessions written — YES/NO

Recorded:
- Subscription/current route: path ___ | methods ___ | writes? ___ | notifications? ___
- Notification/bell route: path ___ | methods ___ | writes? ___
- Payment-proof route: path ___ | methods ___ | writes? ___
- Homepage/login route: path ___ | methods ___ | sessions written? ___

### 7.2 Network Capture — Prove GET-Only During Smoke Tests

**Use an existing authenticated session — do NOT perform fresh login if login creates session rows.**

If login creates sessions, mark login smoke test as `NOT RUN — side effect` and document.

Browser DevTools → Network tab → Preserve log → run smoke test steps → export HAR or capture method list.

Recorded:
- Subscription flow: methods used ___ | non-GET count ___
- Notification flow: methods used ___ | non-GET count ___
- Payment-proof page load: methods used ___ | non-GET count ___
- Homepage load: methods used ___ | non-GET count ___
- Login: `NOT RUN — session write side effect` OR `GET only` (verify)

### 7.3 Documented Side Effects

If ANY smoke test step is found to mutate:
- Row counts before/after for the affected table
- Explicit inventory of writes
- Attach to submission
- If mutation is unauthorized → STOP

Recorded: ___________

### 7.4 Smoke Test Evidence

- Subscription flow: screenshot + network method capture
- Notification flow: screenshot + network method capture
- Payment-proof: page loads (screenshot), no test upload
- Prisma runtime: Vercel function log excerpt
- Homepage: HTTP 200 + screenshot
- Login: `NOT RUN — session write side effect` OR successful with session write documented

Recorded: ___________

---

## 8. Row Counts — Record + Reconcile (Not Hard-Fail)

```sql
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";
```

Pre-execution (JIT): ___________  
Post-execution (here): ___________  
Reconciled (yes/no): ___________

Note: informational; live production may change concurrently.

---

## 9. RLS State — Unchanged

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;
```

Expected: identical to JIT Section 4.

Recorded: ___________

---

## 10. Supabase Security Advisor

Open Supabase → Security Advisor.

Expected: no new findings; existing `rls_disabled_in_public` state unchanged.

Recorded: ___________

---

## 11. Logs Review — 5-Minute Window After Execution

### 11.1 Postgres Logs

Filter: last 5 minutes. Search: `permission denied` / `42501`.

**Expected:** only known test-probe denials from DO blocks (Sections 5.1–5.3). No unexpected application/service/runtime permission errors.

**Not expected:** zero permission-denied logs.

Recorded: ___________

### 11.2 Vercel Runtime Logs

Filter: last 5 minutes. Search: `500`, `Error`, `Prisma`.

Expected: no new error spike attributable to containment.

Recorded: ___________

---

## 12. Success Criteria — All Must Be True

- [ ] ACL post-state: no anon/authenticated/PUBLIC table grants on 3 tables
- [ ] Table-level 96-check matrix: anon all false; authenticated all false; service_role unchanged (24/24); postgres unchanged (24/24)
- [ ] Column-level: no anon/authenticated/PUBLIC column grants on 3 tables
- [ ] Effective column access: no true for anon/authenticated on any target column
- [ ] anon HTTP probe script exit code = 0
- [ ] anon HTTP probe: 401/403, no Content-Range, no row-shaped body for all 3 tables
- [ ] authenticated SQL probe — Subscription: SQLSTATE 42501 (PASS path), NOTICE line contains `cleanup_user=postgres`
- [ ] authenticated SQL probe — Notification: SQLSTATE 42501 (PASS path), NOTICE line contains `cleanup_user=postgres`
- [ ] authenticated SQL probe — PaymentProof: SQLSTATE 42501 (PASS path), NOTICE line contains `cleanup_user=postgres`
- [ ] Fail-closed proof: with SELECT granted, all 3 DO blocks raise the "SELECT SUCCEEDED" ERROR (PG17 dry-run)
- [ ] Cleanup verified on all paths: post-block `SELECT current_user` shows `postgres` for PASS, FAIL-succeeded, and FAIL-unexpected paths
- [ ] service_role effective privileges unchanged (true)
- [ ] postgres effective privileges unchanged (true)
- [ ] audit_readonly: all 3 tables (Subscription, Notification, PaymentProof) verified
- [ ] Smoke tests: non-mutating proven via code + network capture
- [ ] Row counts recorded + reconciled (not hard-failed)
- [ ] RLS state unchanged
- [ ] Supabase Advisor unchanged
- [ ] Postgres logs show only known test-probe denials
- [ ] Vercel logs show no new error spike

**Any failure:** Stop. Capture evidence. Follow break-glass policy. No auto-rollback.

**Any successful SELECT under authenticated role — including count=0 — treated as FAIL and reported as security regression.**

---

## 13. Status

`DOCUMENTED TEMPLATE`  
`NOT EXECUTED`

**Prepared by:** Ashir Raza  
**Date:** 2026-10-17