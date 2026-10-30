-- DO-block fail-closed probes (v6 §5.1-5.3)
-- Run via: run-do-block-probe.ps1 -Mode pre|post  (per-block, ON_ERROR_STOP=1)
-- Step 3 (pre-containment):  expect 3× ERROR "SELECT SUCCEEDED -- FAIL"
-- Step 6 (post-containment): expect 3× NOTICE "SQLSTATE=42501 -- PASS; cleanup_user=postgres"

\echo '=== DO probe 1/3: Subscription ==='
DO $$
DECLARE
  v_count BIGINT; v_state TEXT; v_msg TEXT; v_cleanup_user TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."NonExistentTableXYZ123"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'Subscription: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'Subscription: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%', v_state, v_msg, v_cleanup_user;
  END;
  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'Subscription: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%', v_count, v_cleanup_user;
END $$;
SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;

\echo ''
\echo '=== DO probe 2/3: Notification ==='
DO $$
DECLARE
  v_count BIGINT; v_state TEXT; v_msg TEXT; v_cleanup_user TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Notification"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'Notification: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'Notification: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%', v_state, v_msg, v_cleanup_user;
  END;
  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'Notification: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%', v_count, v_cleanup_user;
END $$;
SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;

\echo ''
\echo '=== DO probe 3/3: PaymentProof ==='
DO $$
DECLARE
  v_count BIGINT; v_state TEXT; v_msg TEXT; v_cleanup_user TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."PaymentProof"' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE NOTICE 'PaymentProof: SQLSTATE=42501 -- PASS; cleanup_user=%', v_cleanup_user;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM set_config('role', 'postgres', true);
      v_cleanup_user := current_user;
      RAISE EXCEPTION 'PaymentProof: unexpected SQLSTATE=% MSG=% -- FAIL; cleanup_user=%', v_state, v_msg, v_cleanup_user;
  END;
  PERFORM set_config('role', 'postgres', true);
  v_cleanup_user := current_user;
  RAISE EXCEPTION 'PaymentProof: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active); cleanup_user=%', v_count, v_cleanup_user;
END $$;
SELECT current_user AS post_cleanup_user, current_role AS post_cleanup_role;

\echo ''
\echo '=== DO-block probe COMPLETE ==='