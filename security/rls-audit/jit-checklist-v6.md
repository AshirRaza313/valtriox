# JIT Pre-Execution Checklist — Phase A Containment (v6)

**File:** phase10-corrections/jit-checklist-v6.md  
**Status:** DOCUMENTED TEMPLATE — Execution evidence filled after PG17 disposable test  
**Supersedes:** jit-checklist-v5.md  
**Corrections:** Phase 11 Wave 5A:
- C1: pre-state baseline framing (§6.1, §6.2, §6.3, §7, §15)
- C3 (partial): role self-row exclusion (§8.1), pg_catalog filtering (§11.2-11.5), procedure scanning (§11.4)
**Prior corrections (carried from v5):** P0-1 (column privileges text handling), P0-2 (role-path direction reversed), P0-4 (project binding operational), P1-6 (working tree clean check), P1-7 (PostgREST exposed schemas)  
**Date:** 2026-10-17

---

## 0. Scope

Row counts informational only. This checklist runs immediately before Phase A containment execution.  
**Execution evidence** for each section will be captured on the PG17 disposable test environment first, then re-verified in production at execution time.

**Evidence discipline:** A section is only "complete" when both (a) the SQL executes cleanly on PG17 disposable, and (b) the actual output is recorded in the designated fields.

---

## 1. Working Tree + Deployed SHA — Hard Equality (P1-6)

### 1.1 Working Tree Must Be Clean

```powershell
cd C:\Users\Aashir\Projects\valtriox-trackb
$porcelain = git status --porcelain
if ([string]::IsNullOrEmpty($porcelain)) {
  Write-Host "WORKING TREE CLEAN -- OK"
} else {
  Write-Host "WORKING TREE DIRTY -- STOP" -ForegroundColor Red
  Write-Host $porcelain
}
```

**Required:** empty output → OK. Any non-empty output → STOP.

Recorded (empty = pass): ___________

### 1.2 Local Source SHA

```powershell
git rev-parse HEAD
```

Recorded local SHA: ___________

### 1.3 Deployed SHA Hard Equality

**Vercel Dashboard → Project → Deployments → Production → copy SHA.**

```powershell
$localSha = git rev-parse HEAD
$vercelSha = "VERCEL_DASHBOARD_ACCESS_BLOCKED_CASE_TNS_01svbbdIV5N1m04Q"
if ($localSha -eq $vercelSha) {
  Write-Host "SHA MATCH -- OK"
} else {
  Write-Host "SHA MISMATCH -- STOP" -ForegroundColor Red
}
```

**Required:** exact string equality. Mismatch → STOP.

Recorded:
- Local SHA: ___________
- Vercel SHA: ___________
- Match (yes/no): ___________

### 1.4 Deployment Freeze During Execution Window

**Confirmed:** No deployment in progress on Vercel during the JIT + containment window.  
GitHub Actions: no workflow run queued/in-progress for production branch.

Recorded: ___________

---

## 2. Target Identity + Project Ref Binding (P0-4)

### 2.1 Session-Level Identity

```sql
SELECT current_database() AS db,
       current_user,
       session_user,
       current_role,
       inet_server_addr() AS server_ip,
       inet_server_port() AS server_port,
       current_setting('server_version_num') AS svn,
       current_setting('server_version') AS sv,
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc_now;
```

**Note:** `inet_server_addr()` returns an IP, not a hostname. It does NOT uniquely bind to the project. Hostname/project-ref binding is established via Section 2.2 + 2.3 below.

Recorded:
- db: ___________
- current_user: ___________
- session_user: ___________
- current_role: ___________
- server_ip: ___________
- server_port: ___________
- svn: ___________
- sv: ___________
- utc_now: ___________

### 2.2 Project Ref Binding — Pooler Username Suffix (P0-4)

Query current session's connected username at the pooler level:

```sql
SELECT current_setting('role', true) AS current_role_guc,
       current_setting('session_authorization', true) AS session_authorization_guc,
       current_setting('application_name', true) AS application_name_guc;
```

**Required evidence path (choose one):**

**Path A — Supabase SQL Editor (recommended):**
- Open Supabase Dashboard → the specific project → SQL Editor
- Take a screenshot showing:
  - Project name (top-left, e.g., "brandflow-client 1")
  - Project ref (visible in URL bar: wqwsagnxkamblnefhpzx)
  - The SQL Editor as the active pane
- Save screenshot as phase10-corrections/target-binding-<UTC>.png
- Record: "SQL Editor session — project ref wqwsagnxkamblnefhpzx confirmed via dashboard UI"

**Path B — psql:**
```sql
\conninfo
```
Capture the sanitized hostname portion showing wqwsagnxkamblnefhpzx.pooler.supabase.com (or equivalent). Do NOT capture the password.

