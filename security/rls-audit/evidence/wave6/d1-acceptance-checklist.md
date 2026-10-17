# D1 Acceptance Checklist (fill during execution)

| Step | Check | Expected | Recorded |
|------|-------|----------|----------|
| 1 | Step 1 fixture load exit | 0 | ___ |
| 2 | Step 1 self-check | PASSED 15/15 | ___ |
| 3 | Step 2 §7 pre-containment matrix | anon=24t/0f, auth=24/0, sr=24/0, pg=24/0 | ___ |
| 4 | Step 3 DO-block FAIL-succeeded exit | non-zero (expected) | ___ |
| 5 | Step 3 DO-block FAIL-succeeded NOTICEs/ERRORs | 3× "SELECT SUCCEEDED -- FAIL; cleanup_user=postgres" | ___ |
| 6 | Step 4 containment apply exit | 0 | ___ |
| 7 | Step 5 §2 post-containment matrix | anon=0t/24f, auth=0/24, sr=24/0, pg=24/0 | ___ |
| 8 | Step 5 §1 ACL summary | anon/auth/PUBLIC absent | ___ |
| 9 | Step 5 §3.1/3.3 column post | 0 rows | ___ |
| 10 | Step 5 §6 sr/pg/ar unchanged | all true | ___ |
| 11 | Step 5 §8 row counts | 2/21/0 | ___ |
| 12 | Step 5 §9 RLS unchanged | relrowsecurity=t | ___ |
| 13 | Step 6 DO-block PASS exit | 0 | ___ |
| 14 | Step 6 DO-block PASS NOTICEs | 3× "42501 -- PASS; cleanup_user=postgres" | ___ |

**All 14 checks must pass for D1 LOCK.**