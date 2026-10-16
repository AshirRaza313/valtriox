# Post-Verification Checklist — Phase A Containment (v5)

**File:** phase10-corrections/post-verification-v5.md  
**Status:** DOCUMENTED TEMPLATE — Execution evidence filled after PG17 disposable test  
**Supersedes:** post-verification-v4.md  
**Corrections:** P0-3 (DO-block fail-closed), P0-5 (anon HTTP probe automated), P1-8 (audit_readonly all 3 tables), P1-9 (smoke test non-mutating proof)  
**Date:** 2026-10-12

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
- anon: all 8 false for all 3 tables
- authenticated: all 8 false for all 3 tables
- service_role: all 8 true (unchanged)
- postgres: all 8 true (unchanged)

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

## 4. anon HTTP Probe — Automated Assertions (P0-5)

**Purpose:** Verify anon access is blocked via PostgREST, with hard-fail on any anomaly.

**Method:** `curl --write-out` captures status; exit code asserted; body & Content-Range validated; script exits non-zero on any failure.

**Script — `phase10-corrections/anon-http-probe.ps1`:**

```powershell
# anon-http-probe.ps1
# Automated anon HTTP probe with hard-fail assertions.
# ZeroFreeBSTR cleanup on all paths.

$ErrorActionPreference = "Stop"
$base = "https://wqwsagnxkamblnefhpzx.supabase.co/rest/v1"
$tables = @("Subscription", "Notification", "PaymentProof")
$failures = @()

$anonKeySecure = Read-Host "Anon Key" -AsSecureString
$anonKey = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($anonKeySecure)
    $anonKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

    foreach ($t in $tables) {
        Write-Host "===== $t =====" -ForegroundColor Cyan

        $headersFile = "$env:TEMP\anon-http-$t-headers.txt"
        $bodyFile = "$env:TEMP\anon-http-$t-body.json"

        # --write-out captures status; --fail-with-body makes curl non-zero on HTTP >= 400
        # but we want the status even on 4xx; so we do NOT use --fail.
        # We use --write-out to print the status to stdout, and check exit code separately.
        $httpStatus = curl.exe -s -S `
            -D $headersFile `
            -o $bodyFile `
            -w "%{http_code}" `
            -X GET "$base/$t?select=id&limit=0" `
            -H "apikey: $anonKey" `
            -H "Authorization: Bearer $anonKey" `
            -H "Prefer: count=exact"

        $curlExit = $LASTEXITCODE
        Write-Host "HTTP: $httpStatus | curl exit: $curlExit"

        if ($curlExit -ne 0) {
            $failures += "$t : curl exit $curlExit (transport failure)"
            continue
        }

        # Status must be 401 or 403
        if ($httpStatus -notin @("401", "403")) {
            $failures += "$t : unexpected HTTP $httpStatus (expected 401/403)"
            continue
        }

        # Content-Range must be absent
        $headerText = Get-Content $headersFile -Raw
        if ($headerText -match "(?i)Content-Range:") {
            $failures += "$t : Content-Range header present"
        }

        # Body must not contain a JSON array of rows
        # Sanitized check only; do not print body to terminal
        $bodyText = Get-Content $bodyFile -Raw -ErrorAction SilentlyContinue
        if ($bodyText -match '^\s*\[\s*\{\s*"id"') {
            $failures += "$t : body appears to contain row data (id fields present)"
        }

        # Sanitized summary only
        $bodyPreview = if ($bodyText) {
            $trimmed = $bodyText.Trim()
            if ($trimmed.Length -gt 120) { $trimmed.Substring(0, 120) + "..." } else { $trimmed }
        } else { "(empty)" }
        Write-Host "  Body preview (first 120 chars): $bodyPreview"
        Write-Host "  Content-Range header present: $([bool]($headerText -match '(?i)Content-Range:'))"
        Write-Host ""
    }
}
finally {
    if ($bstr -and $bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $anonKey = $null
    [System.GC]::Collect()
}

if ($failures.Count -gt 0) {
    Write-Host "FAILURES:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "ALL ANON PROBES PASSED (401/403, no Content-Range, no row-shaped body)" -ForegroundColor Green
    exit 0
}
```

**Run:**
```powershell
cd C:\Users\Aashir\Projects\evidence-phase1\phase10-corrections
powershell -ExecutionPolicy Bypass -File .\anon-http-probe.ps1
```

**Pass criteria:**
- Script exit code = 0
- Each table: HTTP 401 or 403
- No `Content-Range` header in any response
- No row-shaped body

Recorded:
- Script exit code: ___________
- Subscription: HTTP ___ | Content-Range ___
- Notification: HTTP ___ | Content-Range ___
- PaymentProof: HTTP ___ | Content-Range ___
- Failures array (empty = pass): ___________

---

## 5. authenticated SQL-Role Probes — Fail-Closed (P0-3)

**Corrected pass condition: SQLSTATE 42501 ONLY = PASS. Any successful SELECT (including count=0) = FAIL.**

**Fail-closed behavior:** Successful SELECT or unexpected SQLSTATE must raise an EXCEPTION, not just NOTICE. This forces the DO block to fail so automation stops.

**Isolation:** Each table probe runs in its own `DO $$` block, using `EXCEPTION` handler. In PostgreSQL, an unhandled exception inside DO without a handler aborts the statement. With a handler, we control behaviour — but MUST re-raise for failures.

**Role cleanup:** After the probe, we explicitly reset role to `postgres` (session-level via `set_config`) and assert `current_role = 'postgres'`.

### 5.1 Subscription probe (fail-closed)

```sql
DO $$
DECLARE
  v_count BIGINT;
  v_state TEXT;
  v_msg TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Subscription"' INTO v_count;
    -- Success = FAIL: role still has SELECT
    RAISE EXCEPTION 'Subscription: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active)', v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Subscription: SQLSTATE=42501 -- PASS';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      RAISE EXCEPTION 'Subscription: unexpected SQLSTATE=% MSG=%', v_state, v_msg;
  END;

  -- Explicit role cleanup
  PERFORM set_config('role', 'postgres', true);
END $$;

-- Assert cleanup
SELECT current_role AS post_cleanup_role;  -- must equal 'postgres'
```

**Expected:** `NOTICE: Subscription: SQLSTATE=42501 -- PASS` and `post_cleanup_role = postgres`.  
Any other NOTICE/ERROR = FAIL.

Recorded: ___________

### 5.2 Notification probe (fail-closed)

```sql
DO $$
DECLARE
  v_count BIGINT;
  v_state TEXT;
  v_msg TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Notification"' INTO v_count;
    RAISE EXCEPTION 'Notification: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active)', v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Notification: SQLSTATE=42501 -- PASS';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      RAISE EXCEPTION 'Notification: unexpected SQLSTATE=% MSG=%', v_state, v_msg;
  END;

  PERFORM set_config('role', 'postgres', true);
END $$;

SELECT current_role AS post_cleanup_role;  -- must equal 'postgres'
```

**Expected:** `NOTICE: Notification: SQLSTATE=42501 -- PASS` and `post_cleanup_role = postgres`.

Recorded: ___________

### 5.3 PaymentProof probe (fail-closed)

```sql
DO $$
DECLARE
  v_count BIGINT;
  v_state TEXT;
  v_msg TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."PaymentProof"' INTO v_count;
    RAISE EXCEPTION 'PaymentProof: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active)', v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PaymentProof: SQLSTATE=42501 -- PASS';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      RAISE EXCEPTION 'PaymentProof: unexpected SQLSTATE=% MSG=%', v_state, v_msg;
  END;

  PERFORM set_config('role', 'postgres', true);
END $$;

SELECT current_role AS post_cleanup_role;  -- must equal 'postgres'
```

**Expected:** `NOTICE: PaymentProof: SQLSTATE=42501 -- PASS` and `post_cleanup_role = postgres`.

Recorded: ___________

### 5.4 Recommended Execution Isolation (PG17 dry-run)

On PG17 disposable, run each DO block as a **separate statement** in a fresh connection (`psql -c '...'` or fresh SQL Editor tab) to prevent any lingering session state.

Example:
```powershell
psql $dsn -c "DO $$ ... $$;"
psql $dsn -c "SELECT current_role;"
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
- [ ] Table-level 96-check matrix: anon all false; authenticated all false; service_role unchanged; postgres unchanged
- [ ] Column-level: no anon/authenticated/PUBLIC column grants on 3 tables
- [ ] Effective column access: no true for anon/authenticated on any target column
- [ ] anon HTTP probe script exit code = 0
- [ ] anon HTTP probe: 401/403, no Content-Range, no row-shaped body for all 3 tables
- [ ] authenticated SQL probe — Subscription: SQLSTATE 42501 (fail-closed enforced)
- [ ] authenticated SQL probe — Notification: SQLSTATE 42501 (fail-closed enforced)
- [ ] authenticated SQL probe — PaymentProof: SQLSTATE 42501 (fail-closed enforced)
- [ ] Role cleanup verified after each probe (current_role = postgres)
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
**Date:** 2026-10-12