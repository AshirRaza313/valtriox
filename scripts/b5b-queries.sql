\echo '=== Query 1: current_user ==='
SELECT current_user, session_user, current_role;

\echo '=== Query 2: role memberships ==='
SELECT r.rolname AS role_name, m.rolname AS member_of
FROM pg_roles r
JOIN pg_auth_members am ON r.oid = am.member
JOIN pg_roles m ON am.roleid = m.oid
WHERE r.rolname = current_user;

\echo '=== Query 3: database CREATE ==='
SELECT datname, has_database_privilege(current_user, datname, 'CREATE') AS can_create
FROM pg_database WHERE datistemplate = false;

\echo '=== Query 4: schema CREATE ==='
SELECT nspname, has_schema_privilege(current_user, nspname, 'CREATE') AS can_create
FROM pg_namespace WHERE nspname NOT LIKE 'pg_%';

\echo '=== Query 5: sequences USAGE ==='
SELECT c.relname AS seq_name, has_sequence_privilege(current_user, c.oid, 'USAGE') AS can_use
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'S' AND n.nspname = 'public';

\echo '=== Query 6: views INSERT ==='
SELECT c.relname AS view_name, has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v' AND n.nspname = 'public';

\echo '=== Query 7: foreign tables INSERT ==='
SELECT c.relname AS ft_name, has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'f' AND n.nspname = 'public';

\echo '=== Query 8: SECURITY DEFINER functions ==='
SELECT n.nspname, p.proname, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true AND n.nspname = 'public';