\echo '=== PV §1: ACL Post-State ==='
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

\echo ''
\echo '=== PV §2: Table-Level 96-Check Matrix ==='
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
\echo '=== PV §3.1: Column Grants (information_schema) ==='
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
\echo '=== PV §3.2: Column Grants (pg_attribute ACL) ==='
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
\echo '=== PV §6.1: service_role effective privileges ==='
SELECT has_table_privilege('service_role', 'public."Subscription"', 'SELECT') AS sr_sub,
       has_table_privilege('service_role', 'public."Notification"', 'SELECT') AS sr_notif,
       has_table_privilege('service_role', 'public."PaymentProof"', 'SELECT') AS sr_pay;

\echo ''
\echo '=== PV §6.2: postgres effective privileges ==='
SELECT has_table_privilege('postgres', 'public."Subscription"', 'SELECT') AS pg_sub,
       has_table_privilege('postgres', 'public."Notification"', 'SELECT') AS pg_notif,
       has_table_privilege('postgres', 'public."PaymentProof"', 'SELECT') AS pg_pay;

\echo ''
\echo '=== PV §6.3: audit_readonly all 3 tables ==='
SELECT has_table_privilege('audit_readonly', 'public."Subscription"', 'SELECT') AS ar_sub,
       has_table_privilege('audit_readonly', 'public."Notification"', 'SELECT') AS ar_notif,
       has_table_privilege('audit_readonly', 'public."PaymentProof"', 'SELECT') AS ar_pay;

\echo ''
\echo '=== PV §8: Row Counts ==='
SELECT 'Subscription' AS tbl, COUNT(*) AS cnt FROM public."Subscription"
UNION ALL SELECT 'Notification', COUNT(*) FROM public."Notification"
UNION ALL SELECT 'PaymentProof', COUNT(*) FROM public."PaymentProof";

\echo ''
\echo '=== PV §9: RLS State ==='
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname;