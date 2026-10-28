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

### 1.3 Deployed Identity Bindings (Two Independent Bindings)

**Design note (Phase 12E follow-up):** This gate replaces the prior "PR HEAD == Vercel Production SHA" equality check, which could never pass for a Preview-only branch (gh api evidence: 0 deployments for branch, sole HEAD deployment env=Preview). The two bindings below are INDEPENDENT. No equality between them is required or expected. Fail-closed discipline is preserved by requiring BOTH bindings to be verified - mismatch on either one is STOP.

**Binding 1 - Reviewed SQL SHA (source of truth: this repo's committed artifacts):**

| File | Expected SHA256 | Expected Size (B) |
|------|-----------------|-------------------|
| phase-a-containment-v3.sql | 59C62F1A92510BD45889BA519957BD1F893934DF18557EFD3DAA1636B1227A3C | 1041 |
| phase-a-rollback-v2.sql | 8CEDA08FAA167F39CA9E0778D44F1661C9FF987143FB2E4AFC0A498ED8787E4D | 987 |

```powershell
# Rule 37: resolve paths from git toplevel
$repoRoot = ((& git rev-parse --show-toplevel) -join "").Trim()
$containmentSrc = Join-Path $repoRoot "security\rls-audit\phase-a-containment-v3.sql"
$rollbackSrc    = Join-Path $repoRoot "security\rls-audit\phase-a-rollback-v2.sql"
$containmentCmt = Join-Path $repoRoot "security\rls-audit\evidence\wave6\containment-v3-copy.sql"

$containmentExpected = "59C62F1A92510BD45889BA519957BD1F893934DF18557EFD3DAA1636B1227A3C"
$rollbackExpected    = "8CEDA08FAA167F39CA9E0778D44F1661C9FF987143FB2E4AFC0A498ED8787E4D"

if (-not (Test-Path -LiteralPath $containmentSrc)) { throw "SQL CONTAINMENT SRC -- STOP (missing)" }
if (-not (Test-Path -LiteralPath $rollbackSrc))    { throw "SQL ROLLBACK SRC -- STOP (missing)" }
if (-not (Test-Path -LiteralPath $containmentCmt)) { throw "SQL CONTAINMENT CMT -- STOP (missing)" }

$h1 = (Get-FileHash -LiteralPath $containmentSrc -Algorithm SHA256).Hash
$h2 = (Get-FileHash -LiteralPath $rollbackSrc    -Algorithm SHA256).Hash
$h3 = (Get-FileHash -LiteralPath $containmentCmt -Algorithm SHA256).Hash

if ($h1 -eq $containmentExpected) { Write-Host "SQL CONTAINMENT SRC SHA -- OK" } else { throw "SQL CONTAINMENT SRC SHA -- STOP (got $h1)" }
if ($h2 -eq $rollbackExpected)    { Write-Host "SQL ROLLBACK SRC SHA -- OK" }    else { throw "SQL ROLLBACK SRC SHA -- STOP (got $h2)" }
if ($h3 -eq $containmentExpected) { Write-Host "SQL CONTAINMENT CMT SHA -- OK" } else { throw "SQL CONTAINMENT CMT SHA -- STOP (got $h3)" }
```

**Required:** Both files must be on disk with SHA256 matching the values above at execution time. Mismatch on either -> STOP.

Recorded:
- Containment SHA actual: ___________
- Containment match (yes/no): ___________
- Rollback SHA actual: ___________
- Rollback match (yes/no): ___________

**Binding 2 - Actual Production deployment (execution window, authoritative):**

Run BOTH commands at execution window. Both must succeed. Do NOT paste fields manually.

```powershell
# Rule 38: full deployment metadata via CLI (authoritative, not manual paste)
# Rule 39: use fetched production SHA, not local HEAD
# C' commit-level cross-check replaces broken deployment-level C
#   (GitHub Deployments integration stale since 2026-06-06)
# Bug #17: vercel CLI prepends progress lines before JSON (e.g.,
#   "Fetching deployment ..."). Strip via Get-JsonBody before ConvertFrom-Json.

function Get-JsonBody {
  param([string]$Raw, [string]$Label)
  if (-not $Raw) { throw "BINDING 2 $Label -- STOP (empty output)" }
  $b1 = $Raw.IndexOf('{'); $b2 = $Raw.IndexOf('[')
  $s = -1
  if     ($b1 -ge 0 -and $b2 -ge 0) { $s = [Math]::Min($b1,$b2) }
  elseif ($b1 -ge 0)                { $s = $b1 }
  elseif ($b2 -ge 0)                { $s = $b2 }
  if ($s -lt 0) { throw "BINDING 2 $Label -- STOP (no JSON opener '{' or '[' in raw output)" }
  $body = $Raw.Substring($s)
  if (-not $body -or $body.Length -lt 2) { throw "BINDING 2 $Label -- STOP (JSON body empty after strip)" }
  return $body
}

$lsOut  = (& vercel ls valtriox --environment=production --format=json 2>&1 | Out-String)
$lsExit = $LASTEXITCODE
if ($lsExit -ne 0) { throw "BINDING 2 LS -- STOP (vercel ls exit $lsExit)" }
if (-not $lsOut)   { throw "BINDING 2 LS -- STOP (empty output)" }
$lsBody = Get-JsonBody $lsOut "LS"
try { $lsObj = $lsBody | ConvertFrom-Json } catch { throw "BINDING 2 LS -- STOP (parse: $($_.Exception.Message))" }
$lsDeps = if ($lsObj.deployments) { @($lsObj.deployments) } else { @($lsObj) }
if ($lsDeps.Count -lt 1) { throw "BINDING 2 LS -- STOP (no deployments)" }
$prodSha       = $lsDeps[0].meta.githubCommitSha
$deploymentUrl = $lsDeps[0].url
$vercelMsg     = $lsDeps[0].meta.githubCommitMessage
$action        = $lsDeps[0].meta.action
if ($prodSha) { $prodSha = $prodSha.ToLower() }
if (-not $prodSha -or $prodSha -notmatch '^[0-9a-f]{40}$') { throw "BINDING 2 SHA FORMAT -- STOP (need 40-char lowercase hex, got '$prodSha')" }

$inspectOut  = (& vercel inspect "https://valtriox.com" --format=json 2>&1 | Out-String)
$inspectExit = $LASTEXITCODE
if ($inspectExit -ne 0) { throw "BINDING 2 INSPECT -- STOP (exit $inspectExit)" }
if (-not $inspectOut)   { throw "BINDING 2 INSPECT -- STOP (empty output)" }
$inspBody = Get-JsonBody $inspectOut "INSPECT"
try { $inspectObj = $inspBody | ConvertFrom-Json } catch { throw "BINDING 2 INSPECT -- STOP (parse: $($_.Exception.Message))" }
$deploymentId = $inspectObj.id
$inspectUrl   = $inspectObj.url
$target       = $inspectObj.target
$state        = $inspectObj.readyState
$aliases      = $inspectObj.aliases
$createdAtMs  = $inspectObj.createdAt

if (-not $deploymentId -or $deploymentId -notmatch '^dpl_') { throw "BINDING 2 DEPLOY-ID -- STOP (got '$deploymentId')" }
if (-not $inspectUrl) { throw "BINDING 2 INSPECT -- STOP (url missing)" }
if ($deploymentUrl -ne $inspectUrl) { throw "BINDING 2 URL-MATCH -- STOP (ls.url != inspect.url)" }
if ($target -ne "production") { throw "BINDING 2 TARGET -- STOP (got '$target', expected 'production')" }
if ($state -ne "READY") { throw "BINDING 2 STATE -- STOP (got '$state', expected 'READY')" }
if (-not $aliases) { throw "BINDING 2 ALIAS -- STOP (aliases[] absent)" }
$aliasArr = @($aliases)
if (($aliasArr -notcontains "valtriox.com") -and ($aliasArr -notcontains "www.valtriox.com")) {
  throw "BINDING 2 ALIAS -- STOP (valtriox.com / www.valtriox.com absent)"
}

$ghRaw  = (& gh api "repos/AshirRaza313/valtriox/commits/$prodSha" 2>&1 | Out-String)
$ghExit = $LASTEXITCODE
if ($ghExit -ne 0) { throw "BINDING 2 CROSS-CHECK -- STOP (gh api exit $ghExit)" }
$ghBody = Get-JsonBody $ghRaw "CROSS-CHECK"
try { $ghObj = $ghBody | ConvertFrom-Json } catch { throw "BINDING 2 CROSS-CHECK -- STOP (parse: $($_.Exception.Message))" }
$ghMsg = $ghObj.commit.message
if (-not $ghMsg) { throw "BINDING 2 CROSS-CHECK -- STOP (commit $prodSha has no message)" }
$needle = if ($vercelMsg -and $vercelMsg.Length -gt 60) { $vercelMsg.Substring(0,60) } else { $vercelMsg }
if ($needle -and ($ghMsg -notmatch [regex]::Escape($needle))) {
  throw "BINDING 2 CROSS-CHECK -- STOP (Vercel/GitHub messages diverge for $prodSha)"
}

Write-Host "BINDING 2 -- OK (sha=$prodSha dpl=$deploymentId env=$target state=$state action=$action)"
Write-Host "BINDING 2 current-live -- OK (alias valtriox.com confirmed)"
Write-Host "BINDING 2 C' cross-check -- OK (GitHub $prodSha message matches)"
```

**Required:** Both CLI commands must succeed. Format, deployment ID, URL-match, target, state, alias-match are hard STOPs. C' cross-check is a hard STOP.

**C' limitation (disclosed):** verifies $prodSha exists on GitHub and message matches Vercel metadata. Does NOT prove GitHub saw Vercel's deploy. Current-live proof is exclusively from B (URL-match + alias-match).

**GH deployments deployment-level cross-check (informational):** GitHub Deployments API for this repo is stale (latest 2026-06-06, no match for 2026-09-11 production deploy). C' substituted per Reviewer approval.

**DEFERRAL (expert verbatim intent):** Actual CLI + gh invocation happens at execution window only. Fixtures under `evidence/wave6/fixture-*.json` are recon-time snapshots for test determinism -- NOT execution evidence.

**Fixtures staleness (Reviewer C2):** Fixtures represent recon-time schema (2026-10-27 UTC). Schema drift is caught at execution time, not pre-verified.

**redeploy note (Reviewer M1):** `meta.action = "redeploy"` captured as informational field, NOT asserted. Proof is SHA + alias match regardless of redeploy origin.

**SHA coincidence (Reviewer M3):** $prodSha == main SHA == base SHA is incidental. Assertions do NOT rely on any equality.

**Preview SHA is NOT Production proof.** Only a Production deployment SHA is acceptable.

Recorded:
- prod SHA: ___________
- deployment ID: ___________
- deployment URL: ___________
- target: ___________
- state: ___________
- aliases: ___________
- createdAt (epoch ms): ___________
- C' commit exists on GitHub: ___________
- C' message match: ___________
- redeploy action: ___________
- Vercel Dashboard URL / screenshot reference: ___________

**Why two bindings:** The SQL runs against the production database regardless of which app commit is currently serving production traffic. Binding 1 proves exactly which SQL and rollback scripts will be executed. Binding 2 proves what code is currently live. Neither substitutes for the other.

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
-- Include pg_read_all_data / pg_write_all_data / pg_maintain: 
-- predefined roles granting data-access or maintenance privileges
-- on Phase A tables; would silently re-expose them via inheritance
WHERE (r.rolname NOT LIKE 'pg\_%' OR r.rolname IN ('pg_read_all_data', 'pg_write_all_data', 'pg_maintain'))
  AND r.rolname NOT IN ('anon', 'authenticated')
ORDER BY r.rolname;
```

**Self-row exclusion:** `pg_has_role(X, X, ...)` returns true by PostgreSQL self-membership semantics. Rows where `target_role = 'anon'` or `target_role = 'authenticated'` are therefore excluded intentionally — they would always show true and add noise, not signal.

**Required analysis (OUTBOUND):**

For every role where `anon_can_set = true`, `auth_can_set = true`, `anon_can_use = true`, or `auth_can_use = true`, correlate:
- That role's table privileges on Phase A tables
- That role's column privileges on Phase A target columns
- Whether that path could re-expose revoked access

**Stop condition:** Any outbound SET or USAGE path from anon/authenticated to a role that holds Phase A privileges → STOP + investigate. These are orthogonal risk paths per PostgreSQL `pg_has_role` docs: `SET` = ability to `SET ROLE` to the target (requires `set_option`); `USAGE` = implicit privilege inheritance without `SET ROLE` (requires `inherit_option`). Neither implies the other. Predefined roles pg_read_all_data (SELECT on all tables), pg_write_all_data (INSERT/UPDATE/DELETE on all tables), and pg_maintain (VACUUM/ANALYZE/CLUSTER/REFRESH MATERIALIZED VIEW/REINDEX/LOCK TABLE on all relations) are explicitly included in the query above; any SET or USAGE path to any of them is a stop condition.

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

# Rule 39: use Production app SHA from Section 1.3 Binding 2 (NOT local HEAD)
$prodSha = "<PASTE_FROM_SECTION_1_3_BINDING_2_PRODUCTION_APP_SHA>"
if ($prodSha -notmatch '^[0-9a-f]{40}$') {
  throw "DEPLOYED SHA -- STOP (invalid format)"
}
git fetch origin $prodSha
if ($LASTEXITCODE -ne 0) {
  throw "DEPLOYED SHA FETCH -- STOP (commit $prodSha not reachable from origin)"
}
$grepOut = ((& git grep -n -E 'Subscription|Notification|PaymentProof|NotificationReadReceipt' $prodSha -- 'src/**/*.ts' 'src/**/*.tsx' 'src/**/*.js' 'src/**/*.jsx' 2>&1) -join "`n")
$grepExit = $LASTEXITCODE
if ($grepExit -eq 1) {
  Write-Host "DEPLOYED CODE SCAN -- OK (no references in deployed commit $prodSha)"
} elseif ($grepExit -eq 0) {
  Write-Host "DEPLOYED CODE SCAN -- REVIEW ($prodSha has client refs; confirm each is expected):"
  Write-Host $grepOut
} else {
  throw "DEPLOYED CODE SCAN -- STOP (git grep exit $grepExit)"
}

# Rule 39: both scans use the fetched Production SHA, NOT the local working tree.
# Scan 2 - committed tree of Production SHA for Phase A table names in client code.
$grep2Out = ((& git grep -n -E 'Subscription|Notification|PaymentProof|rest/v1/(Subscription|Notification|PaymentProof)' $prodSha -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' ':(exclude)**/node_modules/**' ':(exclude)**/.next/**' ':(exclude)**/dist/**' ':(exclude)**/build/**' 2>&1) -join "`n")
$grep2Exit = $LASTEXITCODE
if ($grep2Exit -eq 1) {
  Write-Host "DEPLOYED CODE SCAN 2 -- OK (no Phase A refs in deployed commit $prodSha)"
} elseif ($grep2Exit -eq 0) {
  Write-Host "DEPLOYED CODE SCAN 2 -- REVIEW ($prodSha has client refs; confirm each is expected):"
  Write-Host $grep2Out
} else {
  throw "DEPLOYED CODE SCAN 2 -- STOP (git grep exit $grep2Exit)"
}
```

Recorded classification: ___________

---

## 13. SET LOCAL Placement

```powershell
# Rule 40: use hash-verified committed artifact, NOT stale absolute path
$repoRoot = ((& git rev-parse --show-toplevel) -join "").Trim()
$containmentCmt = Join-Path $repoRoot "security\rls-audit\evidence\wave6\containment-v3-copy.sql"
$containmentExpected = "59C62F1A92510BD45889BA519957BD1F893934DF18557EFD3DAA1636B1227A3C"

if (-not (Test-Path -LiteralPath $containmentCmt)) {
  throw "COMMITTED ARTIFACT -- STOP (missing)"
}
$cmtHash = (Get-FileHash -LiteralPath $containmentCmt -Algorithm SHA256).Hash
if ($cmtHash -ne $containmentExpected) {
  throw "COMMITTED ARTIFACT -- STOP (hash mismatch: got $cmtHash)"
}
Get-Content -LiteralPath $containmentCmt | Select-String "BEGIN;|SET LOCAL|COMMIT;"
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
- Binding 1 (SQL/rollback SHA) mismatch vs Section 1.3
- Binding 2 (Production app SHA) missing or invalid vs Section 1.3
- Project ref binding NULL/unavailable (Section 2.2)
- current_user != 'postgres'
- svn < 170000
- Client fail-on-error not verified
- Deployment in progress (Section 1.4)
- Pre-state column baseline (§6.3) does not match Phase 2.1 snapshot (i.e., unexpected column privileges appeared since Phase 2)
- Any outbound SET or USAGE path from anon/authenticated to a role holding Phase A privileges (Section 8.1). Includes predefined roles pg_read_all_data, pg_write_all_data, pg_maintain (explicitly filtered in Section 8.1 query).
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