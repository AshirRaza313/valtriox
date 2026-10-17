-- Phase A Containment -- Exact SQL (v3)
-- Scope: 3 confirmed-exposed tables (Subscription, Notification, PaymentProof)
-- Approved by: [pending expert written approval]
-- Executor: [pending user name/timestamp]
-- v3 changes: added SET LOCAL timeouts per expert P0-4

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Subscription
REVOKE ALL PRIVILEGES ON TABLE public."Subscription" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."Subscription" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Subscription" FROM authenticated;

-- Notification
REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM authenticated;

-- PaymentProof
REVOKE ALL PRIVILEGES ON TABLE public."PaymentProof" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PaymentProof" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."PaymentProof" FROM authenticated;

COMMIT;