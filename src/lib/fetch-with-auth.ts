// ============================================================================
// Authenticated Fetch Utility
// ============================================================================
// Wraps native fetch() to automatically inject authentication headers from
// the Zustand store (localStorage). This ensures ALL API calls include auth
// context even if cookies/middleware fail.
//
// Usage:
//   import { fetchWithAuth } from "@/lib/fetch-with-auth";
//   const res = await fetchWithAuth("/api/dashboard/stats?orgId=xxx");
//
// Works identically to native fetch - same signature, same return type.
// ============================================================================

/**
 * Read auth data from localStorage (same keys as valtriox-store.ts).
 * Returns null if not logged in.
 * Includes auto-migration from legacy keys (brandflow-*, brandforge-*) → valtriox-*
 */
function migrateLegacyKeys() {
  try {
    if (typeof window === "undefined") return;
    const legacyPrefixes = ["brandforge", "brandflow"];
    const newPrefix = "valtriox";
    const keySuffixes = ["-user", "-org", "-brandname", "-logo", "-tagline", "-configured", "-theme", "-language", "-appTheme"];
    for (const oldPrefix of legacyPrefixes) {
      for (const suffix of keySuffixes) {
        const oldKey = `${oldPrefix}${suffix}`;
        const newKey = `${newPrefix}${suffix}`;
        if (localStorage.getItem(oldKey) && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
          localStorage.removeItem(oldKey);
        }
      }
      // Also migrate chat/support/call/skipped keys
      const extraKeys = ["-chat-messages", "-support-chat", "-call-logs", "-skipped-setup"];
      for (const suffix of extraKeys) {
        const oldKey = `${oldPrefix}${suffix}`;
        const newKey = `${newPrefix}${suffix}`;
        if (localStorage.getItem(oldKey) && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
          localStorage.removeItem(oldKey);
        }
      }
    }
  } catch { /* silent */ }
}
function getAuthFromStorage(): { userId: string; email: string; role: string; orgId: string } | null {
  try {
    if (typeof window === "undefined") return null;
    migrateLegacyKeys();
    const userStr = localStorage.getItem("valtriox-user");
    const orgStr = localStorage.getItem("valtriox-org");
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    const org = orgStr ? JSON.parse(orgStr) : null;

    if (!user?.id) return null;

    return {
      userId: user.id,
      email: user.email || "",
      role: user.role || "member",
      orgId: org?.id || "",
    };
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch - identical API to native fetch() but auto-injects
 * auth headers from localStorage. Includes a 30-second timeout to prevent
 * hanging on slow serverless functions.
 *
 * The auth headers are only added if they don't already exist on the request
 * (allows manual override if needed).
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const auth = getAuthFromStorage();

  // Merge auth headers into the request
  const headers = new Headers(init?.headers);

  if (auth) {
    if (!headers.has("x-user-id")) {
      headers.set("x-user-id", auth.userId);
    }
    if (!headers.has("x-user-email")) {
      headers.set("x-user-email", auth.email);
    }
    if (!headers.has("x-user-role")) {
      headers.set("x-user-role", auth.role);
    }
    if (!headers.has("x-org-id")) {
      headers.set("x-org-id", auth.orgId);
    }
  }

  // Add 30-second timeout to prevent hanging on slow serverless cold starts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
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
 */
export function getAuthHeaders(): Record<string, string> {
  const auth = getAuthFromStorage();
  if (!auth) return {};

  return {
    "x-user-id": auth.userId,
    "x-user-email": auth.email,
    "x-user-role": auth.role,
    "x-org-id": auth.orgId,
  };
}
