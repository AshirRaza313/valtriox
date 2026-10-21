# Out-of-Scope Flags — Phase 11 Audit Observations

**File:** OUT-OF-SCOPE-FLAGS.md  
**Status:** Informational — NOT in Phase A containment scope  
**Prepared by:** Ashir Raza  
**Date:** 2026-10-17

---

## Purpose

This file documents observations and follow-up items surfaced during the Phase 11 audit that are **explicitly outside** the Phase A containment scope. None of these require action under the Phase A approval being requested in this PR. They are recorded for transparency and future follow-up.

---

## Flag 1 — Production app may be using deprecated legacy anon key

**Observation:** During Wave 6B (D2 probe), the Supabase API gateway rejected the dashboard-displayed `anon` key with `sb-error-code: UNAUTHORIZED_INVALID_API_KEY`. The publishable key (`sb_publishable_...`) worked as expected (206/200, pre-containment baseline confirmed).

**Root cause: UNVERIFIED.** The dashboard-displayed key was rejected by the gateway with `sb-error-code: UNAUTHORIZED_INVALID_API_KEY`, while the publishable key (`sb_publishable_...`) succeeded on the same tables. Candidate causes include Supabase legacy-key deprecation (documented migration path), project-specific JWT key rotation, or a gateway policy change. Primary evidence at audit time does not confirm which cause applies to this specific rejection.

**Potential impact (UNVERIFIED):** If the production Vercel deployment uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to a legacy value, end-user requests could be returning 401. This is a **separate incident** from the RLS audit.

**Recommended follow-up:** Verify Vercel environment variables and monitor application health after the anon key migration completes.

**Not in Phase A scope.**

---

## Flag 2 — `rolconnlimit` change on `valtriox_evidence_ro`

**Observation:** Phase 10 NOLOGIN evidence recorded `rolconnlimit = -1` for `valtriox_evidence_ro`. Wave 4 A2 evidence recorded `rolconnlimit = 2`.

**Production role change: UNVERIFIED.** Comparing Phase 10 evidence (disposable test environment) to Wave 4 A2 evidence (production) does not prove that a change occurred in production. The apparent `-1` vs `2` difference may reflect a genuine production change, snapshot timing differences, or a difference in the evidence capture environment. Confirm with production role owner.

**Impact:** Connection-limit only; does not affect read-only privilege state. Phase A containment unaffected.

**Recommended follow-up:** Confirm intentional change with whoever manages role provisioning.

**Not in Phase A scope.**

---

## Flag 3 — `postgres -> valtriox_evidence_ro` membership edge

**Observation:** Wave 4 A2 evidence shows a membership edge `postgres → valtriox_evidence_ro` (grantor `supabase_admin`, `admin_option=true`, `set_option=false`). This edge was not documented in Phase 10 NOLOGIN evidence.

**Whether edge is new since Phase 10: UNVERIFIED.** Comparison of Phase 10 evidence (disposable test environment) to Wave 4 A2 evidence (production) cannot prove that the edge newly appeared in production. The edge may have existed in production at Phase 10 time but not been captured, or may be genuinely new. Confirm with production role owner.

**Impact:** `admin_option=true` allows `postgres` to administer the role; does not grant additional privileges to `valtriox_evidence_ro`. `set_option=false` prevents `postgres` from SET ROLE into it via this edge (superuser status separately allows it).

**Recommended follow-up:** Confirm intentional. If not needed, consider revoking (requires approval — out of Phase A scope).

**Not in Phase A scope.**

---

## Flag 4 — `valtriox_evidence_ro` password unavailable

**Observation:** Wave 4 A2 evidence was captured via static catalog queries (explicit role name argument to `has_table_privilege()`), not via direct session authentication as `valtriox_evidence_ro`. Reason: password not available in custody; reset would require `ALTER ROLE` (forbidden without written approval).

**Impact:** A2 evidence is valid as **role state proof** (role's actual privileges proven) but does not demonstrate a live session where `session_user = valtriox_evidence_ro`. Documented as an honest limitation in A3 report (`wave4/A3-canonical-sql-binding-*.txt` §5).

**Recommended follow-up:** If expert requires session-binding proof, consider:
- Requesting written approval for password reset (`ALTER ROLE ... PASSWORD`), OR
- Using Supabase Management API if it exposes role session introspection, OR
- Accepting static catalog proof as sufficient for read-only role state.

**Documented limitation, not a defect.**

---

## Flag 5 — 206 Partial Content classification in probe output

**Observation:** Wave 6B (D2 probe) received HTTP `206 Partial Content` for Subscription and Notification, and HTTP `200 OK` for PaymentProof. PS1 script logged `206` as `UNEXPECTED_HTTP_206` due to a strict-`200`-only assumption in the classification logic.

**Analysis:** `206` is the correct PostgREST response when `Prefer: count=exact` is set AND `Content-Range` header is returned AND body is truncated (via `limit=0`). `Content-Range: */2` etc. **confirms** anon has SELECT privilege (which is the desired pre-containment baseline). No data leak occurred.

**Impact:** Evidence is valid. Classification label was misleading, not the underlying data.

**Recommended follow-up:** For post-containment re-probe in Wave 7 (after Phase A execution), consider accepting both 200 and 206 as "response received" in the classification logic (expectation: 401/403 post-containment).

**Not a security concern — classification label only.**

---

## Flag 6 — Vercel support case number

**Observation:** Two Vercel support case numbers appeared during Phase 11:
- `TNS_01cRvby0v7ka4bvb` — initial (later identified as wrong entry; account/email transfer mistake)
- `TNS_01svbbdIV5N1m04Q` — authoritative (2FA reconfigure on existing email)

**Impact:** Vercel Production SHA binding remains unavailable pending 2FA recovery. Wave 1 workaround via GitHub Deployments API provided machine-verifiable deployed SHA for the S1 branch (not for this PR branch — this PR's branch only has Preview deployments recorded, no Production).

**Recommended follow-up:** On Vercel recovery, verify Production SHA binding for PR #17 and update the manifest/PR comment if needed.

**Not a security concern. Tooling access blocker.**

---

## Summary

| # | Flag | Severity | Action |
|---|------|----------|--------|
| 1 | Production app may use legacy anon key | Medium (potential outage) | Follow-up: verify env vars |
| 2 | `rolconnlimit` change | Low | Confirm intentional |
| 3 | `postgres → valtriox_evidence_ro` membership | Low | Confirm intentional |
| 4 | Role password unavailable | Documentation | Flagged in A3 §5 |
| 5 | 206 classification label | Cosmetic | Consider in Wave 7 post-containment re-probe |
| 6 | Vercel case number change | Informational | Follow-up on recovery |

**None of these block Phase A containment approval.**