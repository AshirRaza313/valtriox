-- ==================================================================
-- STATUS: PARTIALLY HISTORICAL (as of 2026-10-25, Phase 12E)
-- ==================================================================
-- This file retains queries originally executed as part of the
-- nologin-routine-scan-2026-10-22 evidence generation. Sections
-- 7 (membership), 8 (ownership), and 10 (pre-mutation role state)
-- remain authoritative and are safe to execute on disposable PG17
-- or as part of execution-window prechecks.
--
-- Sections 9.1 and 9.2 in THIS FILE ARE SUPERSEDED:
--   9.1 in this file filters prokind = 'f' (functions only).
--        The authoritative replacement is in
--        nologin-revalidation-checklist-v4.md Section 9.1, which
--        covers prokind IN ('f','p') and outputs a sanitized
--        has_proconfig boolean instead of raw proconfig.
--   9.2 in this file outputs raw p.proconfig AS config.
--        The authoritative replacement is in
--        nologin-revalidation-checklist-v4.md Section 9.2, which
--        outputs has_config + config_count, no raw values.
--
-- Do NOT execute Sections 9.1 or 9.2 from THIS FILE for Production
-- or JIT evidence. Use the checklist versions above.
--
-- Historical scan evidence generated FROM THIS FILE'S QUERIES at
-- scan time (2026-10-22), BEFORE this historical header was
-- prepended:
--   evidence/wave6/nologin-routine-scan-2026-10-22T19-06-25Z.log
--   (superseded for procedure coverage by
--    evidence/wave6/nologin-procedure-test-2026-10-24T11-51-00Z.log)
-- ==================================================================

\echo '=== NL §2: Production target identity ==='
SELECT current_database() AS db,
       current_user,
       session_user,
       current_role,
       inet_server_addr() AS server_ip,
       inet_server_port() AS server_port,
       current_setting('server_version_num') AS svn,
       current_setting('server_version') AS sv,
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc_now;

\echo ''
\echo '=== NL §7.1: Direct outbound memberships ==='
SELECT m.member::regrole::text AS member,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.member = 'valtriox_evidence_ro'::regrole
ORDER BY granted_role;

\echo ''
\echo '=== NL §7.2: Direct inbound memberships ==='
SELECT m.member::regrole::text AS member,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.roleid = 'valtriox_evidence_ro'::regrole
ORDER BY member;

\echo ''
\echo '=== NL §7.3: Transitive SET ==='
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

\echo ''
\echo '=== NL §7.4: Independent SET/USE paths ==='
SELECT r.rolname AS role_name,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') AS can_set,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'USAGE') AS can_use
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg\_%'
  AND r.rolname != 'valtriox_evidence_ro'
  AND (pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') = true
       OR pg_has_role(r.rolname, 'valtriox_evidence_ro', 'USAGE') = true)
ORDER BY r.rolname;

\echo ''
\echo '=== NL §7.5: Login roles with SET ==='
SELECT r.rolname AS login_role,
       pg_has_role(r.rolname, 'valtriox_evidence_ro', 'SET') AS can_set
FROM pg_roles r
WHERE r.rolcanlogin = true
  AND r.rolname NOT LIKE 'pg\_%'
  AND r.rolname != 'valtriox_evidence_ro'
ORDER BY r.rolname;

\echo ''
\echo '=== NL §8.1: Relations owned ==='
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_userbyid(c.relowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.2: Schemas owned ==='
SELECT nspname FROM pg_namespace
WHERE pg_get_userbyid(nspowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.3: Functions owned ==='
SELECT n.nspname, p.proname, p.prokind
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_userbyid(p.proowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.4: Types owned ==='
SELECT n.nspname, t.typname, t.typtype
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE pg_get_userbyid(t.typowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.5: Operators owned ==='
SELECT n.nspname, o.oprname
FROM pg_operator o JOIN pg_namespace n ON n.oid = o.oprnamespace
WHERE pg_get_userbyid(o.oprowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.6: Conversions owned ==='
SELECT n.nspname, c.conname
FROM pg_conversion c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE pg_get_userbyid(c.conowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.7: Collations owned ==='
SELECT n.nspname, c.collname
FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace
WHERE pg_get_userbyid(c.collowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.8: Text search dicts/configs ==='
SELECT n.nspname, d.dictname AS object_name, 'dictionary' AS object_type
FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace
WHERE pg_get_userbyid(d.dictowner) = 'valtriox_evidence_ro'
UNION ALL
SELECT n.nspname, c.cfgname, 'configuration'
FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
WHERE pg_get_userbyid(c.cfgowner) = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §8.9: Shared dependencies (replaces pg_cast.castowner) ==='
SELECT classid::regclass::text AS catalog,
       objid::text AS object_id,
       objsubid::int AS sub_id,
       refclassid::regclass::text AS ref_catalog,
       refobjid::text AS ref_object_id,
       deptype
FROM pg_shdepend
WHERE refclassid = 'pg_authid'::regclass
  AND refobjid = (SELECT oid FROM pg_roles WHERE rolname = 'valtriox_evidence_ro');

\echo ''
\echo '=== NL §9.1: Functions referencing role (prokind=f) ==='
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       p.prokind AS kind,
       (p.prokind IN ('f','p')
         AND pg_get_functiondef(p.oid) ~* 'valtriox_evidence_ro') AS references_role
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
ORDER BY schema_name, function_name;

\echo ''
\echo '=== NL §9.2: SECURITY DEFINER functions ==='
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS config
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true AND p.prokind = 'f'
ORDER BY schema_name, function_name;

\echo ''
\echo '=== NL §10: Pre-mutation role state ==='
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb,
       rolreplication, rolbypassrls, rolconnlimit, rolvaliduntil, rolconfig
FROM pg_roles WHERE rolname = 'valtriox_evidence_ro';

\echo ''
\echo '=== NL §10: Zero active sessions check ==='
SELECT pid, usename, application_name, state, backend_start
FROM pg_stat_activity
WHERE usename = 'valtriox_evidence_ro';