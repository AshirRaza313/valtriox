// ============================================================================
// Authenticated Fetch Utility
// ============================================================================
// Wraps native fetch() with:
//   - 30-second header timeout (aborts if headers don't resolve in time)
//   - 30-second body-read timeout (aborts underlying transport if body stalls)
//   - Response.clone() support — cloned responses inherit the same timeout
//
// Both timeouts use a single AbortController so the underlying transport is
// actually cancelled — no orphaned body reads remain.
//
// SCOPE / LIMITS (explicitly documented):
//   ✅ Covered: response.text(), response.json(), response.blob(),
//               response.arrayBuffer(), response.formData(), response.clone()
//   ⚠️  Not covered by TIMEOUT (but covered by EXTERNAL abort):
//               response.body.getReader() — direct stream reads have no
//               internal timeout, but external AbortSignal still cancels them.
// ============================================================================

const TIMEOUT_MS = 30_000;

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const headerTimeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let externalAbort = false;
  let onExternalAbort: (() => void) | null = null;

  if (init?.signal) {
    if (init.signal.aborted) {
      clearTimeout(headerTimeoutId);
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    onExternalAbort = () => {
      externalAbort = true;
      controller.abort();
    };
    init.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const cleanupExternalListener = () => {
    if (init?.signal && onExternalAbort) {
      init.signal.removeEventListener("abort", onExternalAbort);
      onExternalAbort = null;
    }
  };

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    // Headers resolved — clear header timeout so it doesn't fire during body read.
    clearTimeout(headerTimeoutId);

    return wrapResponse(response, controller, () => externalAbort, cleanupExternalListener);
  } catch (error: any) {
    clearTimeout(headerTimeoutId);
    cleanupExternalListener();

    if (error?.name === "AbortError") {
      if (externalAbort) throw error;
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

function wrapResponse(
  response: Response,
  controller: AbortController,
  getExternalAbort: () => boolean,
  cleanupExternalListener: () => void
): Response {
  const bodyMethods = ["text", "json", "blob", "arrayBuffer", "formData"] as const;
  const originals: Record<string, any> = {};
  let bodyAbort = false;

  const makeWrapper = (method: string, original: (...args: any[]) => Promise<any>) => {
    return async (...args: any[]) => {
      const bodyTimeoutId = setTimeout(() => {
        bodyAbort = true;
        controller.abort();
      }, TIMEOUT_MS);

      try {
        return await original(...args);
      } catch (error: any) {
        if (error?.name === "AbortError" && bodyAbort && !getExternalAbort()) {
          throw new DOMException("Body read timed out.", "TimeoutError");
        }
        throw error;
      } finally {
        clearTimeout(bodyTimeoutId);
        cleanupExternalListener();
      }
    };
  };

  for (const method of bodyMethods) {
    if (typeof (response as any)[method] === "function") {
      originals[method] = (response as any)[method].bind(response);
      (response as any)[method] = makeWrapper(method, originals[method]);
    }
  }

  // ── Clone support ────────────────────────────────────────────────────────
  // When cloned, the clone's body methods must ALSO enforce the same timeout.
  // Without this, `response.clone().text()` would hang indefinitely.
  // Test doubles may not provide clone, and should remain valid responses.
  if (typeof (response as any).clone === "function") {
    const originalClone = (response as any).clone.bind(response);
    (response as any).clone = function cloneWithTimeout() {
      const cloned = originalClone();
      // Reuse the SAME controller so aborting the original also cancels the clone
      return wrapResponse(cloned, controller, getExternalAbort, cleanupExternalListener);
    };
  }

  return response;
}

export function getAuthHeaders(): Record<string, string> {
  return {};
}