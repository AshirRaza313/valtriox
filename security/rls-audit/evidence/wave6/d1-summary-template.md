# D1 Summary — PG17 E2E Evidence

**Executed UTC:** ___________
**DB:** pg17test2
**PG version:** ___________

## Key findings

- Fixture self-check: PASSED 15/15
- Pre-containment matrix: anon=24/24, auth=24/24, service_role=24/24, postgres=24/24
- Containment applied: 9 REVOKE statements, exit 0
- Post-containment matrix: anon=0/24, auth=0/24, service_role=24/24, postgres=24/24
- DO-block FAIL-succeeded proof: 3× ERROR with cleanup_user=postgres (fail-closed correct)
- DO-block PASS proof: 3× NOTICE with SQLSTATE=42501, cleanup_user=postgres (fail-closed correct)
- Row counts unchanged: 2/21/0
- RLS state unchanged

## Files (SHA256)

| File | SHA256 | Bytes |
|------|--------|-------|
| fixtures-v2-copy.sql | ___ | ___ |
| containment-v3-copy.sql | ___ | ___ |
| jit-baseline.sql | ___ | ___ |
| pv-verify.sql | ___ | ___ |
| do-block-probe.sql | ___ | ___ |
| step1-fixture-load-<UTC>.log | ___ | ___ |
| step2-jit-baseline-<UTC>.log | ___ | ___ |
| step3-do-fail-succeeded-<UTC>.log | ___ | ___ |
| step4-containment-<UTC>.log | ___ | ___ |
| step5-pv-verify-<UTC>.log | ___ | ___ |
| step6-do-pass-<UTC>.log | ___ | ___ |

## No-mutation attestation

- All operations local (pg17test2, disposable)
- No production ALTER/REVOKE/GRANT/DROP executed
- No NOLOGIN executed
- Production anon probe = read-only GET (Wave 6B)