# NOLOGIN Revalidation Checklist (v4)

**File:** phase10-corrections/nologin-revalidation-checklist-v4.md  
**Status:** CHECKLIST DESIGN UPDATED — EXECUTION EVIDENCE PENDING  
**Supersedes:** nologin-revalidation-checklist-v3.md  
**Corrections:** All 9 NOLOGIN P0 blockers from Phase 9 review  
**Date:** 2026-10-12

---

## 0. Evidence Discipline

Every section records:
- SQL/command definition (as designed)
- Actual output (from PG17 disposable test, then production at execution time)
- Sanitized per discipline below

Blanks in the template are execution-evidence fields, NOT placeholders.

**Status of this document:** The checklist DESIGN is updated. It is **NOT "10 gaps closed"** — the gaps are closed structurally. **Execution evidence is pending** (to be filled after PG17 dry-run + production execution window).

---

## 0.1 Scope Boundary

**NOLOGIN action authorized by this checklist: `ALTER ROLE valtriox_evidence_ro NOLOGIN` on the single role `valtriox_evidence_ro` only.**

Explicitly NOT authorized or implied by this checklist:
- NOLOGIN on any other role
- Password reset (`ALTER ROLE ... PASSWORD`)
- Membership revoke (`REVOKE ... FROM ...`)
- Session termination (`pg_terminate_backend`, `pg_cancel_backend`, or similar)
- DROP ROLE / DROP USER / DROP-owned-objects

Unknown password does not authorize password reset (credential custody verification is a pre-execution condition, not a permission grant). Approval for NOLOGIN does not extend to any of the above; each requires its own written approval.

---

## 1. Corrected Wording — pg_stat_activity Limitation (Blocker 1)

**NOLOGIN disables new direct logins only.** It does NOT:
- Terminate existing sessions
- Remove privileges (direct or inherited)
- Remove memberships
- Remove SET ROLE paths from member roles

**pg_stat_activity.usename semantics (corrected):**
- `pg_stat_activity.usename` reflects the **connection-time logged-in user**, not the current `SET ROLE` state.
- `SET ROLE` changes `current_user` / `current_role` within the session, but **does not change `pg_stat_activity.usename`**.
- Therefore:
  - `pg_stat_activity` can detect **direct-login sessions** for a role.
  - `pg_stat_activity` **cannot reliably detect present `SET ROLE` usage** from another login role.
- Membership graph (`pg_auth_members`, `pg_has_role`) proves **capability** for SET ROLE, but not **actual present use**.
- Both capability and connection-time evidence must be reported with this limitation stated honestly.

---

## 2. Production Target Identity + Project Ref Binding

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

**Project-ref binding (choose one):**
- SQL Editor: screenshot of dashboard showing project name + ref in URL bar
- psql: sanitized `\conninfo` output (hostname contains `wqwsagnxkamblnefhpzx`)
- DSN hostname (sanitized; password redacted)

NULL/unavailable → STOP.

Recorded:
- db: ___________
- current_user: ___________
- session_user: ___________
- current_role: ___________
- svn: ___________
- utc_now: ___________
- Project-ref binding (path + evidence ref): ___________

---

## 3. Named Executor + Approved Execution Window (Blocker 8)

**Corrected from equality to range:** The runbook does NOT require the execution timestamp to equal the pre-recorded JIT timestamp (time naturally advances). Instead, execution must fall within an **approved time window**.

- Named executor: ___________
- Execution client: ___________
- Client fail-on-error verified: ___________
- **Approved execution window (UTC start–end):** ___________
- Window approved by (name + reference): ___________
- Actual execution timestamp (filled at run time, must fall within window): ___________
- If actual timestamp outside window → STOP + re-approval required.

---

## 4. Credential Custody Attestation (Blocker 4 — no values)

**No credential values captured or transmitted.**

### 4.1 Local State Verification (output discipline — no line content)

```powershell
# Check for any local file containing the role name
$matches = Get-ChildItem -Path "C:\Users\Aashir\Projects" -Recurse -File `
  -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next|\.git' } |
  Select-String -Pattern "valtriox_evidence_ro" -List