**Path C — Direct connection:**
Sanitized DSN hostname must contain wqwsagnxkamblnefhpzx. Password redacted.

**Required:** Project-ref binding confirmed via Path A, B, or C. NULL/unavailable binding → STOP.

Recorded path used: ___________  
Binding confirmed (yes/no): ___________

### 2.3 Trusted Database Fingerprint (P0-4)

```sql
SELECT current_setting('data_directory', true) AS data_directory,
       current_setting('ssl_library', true) AS ssl_library,
       current_setting('TimeZone', true) AS tz;
```

Recorded:
- data_directory: ___________
- ssl_library: ___________
- TimeZone: ___________

### 2.4 Named Executor + Client

- Named executor: ___________
- Execution client: ___________ (SQL Editor / psql / app)
- Execution client fail-on-error verified: ___________
- ON_ERROR_STOP (psql) or per-statement execution verified (Editor): ___________

---

## 3. Row Counts (Informational)

```sql
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";
```

**Reference (Phase 2.6):** 2 / 21 / 0

Recorded: ___________

**Note:** informational only. Production may change. Compare and reconcile.

---

## 4. RLS State

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;
```

**Expected:** relrowsecurity=true, relforcerowsecurity=false, owner=postgres.

Recorded: ___________

---

## 5. Table-Level ACL

```sql
SELECT c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       a.privilege_type,
       COALESCE(a.grantor::regrole::text, 'N/A') AS grantor,
       a.is_grantable AS grant_option
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL aclexplode(c.relacl) AS a ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname, grantee, a.privilege_type;
```

**Expected per Phase 2.1:** anon=8, authenticated=8, postgres=8, service_role=8, audit_readonly=SELECT.

Recorded: ___________

---

## 6. Column-Level Privileges — Full (P0-1)

### 6.1 Direct Column Grants via information_schema (text-safe)

`information_schema.column_privileges.grantee` is text. Do not compare to integer 0.

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

**Pre-state (JIT):** Record the baseline output here. `anon`/`authenticated` are expected to appear (they hold table-level grants; column_privileges reflects inherited column access). **Zero rows is the POST-containment expectation** and belongs in `post-verification-v6.md §3.1` — not here.

Recorded baseline (JIT): ___________

### 6.2 Direct Column Grants via pg_attribute ACL (catalog-level)

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

**Pre-state (JIT):** Record the baseline output here. Note: **direct** column-level ACLs (`pg_attribute.attacl`) are typically 0 in pre-state because table-level grants imply column access. Any non-zero row here indicates explicit column-level GRANTs; those will also need revocation in containment. Zero rows remains the target but is expected by default; if non-zero, record the explicit grants for containment completeness.

Recorded baseline (JIT): ___________

### 6.3 Effective Column Access — Per Column, Per Role

For every non-dropped column of the 3 tables, check effective SELECT/INSERT/UPDATE/REFERENCES:

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
  SELECT tbl, col, 'anon' AS role_name, 'SELECT' AS priv, has_column_privilege('anon', 'public."' || tbl || '"', col, 'SELECT') AS has_pr
  FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'INSERT', has_column_privilege('anon', 'public."' || tbl || '"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'UPDATE', has_column_privilege('anon', 'public."' || tbl || '"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'REFERENCES', has_column_privilege('anon', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'SELECT', has_column_privilege('authenticated', 'public."' || tbl ||'"', col, 'SELECT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'INSERT', has_column_privilege('authenticated', 'public."' || tbl ||'"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'UPDATE', has_column_privilege('authenticated', 'public."' || tbl ||'"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'REFERENCES', has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
)
SELECT * FROM checks
WHERE has_pr = true
ORDER BY tbl, col, role_name, priv;
```

**Pre-state (JIT):** Record the baseline output here. Because `anon`/`authenticated` hold table-level grants, effective column access is expected to be **true** across all columns for SELECT (and for other privs where table grants exist). The output IS the baseline. **Zero rows is the POST-containment expectation** (`post-verification-v6.md §3.3`) — not a JIT expectation.

**STOP condition:** if the baseline differs from Phase 2.1 snapshot (i.e., unexpected column privileges appeared since Phase 2), halt and investigate.

Recorded baseline (JIT): ___________

---

## 7. Effective Table Privileges — 96-Check Matrix

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

**Pre-state baseline (JIT) — 24 checks per role (3 tables × 8 privileges):**

| Role | Expected true / 24 | Recorded |
|------|--------------------|----------|
| anon | 24 / 24 | ___ / 24 |
| authenticated | 24 / 24 | ___ / 24 |
| service_role | 24 / 24 | ___ / 24 |
| postgres | 24 / 24 | ___ / 24 |

