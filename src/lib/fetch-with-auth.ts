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
//   ✅ Covered: response.body.getReader() — direct stream reads are cancelled
//               when the shared controller times out or an external signal fires.
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
  cleanupExternalListener: () => void,
  lifecycle: { activeConsumers: number } = { activeConsumers: 0 }
): Response {
  const bodyMethods = ["text", "json", "blob", "arrayBuffer", "formData"] as const;
  const originals: Record<string, any> = {};
  let bodyAbort = false;

  const makeWrapper = (method: string, original: (...args: any[]) => Promise<any>) => {
    return async (...args: any[]) => {
      lifecycle.activeConsumers++;
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
        lifecycle.activeConsumers--;
        if (lifecycle.activeConsumers === 0) cleanupExternalListener();
      }
    };
  };

  for (const method of bodyMethods) {
    if (typeof (response as any)[method] === "function") {
      originals[method] = (response as any)[method].bind(response);
      (response as any)[method] = makeWrapper(method, originals[method]);
    }
  }

  // Native response.body.getReader() does not reject a pending read when an
  // AbortSignal fires. Race the native read against an abort promise so the
  // caller observes the same timeout/abort lifecycle as body methods.
  if (response.body) {
    const originalBody = response.body;
    const originalGetReader = originalBody.getReader.bind(originalBody);

    (originalBody as any).getReader = function getReaderWithTimeout(...args: any[]) {
      const reader = originalGetReader(...args);
      let streamAbort = false;
      let abortRead: ((reason: DOMException) => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        abortRead = reject;
      });
      const onAbort = () => {
        streamAbort = true;
        reader.cancel().catch(() => {});
        abortRead?.(
          bodyAbort && !getExternalAbort()
            ? new DOMException("Body read timed out.", "TimeoutError")
            : new DOMException("The operation was aborted.", "AbortError")
        );
      };
      const streamTimeoutId = setTimeout(() => {
        bodyAbort = true;
        controller.abort();
      }, TIMEOUT_MS);

      lifecycle.activeConsumers++;
      if (controller.signal.aborted) {
        onAbort();
      } else {
        controller.signal.addEventListener("abort", onAbort, { once: true });
      }

      const originalRead = (reader.read as (...args: any[]) => Promise<any>).bind(reader);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearTimeout(streamTimeoutId);
        controller.signal.removeEventListener("abort", onAbort);
        lifecycle.activeConsumers--;
        if (lifecycle.activeConsumers === 0) cleanupExternalListener();
      };

      (reader as any).read = async function readWithSignal(...args: any[]) {
        if (controller.signal.aborted && !streamAbort) onAbort();
        try {
          const result = await Promise.race([originalRead(...args), abortPromise]);
          if (result.done) release();
          return result;
        } catch (error: any) {
          release();
          if (error?.name === "AbortError" && bodyAbort && !getExternalAbort()) {
            throw new DOMException("Body read timed out.", "TimeoutError");
          }
          throw error;
        }
      };

      return reader;
    };
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
      return wrapResponse(
        cloned,
        controller,
        getExternalAbort,
        cleanupExternalListener,
        lifecycle
      );
    };
  }

  return response;
}

export function getAuthHeaders(): Record<string, string> {
  return {};
}