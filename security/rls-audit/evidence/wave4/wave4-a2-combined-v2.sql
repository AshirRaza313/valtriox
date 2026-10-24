-- ==================================================================
-- Wave 4 (A2) — Combined evidence (single result set) — FIXED
-- Fix: A2.4 and A2.6 now have 7 columns (k5 added as NULL)
-- ==================================================================

WITH combined AS (

  -- A2.1 Session context (7 columns)
  SELECT 1 AS ord, 'A2.1 Session' AS section,
         'session_user=' || session_user::text AS k1,
         'current_user=' || current_user::text  AS k2,
         'current_role=' || current_role::text  AS k3,
         'db=' || current_database()::text      AS k4,
         'svn=' || current_setting('server_version_num') AS k5

  UNION ALL

  -- A2.2 Role attributes (7 columns)
  SELECT 2, 'A2.2 Role attrs',
         'rolsuper=' || rolsuper::text,
         'rolcreatedb=' || rolcreatedb::text,
         'rolcreaterole=' || rolcreaterole::text,
         'rolbypassrls=' || rolbypassrls::text,
         'rolcanlogin=' || rolcanlogin::text || ' rolconnlimit=' || rolconnlimit::text
  FROM pg_roles WHERE rolname = 'valtriox_evidence_ro'

  UNION ALL

  -- A2.3 Subscription (7 columns)
  SELECT 3, 'A2.3 Subscription',
         'SELECT=' || has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'SELECT')::text,
         'INSERT=' || has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'INSERT')::text,
         'UPDATE=' || has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'UPDATE')::text,
         'DELETE=' || has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'DELETE')::text,
         'TRUNCATE=' || has_table_privilege('valtriox_evidence_ro', 'public."Subscription"', 'TRUNCATE')::text

  UNION ALL

  -- A2.3 Notification (7 columns)
  SELECT 4, 'A2.3 Notification',
         'SELECT=' || has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'SELECT')::text,
         'INSERT=' || has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'INSERT')::text,
         'UPDATE=' || has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'UPDATE')::text,
         'DELETE=' || has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'DELETE')::text,
         'TRUNCATE=' || has_table_privilege('valtriox_evidence_ro', 'public."Notification"', 'TRUNCATE')::text

  UNION ALL

  -- A2.3 PaymentProof (7 columns)
  SELECT 5, 'A2.3 PaymentProof',
         'SELECT=' || has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'SELECT')::text,
         'INSERT=' || has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'INSERT')::text,
         'UPDATE=' || has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'UPDATE')::text,
         'DELETE=' || has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'DELETE')::text,
         'TRUNCATE=' || has_table_privilege('valtriox_evidence_ro', 'public."PaymentProof"', 'TRUNCATE')::text

  UNION ALL

  -- A2.4 Membership (7 columns - k5 added as NULL)
  SELECT 6, 'A2.4 Membership: ' || member::regrole::text || ' -> ' || roleid::regrole::text,
         'grantor=' || grantor::regrole::text,
         'admin_option=' || admin_option::text,
         'set_option=' || set_option::text,
         'inherit_option=' || inherit_option::text,
         NULL
  FROM pg_auth_members
  WHERE member::regrole::text = 'valtriox_evidence_ro'
     OR roleid::regrole::text = 'valtriox_evidence_ro'

  UNION ALL

  -- A2.6 Binding hints (7 columns - NULLs added)
  SELECT 7, 'A2.6 ' || name,
         'setting=' || setting,
         NULL, NULL, NULL, NULL
  FROM pg_settings WHERE name IN ('cluster_name', 'port', 'listen_addresses')
)

SELECT section, k1, k2, k3, k4, k5
FROM combined
ORDER BY ord;