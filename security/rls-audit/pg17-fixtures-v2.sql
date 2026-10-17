-- ============================================================
-- PG17 Test Fixtures v2 — minimal replica for catalog query testing
-- ============================================================
-- Purpose: execute all Phase 11 catalog queries against real PG17
-- NOT a production replica — schema + roles only, minimal data
--
-- v2 changes (Phase 11 Wave 5C / D1 fix):
--
--   1. Added explicit service_role table grants on all 3 tables
--      (8 privs each: SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--      REFERENCES, TRIGGER, MAINTAIN).
--      Rationale: v1 had service_role RLS policy but no explicit
--      table grants; has_table_privilege('service_role', ...)
--      returned false → §7 matrix failed 24/24 expectation.
--
--   2. Added explicit postgres table grants on all 3 tables
--      (same 8 privs).
--      Rationale: v1 relied on owner-implicit + role-inheritance
--      for has_table_privilege('postgres', ...) — but §5 ACL
--      query (aclexplode) showed 0 rows for postgres because
--      owner-implicit privileges are not in relacl. Explicit
--      grants make §5 output match §7 output and Phase 2.1
--      reference (postgres=8 rows per table).
--
--   3. Added self-check block at end (§7 of this file):
--      - Display per-(table, role) ACL counts
--      - Fail-closed assertion if any count mismatches expected
-- ============================================================

-- 1. Roles (mirror production)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_readonly') THEN
    CREATE ROLE audit_readonly LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'valtriox_evidence_ro') THEN
    CREATE ROLE valtriox_evidence_ro LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN;
  END IF;
END $$;

-- 2. Memberships (mirror production shape)
GRANT anon TO postgres;
GRANT authenticated TO postgres;
-- informational: mirrors production membership graph; no functional
-- effect on owner privileges (postgres already owns tables; role
-- membership does not grant additional capability here)
GRANT service_role TO postgres;
GRANT valtriox_evidence_ro TO postgres WITH ADMIN OPTION;

-- Simulate pg_read_all_data membership (may already exist on Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pg_read_all_data') THEN
    GRANT pg_read_all_data TO valtriox_evidence_ro;
  ELSE
    RAISE NOTICE 'pg_read_all_data not present — skipping membership';
  END IF;
END $$;

-- 3. Tables (structure only, minimal columns)
CREATE TABLE IF NOT EXISTS public."Subscription" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Notification" (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."PaymentProof" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  amount NUMERIC NOT NULL
);

-- 4. Enable RLS + baseline policies (mirror production anon_read pattern)
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentProof" ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read ON public."Subscription" FOR SELECT TO anon USING (true);
CREATE POLICY anon_read ON public."Notification" FOR SELECT TO anon USING (true);
CREATE POLICY anon_read ON public."PaymentProof" FOR SELECT TO anon USING (true);

CREATE POLICY service_role_all ON public."Subscription" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON public."Notification" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON public."PaymentProof" FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Grants (mirror production pattern — this is what containment will REVOKE)
-- v2 D1 fix: service_role grants added (v1 lacked → §7 matrix failed).
-- v2 D1 fix: postgres explicit grants added (v1 owner-implicit did not
-- appear in relacl → §5 ACL showed 0 rows for postgres).

-- Subscription
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO service_role;   -- v2 D1
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO postgres;      -- v2 D1
GRANT SELECT ON public."Subscription" TO audit_readonly;

-- Notification
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO service_role;   -- v2 D1
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO postgres;      -- v2 D1
GRANT SELECT ON public."Notification" TO audit_readonly;

-- PaymentProof
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO service_role;   -- v2 D1
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO postgres;      -- v2 D1
GRANT SELECT ON public."PaymentProof" TO audit_readonly;

-- 6. Sample data (2 Subscription, 21 Notification, 0 PaymentProof — matches production counts)
INSERT INTO public."Subscription" (id, organization_id, plan, status) VALUES
  ('sub-1', 'org-1', 'growth', 'active'),
  ('sub-2', 'org-2', 'starter', 'trial')
ON CONFLICT DO NOTHING;

