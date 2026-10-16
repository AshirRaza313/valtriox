-- ============================================================
-- PG17 Test Fixtures — minimal replica for catalog query testing
-- ============================================================
-- Purpose: execute all Phase 10 catalog queries against real PG17
-- NOT a production replica — schema + roles only, minimal data
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
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Subscription" TO authenticated;
GRANT SELECT ON public."Subscription" TO audit_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."Notification" TO authenticated;
GRANT SELECT ON public."Notification" TO audit_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."PaymentProof" TO authenticated;
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

\echo 'Fixtures loaded successfully'