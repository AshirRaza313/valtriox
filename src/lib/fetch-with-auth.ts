// ============================================================================
// Authenticated Fetch Utility
// ============================================================================
// Wraps native fetch() with a 30-second timeout. Auth is handled
// automatically by httpOnly + HMAC-signed cookies sent by the browser on
// every same-origin request — no client-side auth header injection needed.
//
// SECURITY (Phase 17 — localStorage PII purge):
//   Previous versions read `valtriox-user` / `valtriox-org` from localStorage
//   and injected `x-user-id` / `x-user-email` / `x-user-role` / `x-org-id`
//   headers. The server's auth-middleware.ts NEVER trusted these headers
//   (see "FIX 1.2" comment in that file) — they were dead code that only
//   increased the XSS attack surface by keeping PII in localStorage.
//   All header injection has been removed. Auth flows solely through
//   signed cookies that JS cannot read.
//
// 401 HANDLING (Phase 18 rev 6):
//   When the server returns 401 (session expired / cookies invalid), we
//   trigger a global "auth-expired" event. The page.tsx root listens for
//   this event and:
//     1. Clears in-memory user/org state
//     2. Calls /api/auth/logout to clear cookies
//     3. Switches view to "landing"
//   This prevents the "polling storm" where useSubscriptionSync (60s),
//   useDbNotifications (30s), and useDashboardStats (60s) all kept firing
//   401 requests in a loop after the session expired.
//
// Usage:
//   import { fetchWithAuth } from "@/lib/fetch-with-auth";
//   const res = await fetchWithAuth("/api/dashboard/stats");
// ============================================================================

// ── 401 Auth-Expired Event Bus ──────────────────────────────────────────────
// We use a global CustomEvent so ANY fetch in the app can trigger a logout
// by simply returning 401. The root page subscribes once and handles cleanup.
let _authExpiredDispatched = false;
const AUTH_EXPIRED_EVENT = "valtriox:auth-expired";

function dispatchAuthExpired() {
  if (_authExpiredDispatched) return; // Only fire once per session
  _authExpiredDispatched = true;
  if (typeof window !== "undefined") {
    console.warn("[Auth] Session expired — dispatching logout event");
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    // Reset the flag after a delay so a re-login can fire it again later
    setTimeout(() => { _authExpiredDispatched = false; }, 30_000);
  }
}

export function onAuthExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}

/**
 * Authenticated fetch — identical API to native fetch() but applies a
 * 30-second timeout to prevent hanging on slow serverless cold starts.
 *
 * Cookies (including the httpOnly auth cookie) are sent automatically by
 * the browser for same-origin requests. No manual header injection.
 *
 * On 401, dispatches an "auth-expired" event so the UI can log the user out
 * gracefully instead of silently retrying forever.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Add 30-second timeout to prevent hanging on slow serverless cold starts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    // ── 401 → Auto-Logout ───────────────────────────────────────────────────
    // The server returned 401, meaning the session is expired or invalid.
    // Trigger a global logout event so the UI stops polling and shows the
    // login screen. This prevents the "401 polling storm" where multiple
    // hooks (useSubscriptionSync, useDbNotifications, etc.) kept firing
    // requests every minute after session expiry.
    if (res.status === 401) {
      // Only dispatch for API routes — a 401 on a static asset fetch is
      // not an auth issue.
      const url = typeof input === "string" ? input : (input instanceof URL ? input.href : input.url);
      if (url && url.includes("/api/")) {
        dispatchAuthExpired();
      }
    }

    return res;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get auth headers as a plain object (for use with external libraries
 * that accept headers as objects rather than Headers instances).
 *
 * DEPRECATED (Phase 17): Auth now flows exclusively through httpOnly
 * cookies. This function always returns `{}`. Retained as a stub so
 * existing imports do not break — call sites can be cleaned up gradually.
 */
export function getAuthHeaders(): Record<string, string> {
  return {};
}
