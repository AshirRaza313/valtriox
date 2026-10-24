-- JIT Baseline Queries (v6 §3-11 subset for local fixture)
-- Run against pg17test2 AFTER fixtures-v2-copy.sql load
-- Purpose: capture PRE-containment baseline state
-- Note: §1/2 (env checks), §12 (SHA scan), §13 (SQL inspection), §14 (rollback) skipped — not applicable to local fixture

\echo '=== JIT §3 — Row Counts (informational) ==='
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";
-- EXPECTED: 2 / 21 / 0

\echo ''
\echo '=== JIT §4 — RLS State ==='
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;
-- EXPECTED: relrowsecurity=t, relforcerowsecurity=f, owner=postgres for all 3

\echo ''
\echo '=== JIT §5 — Table ACL summary (count per table, role) ==='
SELECT c.relname AS tbl,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       count(*) AS priv_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL aclexplode(c.relacl) AS a ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
GROUP BY c.relname, a.grantee
ORDER BY c.relname, 2;
-- EXPECTED: 15 rows — anon=8, authenticated=8, service_role=8, postgres=8, audit_readonly=1 per table

\echo ''
\echo '=== JIT §6.1 — Column privileges via info_schema (summary) ==='
SELECT cp.table_name, cp.grantee, cp.privilege_type, count(*) AS n_cols
FROM information_schema.column_privileges cp
WHERE cp.table_schema = 'public'
  AND cp.table_name IN ('Subscription', 'Notification', 'PaymentProof')
  AND cp.grantee IN ('anon', 'authenticated', 'PUBLIC')
GROUP BY cp.table_name, cp.grantee, cp.privilege_type
ORDER BY cp.table_name, cp.grantee, cp.privilege_type;
-- EXPECTED pre-containment: many rows (anon/auth table grants inherited to columns)

\echo ''
\echo '=== JIT §6.2 — Direct column grants via pg_attribute ACL ==='
SELECT c.relname AS table_name, a.attname AS column_name,
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
-- EXPECTED: 0 rows (no explicit column-level grants, only table-level)

