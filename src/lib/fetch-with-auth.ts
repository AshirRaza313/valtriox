// ============================================================================
// Authenticated Fetch Utility
// ============================================================================
// Wraps native fetch() with:
//   - 30-second header timeout (aborts if headers don't resolve in time)
//   - 30-second body-read timeout (aborts underlying transport if body stalls)
// Both timeouts use a single AbortController so the underlying transport is
// actually cancelled — no orphaned body reads remain.
// ============================================================================

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const headerTimeoutId = setTimeout(() => controller.abort(), 30_000);

  let externalAbort = false;
  let bodyAbort = false;
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

    const bodyMethods = ["text", "json", "blob", "arrayBuffer", "formData"] as const;

    for (const method of bodyMethods) {
      if (typeof (response as any)[method] === "function") {
        const original = (response as any)[method].bind(response);
        (response as any)[method] = async (...args: any[]) => {
          const bodyTimeoutId = setTimeout(() => {
            bodyAbort = true;
            // Abort the controller — this actually terminates the underlying
            // transport and cancels any pending body stream read.
            controller.abort();
          }, 30_000);

          try {
            return await original(...args);
          } catch (error: any) {
            if (error?.name === "AbortError" && bodyAbort && !externalAbort) {
              throw new DOMException("Body read timed out.", "TimeoutError");
            }
            throw error;
          } finally {
            clearTimeout(bodyTimeoutId);
            cleanupExternalListener();
          }
        };
      }
    }

    return response;
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

export function getAuthHeaders(): Record<string, string> {
  return {};
}