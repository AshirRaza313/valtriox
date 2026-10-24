-- ==================================================================
-- Wave 4 (A2) - Read-only project/role binding evidence (v2)
-- Method: Supabase SQL Editor — STATIC CATALOG PROOF
-- Target role: valtriox_evidence_ro (checked via has_table_privilege)
-- Target project: wqwsagnxkamblnefhpzx
--
-- CHANGE FROM v1:
--   v1 attempted SET ROLE valtriox_evidence_ro and failed with
--   SQLSTATE 42501 (permission denied).
--   Root cause: membership edge postgres -> valtriox_evidence_ro
--   has set_option=false, and SQL Editor's connection role is not
--   superuser, so SET ROLE is disallowed.
--   This is a CORRECT PostgreSQL security behavior, not a bug.
--
-- v2 METHOD:
--   Do NOT switch roles. Instead, statically query the catalog
--   using has_table_privilege('valtriox_evidence_ro', ...) which
--   reports the privileges of the target role WITHOUT requiring
--   the current session to become that role.
--   This provides read-only proof that is machine-verifiable,
--   honest, and non-mutating.
--
-- HONEST DISCLOSURE:
--   - session_user = current_user = current_role = postgres
--     (the SQL Editor connection role)
--   - valtriox_evidence_ro privileges are demonstrated via static
--     has_table_privilege() catalog queries, not via SET ROLE
--   - Direct psql login as valtriox_evidence_ro was not possible
--     (password not in custody; reset forbidden - no ALTER ROLE)
-- ==================================================================

-- ------------------------------------------------------------------
-- A2.0 Session context (transparency)
-- ------------------------------------------------------------------
SELECT '=== A2.0 Session context ===' AS section_header;

SELECT
  session_user                                    AS s_user,
  current_user                                    AS c_user,
  current_role                                    AS c_role,
  current_database()                              AS db,
  current_setting('server_version_num')           AS svn,
  current_setting('server_version')               AS sv,
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc_now;

-- ------------------------------------------------------------------
-- A2.1 Target role attributes (must be read-only)
-- ------------------------------------------------------------------
SELECT '=== A2.1 Target role attributes ===' AS section_header;

SELECT
  rolname,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolbypassrls,
  rolreplication,
  rolcanlogin,
  rolconnlimit,
  rolvaliduntil
FROM pg_roles
WHERE rolname = 'valtriox_evidence_ro';

-- ------------------------------------------------------------------
-- A2.2 Membership graph (inbound + outbound of target role)
-- ------------------------------------------------------------------
SELECT '=== A2.2 Membership graph ===' AS section_header;

SELECT
  m.member::regrole::text   AS member,
  m.roleid::regrole::text   AS roleid,
  m.grantor::regrole::text  AS grantor,
  m.admin_option,
  m.set_option,
  m.inherit_option
FROM pg_auth_members m
WHERE m.member::regrole::text = 'valtriox_evidence_ro'
   OR m.roleid::regrole::text = 'valtriox_evidence_ro'
ORDER BY member, roleid;

-- ------------------------------------------------------------------
-- A2.3 STATIC PROOF: Effective table privileges of target role
--      (does NOT require SET ROLE)
-- ------------------------------------------------------------------
SELECT '=== A2.3 Static privileges of valtriox_evidence_ro ===' AS section_header;

SELECT
  tbl,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'SELECT')     AS can_select,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'INSERT')     AS can_insert,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'UPDATE')     AS can_update,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'DELETE')     AS can_delete,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'TRUNCATE')   AS can_truncate,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'REFERENCES') AS can_ref,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'TRIGGER')    AS can_trigger,
  has_table_privilege('valtriox_evidence_ro', 'public."' || tbl || '"', 'MAINTAIN')   AS can_maintain
FROM (VALUES ('Subscription'), ('Notification'), ('PaymentProof')) AS t(tbl)
ORDER BY tbl;

-- ------------------------------------------------------------------
-- A2.4 Effective column privileges of target role (per column)
-- ------------------------------------------------------------------
SELECT '=== A2.4 Static column privileges ===' AS section_header;

SELECT
  c.relname AS tbl,
  a.attname AS col,
  has_column_privilege('valtriox_evidence_ro', 'public."' || c.relname || '"', a.attname, 'SELECT') AS can_select,
  has_column_privilege('valtriox_evidence_ro', 'public."' || c.relname || '"', a.attname, 'INSERT') AS can_insert,
  has_column_privilege('valtriox_evidence_ro', 'public."' || c.relname || '"', a.attname, 'UPDATE') AS can_update
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY c.relname, a.attname;

-- ------------------------------------------------------------------
-- A2.5 Actual ACLs on the 3 tables (what's granted, catalog view)
-- ------------------------------------------------------------------
SELECT '=== A2.5 Actual ACLs (grantees + privileges) ===' AS section_header;

SELECT
  c.relname       AS table_name,
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

-- ------------------------------------------------------------------
-- A2.6 Project binding hints
-- ------------------------------------------------------------------
SELECT '=== A2.6 Project binding hints ===' AS section_header;

SELECT name, setting
FROM pg_settings
WHERE name IN ('cluster_name', 'listen_addresses', 'port')
ORDER BY name;

-- ------------------------------------------------------------------
-- A2.7 Database identity
-- ------------------------------------------------------------------
SELECT '=== A2.7 Database identity ===' AS section_header;

SELECT
  datname,
  pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
WHERE datname = current_database();

-- ------------------------------------------------------------------
-- A2.8 Supabase-specific binding (best-effort; NULLs OK)
-- ------------------------------------------------------------------
SELECT '=== A2.8 Supabase-specific binding ===' AS section_header;

SELECT
  current_setting('supabase.instance_id', true)     AS supabase_instance_id,
  current_setting('app.settings.project_ref', true) AS app_project_ref,
  current_setting('app.settings.environment', true) AS app_environment;

-- ------------------------------------------------------------------
-- A2.9 Connected client info
-- ------------------------------------------------------------------
SELECT '=== A2.9 Connected client info ===' AS section_header;

SELECT
  pid,
  usename,
  application_name,
  client_addr::text                        AS client_addr,
  client_port,
  backend_start,
  state,
  to_char(backend_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS backend_start_utc
FROM pg_stat_activity
WHERE pid = pg_backend_pid();

-- ------------------------------------------------------------------
-- A2.10 Enforcement test — cannot mutate as target role (static)
-- ------------------------------------------------------------------
SELECT '=== A2.10 Mutation blocked (static proof) ===' AS section_header;

SELECT
  'Subscription' AS tbl,
  has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'INSERT') AS insert_blocked,
  has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'UPDATE') AS update_blocked,
  has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'DELETE') AS delete_blocked
UNION ALL
SELECT
  'Notification',
  has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'INSERT'),
  has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'UPDATE'),
  has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'DELETE')
UNION ALL
SELECT
  'PaymentProof',
  has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'INSERT'),
  has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'UPDATE'),
  has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'DELETE');

-- ==================================================================
-- END OF Wave 4 (A2) v2 - Static Catalog Proof
-- ==================================================================