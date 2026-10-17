-- PV Verification Queries (v6 §1-3, §6, §8, §9)
-- Run against pg17test2 AFTER containment-v3-copy.sql applied
-- Purpose: capture POST-containment state

\echo '=== PV §1 — ACL post-state (anon/auth/PUBLIC rows) ==='
SELECT c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       a.privilege_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL aclexplode(c.relacl) AS a ON TRUE
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
  AND (a.grantee = 0 OR a.grantee::regrole::text IN ('anon', 'authenticated'))
ORDER BY c.relname, grantee, a.privilege_type;
-- EXPECTED: 0 rows

\echo ''
\echo '=== PV §1 summary — ACL counts per (table, role) ==='
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
-- EXPECTED: service_role=8, postgres=8, audit_readonly=1 per table. anon/auth/PUBLIC absent.

\echo ''
\echo '=== PV §2 — 96-check matrix post-containment (per role) ==='
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
SELECT r.role_name, count(*) AS total,
       count(*) FILTER (WHERE has_table_privilege(r.role_name, 'public."' || t.tbl || '"', p.priv)) AS n_true,
       count(*) FILTER (WHERE NOT has_table_privilege(r.role_name, 'public."' || t.tbl || '"', p.priv)) AS n_false
FROM tables t CROSS JOIN roles r CROSS JOIN privs p
GROUP BY r.role_name
ORDER BY r.role_name;
-- EXPECTED post-containment: anon=0 true / 24 false; auth=0/24; service_role=24/0; postgres=24/0

\echo ''
\echo '=== PV §3.1 — Direct column grants via info_schema ==='
SELECT cp.table_name, cp.column_name, cp.grantee, cp.privilege_type
FROM information_schema.column_privileges cp
WHERE cp.table_schema = 'public'
  AND cp.table_name IN ('Subscription', 'Notification', 'PaymentProof')
  AND cp.grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY cp.table_name, cp.column_name, cp.grantee, cp.privilege_type;
-- EXPECTED: 0 rows

\echo ''
\echo '=== PV §3.3 — Effective column access (any true = FAIL) ==='
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
SELECT * FROM checks WHERE has_pr = true ORDER BY tbl, col, role_name, priv;
-- EXPECTED: 0 rows (containment successful)

\echo ''
\echo '=== PV §6 — service_role / postgres / audit_readonly unchanged ==='
SELECT 'service_role' AS role,
       has_table_privilege('service_role', 'public."Subscription"', 'SELECT') AS s,
       has_table_privilege('service_role', 'public."Notification"', 'SELECT') AS n,
       has_table_privilege('service_role', 'public."PaymentProof"', 'SELECT') AS p
UNION ALL
SELECT 'postgres',
       has_table_privilege('postgres', 'public."Subscription"', 'SELECT'),
       has_table_privilege('postgres', 'public."Notification"', 'SELECT'),
       has_table_privilege('postgres', 'public."PaymentProof"', 'SELECT')
UNION ALL
SELECT 'audit_readonly',
       has_table_privilege('audit_readonly', 'public."Subscription"', 'SELECT'),
       has_table_privilege('audit_readonly', 'public."Notification"', 'SELECT'),
       has_table_privilege('audit_readonly', 'public."PaymentProof"', 'SELECT');
-- EXPECTED: all true (containment does not touch these roles)

\echo ''
\echo '=== PV §8 — Row counts (unchanged) ==='
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";
-- EXPECTED: 2 / 21 / 0 (unchanged)

\echo ''
\echo '=== PV §9 — RLS state unchanged ==='
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;
-- EXPECTED: relrowsecurity=t, relforcerowsecurity=f, owner=postgres

\echo ''
\echo '=== PV verification COMPLETE ==='