Write-Host "Files matching role name: $($matches.Count)"
$matches | ForEach-Object { Write-Host "  - $($_.Path)" }
```

**Output discipline:** Print only file paths + count. **NEVER** print line content. If a match occurs in a potentially sensitive location (e.g., `.env`), record path only, then STOP and investigate manually without printing content.

Recorded:
- Files matching role name: ___________
- Sensitive-path match (yes/no): ___________

### 4.2 Authorized Custodian Attestation

The project owner or authorized custodian must provide a written attestation confirming (without disclosing values):

- [ ] Custodian is aware of the `valtriox_evidence_ro` password existence
- [ ] Custodian confirms whether they currently hold or have held the credential
- [ ] Credential is not currently used by any active external system, CI, or manual workflow
- [ ] If held, storage category stated (password manager / Vercel env / not stored)
- [ ] No other party is known to hold the credential

- Attestation recorded by (name + role): ___________
- Attestation UTC timestamp: ___________
- Attestation reference (ticket / message ID): ___________

**NOLOGIN independence from custody (Phase 12F, 2026-10-26):** `ALTER ROLE
valtriox_evidence_ro NOLOGIN` requires admin access, not password
knowledge. UNKNOWN or unconfirmed custody items STOP NOLOGIN
execution (see STOP rule below). NOLOGIN does not require or
imply password reset.

**Custody strengthening (Phase 12E, 2026-10-25):**

1. **Variable-name inspection limitation:** Section 5 records secret VARIABLE NAMES only (no values). This preserves custody but is NOT sufficient to prove the role is unused. A generic secret name like DATABASE_URL may embed valtriox_evidence_ro inside its value without the role name appearing in the variable name. Whether the role is actively referenced by any external system must be attested by the authorized custodian who can inspect secret VALUES, without transmitting those values to this record.

2. **Custodian dependency assessment (required for NOLOGIN):** The authorized custodian must provide a written, non-disclosing YES/NO/UNKNOWN assessment per secret source (GitHub repo Actions, GitHub environments, GitHub org, Dependabot, Codespaces, Vercel project env, Vercel team shared, Vercel integrations, password manager, other CI) stating whether valtriox_evidence_ro is referenced as a DB username inside that source. Record against Sections 5.1-5.3 without transmitting values.

3. **Fresh Production prechecks (execution window):** Custody decision and the zero-rows dependency check (Section 8.9) must be re-verified at the execution window via fresh Production queries. A stale checklist attestation alone is not sufficient for NOLOGIN approval.

4. **Separate authorization from Phase A:** NOLOGIN is a distinct mutation and requires its own written expert approval. Phase A approval does NOT extend to NOLOGIN, and NOLOGIN approval does NOT extend to Phase A. Both are separate decisions per E6.

5. **STOP rule for UNKNOWN custody (Phase 12F, 2026-10-26):** If ANY custody item (Section 4.2 checklist or Section 5 source-by-source assessment) resolves to UNKNOWN or unconfirmed, NOLOGIN execution is BLOCKED. Do NOT proceed with a recorded gap. Only a definite YES (custodian confirms role not in active use anywhere) or a definite NO (custodian confirms role absent from every source) allows proceed. UNKNOWN = STOP. No exceptions. This supersedes any earlier language permitting proceed-with-gap.

---

## 5. Secret Dependency — Multi-Source Non-Disclosing (Blocker 5)

For each source below, record:
- Variable name
- Scope (repo/env/org/team)
- Match yes/no (does it contain the role name?)
- **NEVER** the value

### 5.1 GitHub

- GitHub repo → Settings → Secrets and variables → Actions
- GitHub repo → Settings → Environments
- GitHub org → Secrets
- Dependabot secrets
- Codespaces secrets

Recorded:
| Source | Variable name | Scope | Match yes/no |
|--------|---------------|-------|--------------|
| repo Actions | | | |
| repo env | | | |
| org | | | |
| Dependabot | | | |
| Codespaces | | | |

### 5.2 Vercel

- Vercel Dashboard → Project → Settings → Environment Variables
- Vercel Team → Shared environment variables
- Vercel → Integrations

Recorded:
| Source | Variable name | Scope | Match yes/no |
|--------|---------------|-------|--------------|
| project env | | | |
| team shared | | | |
| integrations | | | |

### 5.3 Password Manager / Other CI

- Password manager vault item names (names only)
- Other CI (CircleCI, GitLab, etc.) secret names

Recorded:
| Source | Variable name | Scope | Match yes/no |
|--------|---------------|-------|--------------|
| | | | |

**If any match = yes for a variable that contains `valtriox_evidence_ro` as a DB username → STOP + assess before NOLOGIN.**

---

## 6. 7-Day Connection History — Inconclusive Handling (Blocker 6)

### 6.1 Retention Verification

- Supabase Postgres Logs retention available: ___________ (days)
- Full 7-day window covered (yes/no): ___________
- Connection/auth events logged (yes/no): ___________

### 6.2 Control Event Observable

Confirm the log pipeline can observe a known reference event (e.g., a session opened from the SQL Editor in the current window):

- Reference event observed in logs (yes/no): ___________
- Reference event time (UTC): ___________

### 6.3 Role Search

- Search pattern: `valtriox_evidence_ro`
- Window: 7 days (or actual available retention)

Recorded:
- Matches in window: ___________
- Distinct application names (if any): ___________
- Distinct connection sources (sanitized): ___________

### 6.4 Verdict Logic

- If retention = full 7 days AND control event observable AND zero role matches → **"no use observed in window"**
- Otherwise → mark **"INCONCLUSIVE — retention or observability insufficient to prove zero use"**

Recorded verdict: ___________

### 6.5 Sanitized Log Export

- Export 7-day slice covering role matches (or "no matches within observed control range")
- Sanitize: remove raw IPs (keep network class only), remove identifiable user data, keep only: UTC timestamp, event type, role name, application_name
- Save as `nologin-log-export-<UTC>.txt`
- Attach to submission

Export reference: ___________

---

## 7. Memberships — Full with SET/INHERIT/ADMIN

### 7.1 Direct Outbound

```sql
SELECT m.member::regrole::text AS member,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.member = 'valtriox_evidence_ro'::regrole
ORDER BY granted_role;
```

Recorded: ___________

### 7.2 Direct Inbound

```sql
SELECT m.member::regrole::text AS member,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.roleid = 'valtriox_evidence_ro'::regrole
ORDER BY member;
```

Recorded: ___________

### 7.3 Transitive SET — Every Edge Must Have set_option = true

```sql
WITH RECURSIVE set_chain AS (
  SELECT m.member::regrole::text AS role_name,
         m.roleid::regrole::text AS reached_role,
         m.set_option, 1 AS depth,
         ARRAY[m.member::regrole::text] AS path
  FROM pg_auth_members m
  WHERE m.roleid = 'valtriox_evidence_ro'::regrole
    AND m.set_option = true
  UNION ALL
  SELECT m.member::regrole::text, m.roleid::regrole::text,
         m.set_option, sc.depth + 1, sc.path || m.member::regrole::text
  FROM pg_auth_members m
  JOIN set_chain sc ON m.roleid::regrole::text = sc.role_name
  WHERE m.set_option = true AND sc.depth < 5
)
SELECT role_name, reached_role, depth, path
FROM set_chain ORDER BY depth, role_name;
```

Recorded: ___________

### 7.4 Independent SET/USE Paths into the Role

```sql
SELECT r.rolname AS role_name,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') AS can_set,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'USAGE') AS can_use
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg\_%'
  AND r.rolname != 'valtriox_evidence_ro'
  AND (pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') = true
       OR pg_has_role(r.rolname, 'valtriox_evidence_ro', 'USAGE') = true)
