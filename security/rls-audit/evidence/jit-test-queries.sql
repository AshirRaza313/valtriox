-- ============================================================
-- JIT-queries test file — for PG17 disposable execution
-- Source: jit-checklist-v5.md (SQL-executable sections)
-- Non-executable sections (PowerShell/manual/dashboard) skipped
-- ============================================================

\echo ''
\echo '===== JIT §2.1 — session identity ====='
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
\echo '===== JIT §2.3 — trusted database fingerprint ====='
SELECT current_setting('data_directory', true) AS data_directory,
       current_setting('ssl_library', true) AS ssl_library,
       current_setting('TimeZone', true) AS tz;

\echo ''
\echo '===== JIT §3 — row counts ====='
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";

\echo ''
\echo '===== JIT §4 — RLS state ====='
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;

\echo ''
\echo '===== JIT §5 — table-level ACL ====='
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

\echo ''
\echo '===== JIT §6.1 — direct column grants via information_schema ====='
SELECT cp.table_name,
       cp.column_name,
       cp.grantee,
       cp.privilege_type
FROM information_schema.column_privileges cp
WHERE cp.table_schema = 'public'
  AND cp.table_name IN ('Subscription', 'Notification', 'PaymentProof')
  AND cp.grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY cp.table_name, cp.column_name, cp.grantee, cp.privilege_type;

\echo ''
\echo '===== JIT §6.2 — direct column grants via pg_attribute ACL ====='
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

\echo ''
\echo '===== JIT §6.3 — effective column access per column x per role ====='
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
SELECT * FROM checks ORDER BY tbl, col, role_name, priv;

\echo ''
\echo '===== JIT §7 — table effective privileges 96-check matrix ====='
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

\echo ''
\echo '===== JIT §8.1 — role-path direction (what can anon/auth SET/USE) ====='
SELECT r.rolname AS target_role,
       pg_has_role('anon', r.rolname, 'SET') AS anon_can_set,
       pg_has_role('anon', r.rolname, 'USAGE') AS anon_can_use,
       pg_has_role('authenticated', r.rolname, 'SET') AS auth_can_set,
       pg_has_role('authenticated', r.rolname, 'USAGE') AS auth_can_use
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg\_%'
ORDER BY r.rolname;

\echo ''
\echo '===== JIT §8.2 — direct outbound memberships of anon/authenticated ====='
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.member::regrole::text IN ('anon', 'authenticated')
ORDER BY member_role, granted_role;

\echo ''
\echo '===== JIT §8.3 — direct inbound memberships into anon/authenticated ====='
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.roleid::regrole::text IN ('anon', 'authenticated')
ORDER BY granted_role, member_role;

\echo ''
\echo '===== JIT §9 — bypass roles ====='
SELECT rolname, rolsuper, rolinherit, rolbypassrls,
       rolcanlogin, rolcreaterole, rolcreatedb, rolreplication
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'audit_readonly', 'valtriox_evidence_ro')
ORDER BY rolname;

\echo ''
\echo '===== JIT §10 — policies on Phase A tables ====='
SELECT schemaname, tablename, policyname, roles::text, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY tablename, policyname;

\echo ''
\echo '===== JIT §11.1 — schemas exposed via PostgREST ====='
SELECT nspname AS schema_name,
       nspacl::text AS schema_acl,
       pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
WHERE nspname NOT LIKE 'pg\_%'
  AND nspname NOT IN ('information_schema')
ORDER BY nspname;

\echo ''
\echo '===== JIT §11.2 — views in ALL schemas referencing Phase A tables ====='
SELECT schemaname, viewname, viewowner, definition
FROM pg_views
WHERE definition ~* 'Subscription|Notification|PaymentProof'
ORDER BY schemaname, viewname;

\echo ''
\echo '===== JIT §11.3 — matviews in all schemas ====='
SELECT schemaname, matviewname, matviewowner, definition
FROM pg_matviews
WHERE definition ~* 'Subscription|Notification|PaymentProof'
ORDER BY schemaname, matviewname;

\echo ''
\echo '===== JIT §11.4 — SECURITY DEFINER functions in all schemas ====='
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND p.prosecdef = true
  AND pg_get_functiondef(p.oid) ~* 'Subscription|Notification|PaymentProof'
ORDER BY schema_name, function_name;

\echo ''
\echo '===== JIT §11.5 — effective EXECUTE on any function referencing Phase A tables ====='
WITH refs AS (
  SELECT p.oid, n.nspname AS schema_name, p.proname AS function_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~* 'Subscription|Notification|PaymentProof'
)
SELECT schema_name, function_name,
       has_function_privilege('anon', refs.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', refs.oid, 'EXECUTE') AS auth_exec
FROM refs
ORDER BY schema_name, function_name;

\echo ''
\echo '===== JIT §14 — rollback comparison (pre-state) ====='
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
  AND (a.grantee = 0 OR a.grantee::regrole::text IN ('anon', 'authenticated'))
ORDER BY c.relname, grantee, a.privilege_type;

\echo ''
\echo '===== JIT TEST COMPLETE ====='