// ============================================================================
// Authenticated Fetch Utility
// ============================================================================
// Wraps native fetch() with a 30-second timeout for headers, and a separate
// 30-second timeout for body consumption so stalled response bodies cannot
// keep the UI in a permanent loading state.
// ============================================================================

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const headerTimeoutId = setTimeout(() => controller.abort(), 30_000);

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
    }
  };

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    // Headers resolved successfully — clear the header timeout so it
    // doesn't interfere with body reading.
    clearTimeout(headerTimeoutId);

    const bodyMethods = ["text", "json", "blob", "arrayBuffer", "formData"] as const;

    for (const method of bodyMethods) {
      if (typeof (response as any)[method] === "function") {
        const original = (response as any)[method].bind(response);
        (response as any)[method] = async (...args: any[]) => {
          let bodyTimeoutId: ReturnType<typeof setTimeout> | null = null;

          // Race the original body read against a body timeout.
          return await new Promise<any>((resolve, reject) => {
            bodyTimeoutId = setTimeout(() => {
              reject(new DOMException("Body read timed out.", "TimeoutError"));
            }, 30_000);

            original(...args)
              .then((value: any) => {
                if (bodyTimeoutId) clearTimeout(bodyTimeoutId);
                resolve(value);
              })
              .catch((err: any) => {
                if (bodyTimeoutId) clearTimeout(bodyTimeoutId);
                reject(err);
              });
          }).finally(() => {
            // Cleanup external listener after body read completes, fails, or times out
            cleanupExternalListener();
          });
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