INSERT INTO public."Notification" (id, org_id, user_id, title, message, read) VALUES
  ('notif-1', 'org-1', 'user-1', 'Test 1', 'Message 1', false),
  ('notif-2', 'org-1', 'user-1', 'Test 2', 'Message 2', false),
  ('notif-3', 'org-1', 'user-1', 'Test 3', 'Message 3', false),
  ('notif-4', 'org-1', 'user-1', 'Test 4', 'Message 4', false),
  ('notif-5', 'org-1', 'user-1', 'Test 5', 'Message 5', false),
  ('notif-6', 'org-1', 'user-1', 'Test 6', 'Message 6', false),
  ('notif-7', 'org-1', 'user-1', 'Test 7', 'Message 7', false),
  ('notif-8', 'org-1', 'user-1', 'Test 8', 'Message 8', false),
  ('notif-9', 'org-1', 'user-1', 'Test 9', 'Message 9', false),
  ('notif-10', 'org-1', 'user-1', 'Test 10', 'Message 10', false),
  ('notif-11', 'org-1', 'user-1', 'Test 11', 'Message 11', false),
  ('notif-12', 'org-1', 'user-1', 'Test 12', 'Message 12', false),
  ('notif-13', 'org-1', 'user-1', 'Test 13', 'Message 13', false),
  ('notif-14', 'org-1', 'user-1', 'Test 14', 'Message 14', false),
  ('notif-15', 'org-1', 'user-1', 'Test 15', 'Message 15', false),
  ('notif-16', 'org-1', 'user-1', 'Test 16', 'Message 16', false),
  ('notif-17', 'org-1', 'user-1', 'Test 17', 'Message 17', false),
  ('notif-18', 'org-1', 'user-1', 'Test 18', 'Message 18', false),
  ('notif-19', 'org-1', 'user-1', 'Test 19', 'Message 19', false),
  ('notif-20', 'org-1', 'user-1', 'Test 20', 'Message 20', false),
  ('notif-21', 'org-1', 'user-1', 'Test 21', 'Message 21', false)
ON CONFLICT DO NOTHING;

-- PaymentProof intentionally empty (0 rows)

\echo ''
\echo '=== Fixtures base content loaded ==='

-- ------------------------------------------------------------
-- 7. SELF-CHECK (v2 D1 verification)
-- Expected per table: anon=8, authenticated=8, service_role=8,
-- postgres=8, audit_readonly=1
-- ------------------------------------------------------------

\echo ''
\echo '=== ACL count per (table, role) — from relacl ==='
SELECT c.relname AS table_name,
       r.rolname AS grantee,
       count(*)  AS priv_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public'
  AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
  AND r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'audit_readonly')
GROUP BY c.relname, r.rolname
ORDER BY c.relname, r.rolname;

\echo ''
\echo '=== Self-check assertion (fail-closed) ==='
DO $$
DECLARE
  v_bad INTEGER;
  v_details TEXT;
BEGIN
  WITH expected AS (
    SELECT t.tbl, r.role, r.expected_count
    FROM (VALUES ('Subscription'),('Notification'),('PaymentProof')) t(tbl)
    CROSS JOIN (VALUES
      ('anon',           8),
      ('authenticated',  8),
      ('service_role',   8),
      ('postgres',       8),
      ('audit_readonly', 1)
    ) r(role, expected_count)
  ),
  actual AS (
    SELECT c.relname AS tbl, rl.rolname AS role, count(*) AS actual_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    JOIN pg_roles rl ON rl.oid = a.grantee
    WHERE n.nspname = 'public'
      AND c.relname IN ('Subscription', 'Notification', 'PaymentProof')
      AND rl.rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'audit_readonly')
    GROUP BY c.relname, rl.rolname
  )
  SELECT
    count(*) FILTER (WHERE a.actual_count IS DISTINCT FROM e.expected_count),
    string_agg(
      format('%s/%s: expected %s, actual %s',
             e.tbl, e.role, e.expected_count,
             COALESCE(a.actual_count::text, '0')),
      '; '
    ) FILTER (WHERE a.actual_count IS DISTINCT FROM e.expected_count)
  INTO v_bad, v_details
  FROM expected e
  LEFT JOIN actual a ON a.tbl = e.tbl AND a.role = e.role;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: % mismatched (table, role) combos: %', v_bad, v_details;
  END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: all 15 (table, role) combos match expected counts (anon=8, authenticated=8, service_role=8, postgres=8, audit_readonly=1 per table)';
END $$;

\echo ''
\echo 'Fixtures v2 loaded successfully.'