Any deviation from 24/24 for these roles in pre-state → STOP + investigate (unexpected pre-state).

**Post-containment expectation** (`post-verification-v6.md §2`): anon = 0/24, authenticated = 0/24, service_role = 24/24 (unchanged), postgres = 24/24 (unchanged).

Recorded: ___________

---

## 8. Role-Path Analysis — Correct Direction (P0-2)

### 8.1 What Can anon/authenticated SET/USE? (OUTBOUND paths)

```sql
SELECT r.rolname AS target_role,
       pg_has_role('anon', r.rolname, 'SET') AS anon_can_set,
       pg_has_role('anon', r.rolname, 'USAGE') AS anon_can_use,
       pg_has_role('authenticated', r.rolname, 'SET') AS auth_can_set,
       pg_has_role('authenticated', r.rolname, 'USAGE') AS auth_can_use
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg\_%'
  AND r.rolname NOT IN ('anon', 'authenticated')
ORDER BY r.rolname;
```

**Self-row exclusion:** `pg_has_role(X, X, ...)` returns true by PostgreSQL self-membership semantics. Rows where `target_role = 'anon'` or `target_role = 'authenticated'` are therefore excluded intentionally — they would always show true and add noise, not signal.

**Required analysis (OUTBOUND):**

For every role where `anon_can_set = true` or `auth_can_set = true`, correlate:
- That role's table privileges on Phase A tables
- That role's column privileges on Phase A target columns
- Whether that path could re-expose revoked access

**Stop condition:** Any outbound path from anon/authenticated to a role that holds Phase A privileges → STOP + investigate. (Note: `USAGE` is weaker than `SET`; treat `SET` paths as authoritative for this audit.)

Recorded: ___________

### 8.2 Direct Outbound Memberships of anon/authenticated

```sql
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.member::regrole::text IN ('anon', 'authenticated')
ORDER BY member_role, granted_role;
```

Recorded: ___________

### 8.3 Direct Inbound Memberships into anon/authenticated

```sql
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.roleid::regrole::text IN ('anon', 'authenticated')
ORDER BY granted_role, member_role;
```

**Inbound allowlist:** The following roles are legitimately expected to have INBOUND membership edges into `anon`/`authenticated` in Supabase:
- `authenticator` (Supabase PostgREST gateway — by design)
- `supabase_admin` (cluster admin)
- `postgres` (project owner role)
- `cli_login_postgres` (Supabase CLI — if present)

Any other member_role showing an inbound edge → STOP + investigate.

Recorded: ___________

---

## 9. Bypass Roles

```sql
SELECT rolname, rolsuper, rolinherit, rolbypassrls,
       rolcanlogin, rolcreaterole, rolcreatedb, rolreplication
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'audit_readonly', 'valtriox_evidence_ro')
ORDER BY rolname;
```

**Expected:** anon/authenticated rolsuper=false, rolbypassrls=false.

Recorded: ___________

---

## 10. Policies on Phase A Tables

```sql
SELECT schemaname, tablename, policyname, roles::text, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY tablename, policyname;
```

Recorded: ___________

---

## 11. Exposed Schemas + Alternate Paths (P1-7)

### 11.1 Schemas Exposed via PostgREST

```sql
SELECT nspname AS schema_name,
       nspacl::text AS schema_acl,
       pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
WHERE nspname NOT LIKE 'pg\_%'
  AND nspname NOT IN ('information_schema')
ORDER BY nspname;
```

Record any non-public schema (e.g., auth, storage, graphql) that PostgREST may expose.

Recorded: ___________

### 11.2 Views in Application Schemas Referencing Phase A Tables

```sql
SELECT schemaname, viewname, viewowner, definition
FROM pg_views
WHERE definition ~* '\m(Subscription|Notification|PaymentProof)\M'
  AND schemaname NOT LIKE 'pg\_%'
  AND schemaname <> 'information_schema'
ORDER BY schemaname, viewname;
```

**Filters applied (C3 fix):**
- Word-boundary regex `\m(...)\M` prevents substring false positives (e.g., `pg_stat_subscription`)
- `schemaname NOT LIKE 'pg\_%'` excludes `pg_catalog` system views
- `schemaname <> 'information_schema'` excludes information_schema views

**Expected:** zero rows.

Recorded: ___________

### 11.3 Materialized Views in Application Schemas

```sql
SELECT schemaname, matviewname, matviewowner, definition
FROM pg_matviews
WHERE definition ~* '\m(Subscription|Notification|PaymentProof)\M'
  AND schemaname NOT LIKE 'pg\_%'
  AND schemaname <> 'information_schema'
ORDER BY schemaname, matviewname;
```

