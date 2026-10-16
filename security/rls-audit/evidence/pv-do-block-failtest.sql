\echo '=== FAIL-PATH TEST: authenticated still has SELECT -> DO block must RAISE EXCEPTION ==='

DO $$
DECLARE
  v_count BIGINT;
  v_state TEXT;
  v_msg TEXT;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."Notification"' INTO v_count;
    RAISE EXCEPTION 'Notification: SELECT SUCCEEDED with count=% -- FAIL (SELECT privilege still active)', v_count;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Notification: SQLSTATE=42501 -- PASS';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      RAISE EXCEPTION 'Notification: unexpected SQLSTATE=% MSG=%', v_state, v_msg;
  END;
  PERFORM set_config('role', 'postgres', true);
END $$;