\echo ''
\echo '=== JIT §6.3 — Effective column access (summary per role × priv) ==='
WITH cols AS (
  SELECT c.relname AS tbl, a.attname AS col
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
),
checks AS (
  SELECT tbl, col, 'anon' AS role_name, 'SELECT' AS priv, has_column_privilege('anon', 'public."' || tbl || '"', col, 'SELECT') AS has_pr FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'INSERT', has_column_privilege('anon', 'public."' || tbl || '"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'UPDATE', has_column_privilege('anon', 'public."' || tbl || '"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'anon', 'REFERENCES', has_column_privilege('anon', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'SELECT', has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'SELECT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'INSERT', has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'INSERT') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'UPDATE', has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'UPDATE') FROM cols
  UNION ALL SELECT tbl, col, 'authenticated', 'REFERENCES', has_column_privilege('authenticated', 'public."' || tbl || '"', col, 'REFERENCES') FROM cols
)
SELECT role_name, priv,
       count(*) FILTER (WHERE has_pr) AS n_true,
       count(*) FILTER (WHERE NOT has_pr) AS n_false
FROM checks
GROUP BY role_name, priv
ORDER BY role_name, priv;
-- EXPECTED pre-containment: anon/auth SELECT n_true>0 (access via table grants). Other privs also true.

\echo ''
\echo '=== JIT §7 — 96-check matrix (per role summary) ==='
WITH tables AS (
  SELECT 'Subscription' AS tbl UNION ALL SELECT 'Notification' UNION ALL SELECT 'PaymentProof'
),
roles AS (
  SELECT 'anon' AS role_name UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'postgres'
),
privs AS (
  SELECT 'SELECT' AS priv UNION ALL SELECT 'INSERT' UNION ALL SELECT 'UPDATE' UNION ALL SELECT 'DELETE'
  UNION ALL SELECT 'TRUNCATE' UNION ALL SELECT 'REFERENCES' UNION ALL SELECT 'TRIGGER' UNION ALL SELECT 'MAINTAIN'
)
SELECT r.role_name,
       count(*) AS total,
       count(*) FILTER (WHERE has_table_privilege(r.role_name, 'public."' || t.tbl || '"', p.priv)) AS n_true,
       count(*) FILTER (WHERE NOT has_table_privilege(r.role_name, 'public."' || t.tbl || '"', p.priv)) AS n_false
FROM tables t CROSS JOIN roles r CROSS JOIN privs p
GROUP BY r.role_name
ORDER BY r.role_name;
-- EXPECTED pre-containment: anon=24 true / 0 false; auth=24/0; service_role=24/0; postgres=24/0

\echo ''
\echo '=== JIT §8.1 — Outbound role paths from anon/authenticated (self-row excluded) ==='
SELECT r.rolname AS target_role,
       pg_has_role('anon', r.rolname, 'SET') AS anon_can_set,
       pg_has_role('authenticated', r.rolname, 'SET') AS auth_can_set
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg\_%'
  AND r.rolname NOT IN ('anon', 'authenticated')
  AND (pg_has_role('anon', r.rolname, 'SET') OR pg_has_role('authenticated', r.rolname, 'SET'))
ORDER BY r.rolname;
-- EXPECTED: 0 rows (no unexpected outbound SET paths)

\echo ''
\echo '=== JIT §8.2 — Outbound memberships of anon/authenticated ==='
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.member::regrole::text IN ('anon', 'authenticated')
ORDER BY member_role, granted_role;
-- EXPECTED: 0 rows

\echo ''
\echo '=== JIT §8.3 — Inbound memberships into anon/authenticated ==='
SELECT m.member::regrole::text AS member_role,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.set_option, m.inherit_option
FROM pg_auth_members m
WHERE m.roleid::regrole::text IN ('anon', 'authenticated')
ORDER BY granted_role, member_role;
-- EXPECTED: postgres → anon, postgres → authenticated (from fixture)

\echo ''
\echo '=== JIT §9 — Bypass roles ==='
SELECT rolname, rolsuper, rolinherit, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb, rolreplication
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'audit_readonly', 'valtriox_evidence_ro')
ORDER BY rolname;
-- EXPECTED: anon/auth rolsuper=f rolbypassrls=f

\echo ''
\echo '=== JIT §10 — Policies on Phase A tables ==='
SELECT schemaname, tablename, policyname, roles::text, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY tablename, policyname;
-- EXPECTED: anon_read + service_role_all per table (6 policies)

\echo ''
\echo '=== JIT §11.2/11.3 — Views/Matviews with Phase A table refs (schema filter + word boundary) ==='
SELECT 'view' AS kind, schemaname, viewname AS name FROM pg_views
WHERE definition ~* '\m(Subscription|Notification|PaymentProof)\M'
  AND schemaname NOT LIKE 'pg\_%' AND schemaname <> 'information_schema'
UNION ALL
SELECT 'matview', schemaname, matviewname FROM pg_matviews
WHERE definition ~* '\m(Subscription|Notification|PaymentProof)\M'
  AND schemaname NOT LIKE 'pg\_%' AND schemaname <> 'information_schema';
-- EXPECTED: 0 rows

\echo ''
\echo '=== JIT §11.4 — SECURITY DEFINER functions/procedures (schema filter + word boundary) ==='
SELECT n.nspname AS schema_name, p.proname, p.prokind
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind IN ('f', 'p')
  AND p.prosecdef = true
  AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
  AND pg_get_functiondef(p.oid) ~* '\m(Subscription|Notification|PaymentProof)\M'
ORDER BY schema_name, proname;
-- EXPECTED: 0 rows

\echo ''
\echo '=== JIT baseline COMPLETE ==='