**Filters applied (C3 fix):** same as 11.2.

**Expected:** zero rows.

Recorded: ___________

### 11.4 SECURITY DEFINER Functions + Procedures in Application Schemas

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       p.prokind,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind IN ('f', 'p')
  AND p.prosecdef = true
  AND n.nspname NOT LIKE 'pg\_%'
  AND n.nspname <> 'information_schema'
  AND pg_get_functiondef(p.oid) ~* '\m(Subscription|Notification|PaymentProof)\M'
ORDER BY schema_name, function_name;
```

**Filters applied (C3 fix):**
- `prokind IN ('f', 'p')` includes both functions and procedures (previously only 'f')
- Schema filter excludes system schemas
- Word-boundary regex avoids substring matches

**Expected:** zero rows.

Recorded: ___________

### 11.5 Effective EXECUTE on Any Function/Procedure Referencing Phase A Tables

```sql
WITH refs AS (
  SELECT p.oid, n.nspname AS schema_name, p.proname AS function_name, p.prokind
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
    AND n.nspname NOT LIKE 'pg\_%'
    AND n.nspname <> 'information_schema'
    AND pg_get_functiondef(p.oid) ~* '\m(Subscription|Notification|PaymentProof)\M'
)
SELECT schema_name, function_name, prokind,
       has_function_privilege('anon', refs.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', refs.oid, 'EXECUTE') AS auth_exec
FROM refs
ORDER BY schema_name, function_name;
```

**Filters applied (C3 fix):** schema filter + word-boundary regex + procedure inclusion (`prokind IN ('f','p')`).

**Expected:** zero rows OR (if rows exist) all exec columns false.

Recorded: ___________

---

## 12. Runtime/Browser Direct Access — Exact Deployed SHA Scope

```powershell
cd C:\Users\Aashir\Projects\valtriox-trackb

# Working tree must be clean (also confirmed in Section 1.1)
git status --porcelain

# Exact deployed SHA
git rev-parse HEAD

# Scan exact commit content for Phase A table names in client code
Get-ChildItem -Recurse -File -Include "*.ts","*.tsx","*.js","*.jsx","*.mjs","*.cjs" |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next|\.git|dist|build' } |
  Select-String -Pattern @(
    'Subscription',
    'Notification',
    'PaymentProof',
    'rest/v1/Subscription',
    'rest/v1/Notification',
    'rest/v1/PaymentProof'
  ) |
  Select-Object Path, LineNumber |
  Format-List
```

Recorded classification: ___________

---

## 13. SET LOCAL Placement

```powershell
Get-Content "C:\Users\Aashir\Projects\evidence-phase1\phase5-phase-a-package\phase-a-containment-v3.sql" |
  Select-String "BEGIN;|SET LOCAL|COMMIT;"
```

**Expected order:**
- `BEGIN;`
- `SET LOCAL lock_timeout = '5s';`
- `SET LOCAL statement_timeout = '30s';`
- `COMMIT;`

Recorded: ___________

---

## 14. Rollback Comparison

For each Phase A table × each role (anon, authenticated):
- Exactly 8 expected privileges
- grantor = postgres
- is_grantable = false
- No PUBLIC grants
- No unexpected inherited path

**Mismatch → STOP + regenerate rollback.** Rollback remains separately authorized break-glass exposure restoration. This checklist does NOT approve rollback execution.

Recorded: ___________

---

## 15. Stop Conditions (Abort on Any)

- Working tree not clean (Section 1.1)
- Local SHA != Vercel SHA (Section 1.3)
- Project ref binding NULL/unavailable (Section 2.2)
- current_user != 'postgres'
- svn < 170000
- Client fail-on-error not verified
- Deployment in progress (Section 1.4)
- Pre-state column baseline (§6.3) does not match Phase 2.1 snapshot (i.e., unexpected column privileges appeared since Phase 2)
- Any outbound SET path from anon/authenticated to a role holding Phase A privileges (Section 8.1)
- Any view/matview/SECURITY DEFINER function/procedure referencing Phase A tables in application schemas (Section 11)
- Direct client Data API access on Phase A tables (Section 12)
- SET LOCAL placement incorrect
- Rollback comparison mismatch
- Supabase outage / maintenance

**On stop: Do NOT execute. No partial. No auto-rollback. Report.**

---

## 16. Evidence Discipline

Each section above records either:
- Actual output from PG17 disposable test (for validation), AND
- Actual output from production at execution time (for the execution record)

Template sections with blanks will be filled after successful PG17 dry-run. "Complete claim" is only made after evidence is attached.

---

## 17. Status

`DOCUMENTED TEMPLATE`  
`NOT EXECUTED`

**Prepared by:** Ashir Raza  
**Date:** 2026-10-17