ORDER BY r.rolname;
```

Expected: only `postgres` (and cluster admins per Supabase baseline).

Recorded: ___________

### 7.5 Rule-Out — Login Roles Using SET ROLE to Reach This Role

```sql
SELECT r.rolname AS login_role,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') AS can_set
FROM pg_roles r
WHERE r.rolcanlogin = true
  AND r.rolname NOT LIKE 'pg\_%'
  AND r.rolname != 'valtriox_evidence_ro'
ORDER BY r.rolname;
```

Recorded: ___________

---

## 8. Ownership Search — Corrected for PG17 (Blocker 2)

`pg_cast` catalog in PostgreSQL 17 does **not** have a `castowner` column. Cast dependency must be derived via source/target types and cast function owners, or comprehensively via `pg_shdepend`.

### 8.1 Relations

```sql
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_userbyid(c.relowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.2 Schemas

```sql
SELECT nspname FROM pg_namespace
WHERE pg_get_userbyid(nspowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.3 Functions / Procedures

```sql
SELECT n.nspname, p.proname, p.prokind
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_userbyid(p.proowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.4 Types

```sql
SELECT n.nspname, t.typname, t.typtype
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE pg_get_userbyid(t.typowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.5 Operators

```sql
SELECT n.nspname, o.oprname
FROM pg_operator o
JOIN pg_namespace n ON n.oid = o.oprnamespace
WHERE pg_get_userbyid(o.oprowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.6 Conversions

```sql
SELECT n.nspname, c.conname
FROM pg_conversion c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE pg_get_userbyid(c.conowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.7 Collations

```sql
SELECT n.nspname, c.collname
FROM pg_collation c
JOIN pg_namespace n ON n.oid = c.collnamespace
WHERE pg_get_userbyid(c.collowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.8 Text Search Dictionaries / Configurations

```sql
SELECT n.nspname, d.dictname AS object_name, 'dictionary' AS object_type
FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace
WHERE pg_get_userbyid(d.dictowner) = 'valtriox_evidence_ro'
UNION ALL
SELECT n.nspname, c.cfgname, 'configuration'
FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
WHERE pg_get_userbyid(c.cfgowner) = 'valtriox_evidence_ro';
```

Recorded: ___________

### 8.9 Shared Dependencies (Comprehensive, Replaces pg_cast.castowner)

```sql
SELECT classid::regclass::text AS catalog,
       objid::text AS object_id,
       objsubid::int AS sub_id,
       refclassid::regclass::text AS ref_catalog,
       refobjid::text AS ref_object_id,
       deptype
FROM pg_shdepend
WHERE refclassid = 'pg_authid'::regclass
  AND refobjid = (SELECT oid FROM pg_roles WHERE rolname = 'valtriox_evidence_ro');
```

Any rows → investigate (means some object depends on the role).

**Decision rule:** If Section 8.9 returns ANY rows referencing
`valtriox_evidence_ro` (any deptype), NOLOGIN is BLOCKED until
resolved. If Section 8.9 returns zero rows AND Section 5 finds no
active external secret, NOLOGIN may proceed (written expert approval
per E6 still required).

**Scope of Section 8.9 evidence (Phase 12E, 2026-10-25):**

`pg_shdepend` zero rows = catalog-level dependency evidence ONLY. It proves no catalog object (relation, function, type, cast, config, etc.) references the role. It does NOT prove:
- Zero live database connections by the role (that check is Section 10.2 - must be re-run at execution window)
- Zero external secret usage (that is custodian-attested per Section 4 - not catalog-visible)

For NOLOGIN approval, all three must independently clear:
1. Section 8.9 zero rows (catalog-level - re-verified at execution window)
2. Section 10.2 zero active sessions (live-connection - re-verified at execution window)
3. Custodian YES/NO/UNKNOWN assessment per Section 4.2 (external-secret - re-confirmed at execution window)

Zero rows in Section 8.9 alone is NOT sufficient evidence for NOLOGIN approval.

**STOP rule for UNKNOWN dependency (Phase 12F, 2026-10-26):** If ANY of the three items above resolves to UNKNOWN or cannot be verified in the current execution window, NOLOGIN execution is BLOCKED. Zero rows in Section 8.9 = PASS for catalog scope only. Zero sessions in Section 10.2 = PASS for live-connection scope only. Custodian YES per Section 4.2 = PASS for external-secret scope only. If ANY of the three is UNKNOWN, do NOT proceed. UNKNOWN = STOP. No exceptions.

**Same-window mandate (Phase 12F, 2026-10-26):** All three checks above MUST be captured within the SAME approved execution window. Attestations from different windows or staggered timestamps do NOT constitute a valid NOLOGIN approval. If any check cannot be re-run in the current window, NOLOGIN is BLOCKED until a new window with all three checks completes.

Recorded: ___________

**Expected: zero rows across 8.1–8.9.**

---

## 9. Functions — Corrected Filters + Output Discipline (Blocker 3)

### 9.1 Routines Referencing Role — Authoritative Query

Single authoritative query covering functions (`f`) AND procedures (`p`).
`pg_get_functiondef()` supports only `f` and `p` - it errors on
aggregates (`a`) and window functions (`w`). Aggregates and window
functions have no SQL source and cannot reference a role; they are
correctly excluded by prokind IN ('f','p').

```sql
SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       p.prokind AS kind,
       p.prosecdef,
       p.proconfig IS NOT NULL AS has_proconfig,
       pg_get_functiondef(p.oid) ~* 'valtriox_evidence_ro' AS references_role
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind IN ('f', 'p')
ORDER BY schema_name, routine_name;
```

**Output discipline:** `pg_get_functiondef()` returns full definition text.
We do NOT print definitions. Output is restricted to sanitized routine
identity (schema_name, routine_name, kind, prosecdef) + boolean
`references_role`.

**Coverage:** `f` (function) and `p` (procedure) - both covered. `a`
(aggregate) and `w` (window function) excluded because `pg_get_functiondef`
does not support them and they have no SQL source.

**Local PG17 evidence:** `evidence/wave6/nologin-routine-scan-<UTC>.log`
+ `.sha256`. Exact query output against pg17test2 (recorded below).

**Reconciliation (2026-10-24):** Prior scan's zero-procedure result
reflects pg17test2 state (no procedures existed), not a query gap.
Focused procedure test `nologin-procedure-test-<UTC>.log` verifies
Section 9.1 correctly captures `prokind='p'` rows.

Recorded (only rows where references_role = true): ___________

### 9.2 SECURITY DEFINER Functions — proconfig inspection

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig IS NOT NULL AS has_config, array_length(p.proconfig, 1) AS config_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND p.prokind = 'f'
ORDER BY schema_name, function_name;
```

Recorded: ___________

**Expected: no SECURITY DEFINER function references `valtriox_evidence_ro`.**

---

## 10. Preconditions — Immediate Pre-Mutation Role State (Blocker 7)

Run immediately before ALTER ROLE:

```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb,
       rolreplication, rolbypassrls, rolconnlimit, rolvaliduntil, rolconfig
FROM pg_roles
WHERE rolname = 'valtriox_evidence_ro';
```

Expected:
- `rolcanlogin = true`
- `rolsuper = false`
- `rolcreaterole = false`
- `rolcreatedb = false`
- `rolreplication = false`
- `rolbypassrls = false`
- `rolconnlimit`, `rolvaliduntil`, `rolconfig` recorded

Recorded: ___________

**Plus:**
- [ ] Exact expected outbound membership: `pg_read_all_data`
- [ ] Zero direct-login active sessions
- [ ] Completed custodian attestation reference: ___________

Zero direct-login sessions check:

```sql
SELECT pid, usename, application_name, state, backend_start
FROM pg_stat_activity
WHERE usename = 'valtriox_evidence_ro';
```

Expected: 0 rows. If any → STOP.

Recorded: ___________

---

## 11. Execution Runbook (Controlled Session)

### 11.1 Open Session — Confirm

```sql
SELECT current_database(), current_user, session_user, current_role,
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc_now;
```

Verify timestamp falls within **Section 3 approved execution window**.

### 11.2 Final Pre-Check — Zero Sessions

Re-run Section 10 zero-sessions check.

### 11.3 Execute

```sql
ALTER ROLE valtriox_evidence_ro NOLOGIN;
```

### 11.4 Immediately Post-Execution

```sql
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'valtriox_evidence_ro';
SELECT COUNT(*) FROM pg_roles WHERE rolname = 'valtriox_evidence_ro';
SELECT m.roleid::regrole::text AS granted_role
FROM pg_auth_members m
WHERE m.member = 'valtriox_evidence_ro'::regrole;
SELECT pid, usename, state, backend_start
FROM pg_stat_activity
WHERE usename = 'valtriox_evidence_ro';
```

Expected:
- `rolcanlogin = false`
- count = 1
- granted_role = `pg_read_all_data`
- active sessions = 0

**If any active session appears → STOP + report. No terminate. No LOGIN rollback without separate written approval.**

### 11.5 Evidence Capture

- ALTER ROLE execution UTC timestamp: ___________
- Sanitized output of Section 11.4: ___________
- Screenshot of SQL editor state: ___________

---

## 12. Break-Glass Rollback

`nologin-rollback.sql` is a **separately authorized break-glass action** because credential custody remains UNVERIFIED. Do not execute without separate written approval.

---

## 13. Status

`CHECKLIST DESIGN UPDATED`  
`EXECUTION EVIDENCE PENDING`  
**Prepared by:** Ashir Raza  
**Date:** 2026-10-12

**Note:** This checklist design closes the 9 structural gaps identified in Phase 9 review. The actual evidence fields will be populated on PG17 disposable first, then on production during the approved execution window. The claim "10 gaps closed" is not used; the correct status is "design updated; execution evidence pending".