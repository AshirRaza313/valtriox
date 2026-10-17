-- ==================================================================
-- Wave 4 (A2) - Read-only project/role binding evidence
-- Method: Supabase SQL Editor + SET ROLE fallback
-- Target role: valtriox_evidence_ro
-- Target project: wqwsagnxkamblnefhpzx
-- Session origin: Supabase SQL Editor (connection role = postgres)
--
-- HONEST DISCLOSURE:
--   SQL Editor always connects as the `postgres` superuser. The
--   read-only role binding is demonstrated via SET ROLE, which
--   changes `current_user` to `valtriox_evidence_ro` for all
--   subsequent statements in this session.
--   - session_user: remains `postgres` (connection-time identity)
--   - current_user: becomes `valtriox_evidence_ro` (all privilege
--     checks evaluate against this)
--   - current_role: becomes `valtriox_evidence_ro`
--   Direct psql login would give session_user = current_user =
--   role (cleaner binding). Password not available in custody;
--   reset forbidden per expert rule (no ALTER ROLE).
--
-- EXECUTION: Run entire script in one "Run" click. SET ROLE
-- applies session-scoped; do not split into multiple runs.
-- ==================================================================

-- ------------------------------------------------------------------
-- A2.0 Pre-SET-ROLE context (transparency)
-- ------------------------------------------------------------------
SELECT '=== A2.0 Pre-SET-ROLE context ===' AS section_header;

SELECT
  session_user AS session_user_at_connection,
  current_user AS current_user_before_set_role,
  current_role AS current_role_before_set_role;

-- ------------------------------------------------------------------
-- A2.0b Apply SET ROLE
-- ------------------------------------------------------------------
SET ROLE valtriox_evidence_ro;

-- ------------------------------------------------------------------
-- A2.0c Post-SET-ROLE confirmation
-- ------------------------------------------------------------------
SELECT '=== A2.0c Post-SET-ROLE confirmation ===' AS section_header;

SELECT
  session_user AS session_user_still_postgres,
  current_user AS current_user_now_readonly,
  current_role AS current_role_now_readonly;

-- ------------------------------------------------------------------
-- A2.1 Session identity
-- ------------------------------------------------------------------
SELECT '=== A2.1 Session identity ===' AS section_header;

SELECT
  current_database()                              AS db,
  current_user                                    AS c_user,
  session_user                                    AS s_user,
  current_role                                    AS c_role,
  inet_server_addr()::text                        AS server_ip,
  inet_server_port()                              AS server_port,
  current_setting('server_version_num')           AS svn,
  current_setting('server_version')               AS sv,
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc_now;

-- ------------------------------------------------------------------
-- A2.2 Role attributes (must be read-only)
-- ------------------------------------------------------------------
SELECT '=== A2.2 Role attributes ===' AS section_header;

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
-- A2.3 Membership (outbound + inbound for this role)
-- ------------------------------------------------------------------
SELECT '=== A2.3 Membership ===' AS section_header;

SELECT
  m.member::regrole::text   AS member,
  m.roleid::regrole::text   AS roleid,
  m.grantor::regrole::text  AS grantor,
  m.admin_option,
  m.set_option,
  m.inherit_option
FROM pg_auth_members m
WHERE m.member::regrole::text IN ('valtriox_evidence_ro', 'postgres', 'pg_read_all_data')
   OR m.roleid::regrole::text IN ('valtriox_evidence_ro', 'postgres', 'pg_read_all_data')
ORDER BY member, roleid;

-- ------------------------------------------------------------------
-- A2.4 Effective table privileges (read-only proof, no mutation attempt)
-- ------------------------------------------------------------------
SELECT '=== A2.4 Effective table privileges ===' AS section_header;

SELECT
  t.schemaname,
  t.tablename,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'SELECT')     AS can_select,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'INSERT')     AS can_insert,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'UPDATE')     AS can_update,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'DELETE')     AS can_delete,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'TRUNCATE')   AS can_truncate,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'REFERENCES') AS can_ref,
  has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'TRIGGER')    AS can_trigger
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN ('Subscription', 'Notification', 'PaymentProof')
ORDER BY t.tablename;

-- ------------------------------------------------------------------
-- A2.5 Actual ACLs on the 3 tables (filtered to this role + PUBLIC)
-- ------------------------------------------------------------------
SELECT '=== A2.5 Actual ACLs on the 3 target tables ===' AS section_header;

SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('Subscription', 'Notification', 'PaymentProof')
  AND grantee IN (current_user, 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

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
-- A2.99 Cleanup — RESET ROLE
-- ------------------------------------------------------------------
RESET ROLE;

SELECT '=== A2.99 Post-RESET-ROLE (cleanup confirmation) ===' AS section_header;

SELECT
  session_user,
  current_user,
  current_role;

-- ==================================================================
-- END OF Wave 4 (A2) SET ROLE evidence script
-- ==================================================================