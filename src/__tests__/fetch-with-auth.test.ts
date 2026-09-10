import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

describe("fetchWithAuth external AbortSignal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("aborts fetch when external signal fires during request", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((input: any, init: any) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    globalThis.fetch = fetchMock as any;

    const promise = fetchWithAuth("/api/test", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow("Aborted");
  });

  it("removes external abort listener after response body consumed", async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
    const mockResponse = new Response("{}", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchMock as any;

    const res = await fetchWithAuth("/api/test", { signal: controller.signal });
    await res.text();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("does not override timeout error when external abort happens", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((input: any, init: any) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    globalThis.fetch = fetchMock as any;

    const promise = fetchWithAuth("/api/test", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow("Aborted");
  });

  it("triggers internal header timeout and rejects with timeout error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: any, init: any) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    globalThis.fetch = fetchMock as any;

    const promise = fetchWithAuth("/api/test");
    vi.advanceTimersByTime(30_000);
    await expect(promise).rejects.toThrow("Request timed out. Please try again.");
  });

  it("aborts pending body when external signal fires after headers", async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;

    const mockResponse = {
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: () => new Promise((_, reject) => {
        capturedSignal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
      ok: true,
    } as unknown as Response;

    const fetchMock = vi.fn((input: any, init: any) => {
      capturedSignal = init.signal;
      return Promise.resolve(mockResponse);
    });
    globalThis.fetch = fetchMock as any;

    const result = await fetchWithAuth("/api/test", { signal: controller.signal });
    expect(capturedSignal).toBeDefined();
    const bodyRead = result.text();

    controller.abort();
    expect(capturedSignal?.aborted).toBe(true);
    await expect(bodyRead).rejects.toThrow("Aborted");
  });

  it("body timeout aborts underlying transport and rejects with TimeoutError", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    let abortFired = false;

    const mockResponse = {
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: () => new Promise((_, reject) => {
        capturedSignal!.addEventListener("abort", () => {
          abortFired = true;
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
      ok: true,
    } as unknown as Response;

    const fetchMock = vi.fn((input: any, init: any) => {
      capturedSignal = init.signal;
      return Promise.resolve(mockResponse);
    });
    globalThis.fetch = fetchMock as any;

    const result = await fetchWithAuth("/api/test");
    expect(capturedSignal).toBeDefined();
    const bodyRead = result.text();

    // Advance past body timeout (30s) — should abort the underlying transport
    vi.advanceTimersByTime(30_000);

    // Verify underlying signal was actually aborted (transport cancellation)
    expect(capturedSignal?.aborted).toBe(true);
    expect(abortFired).toBe(true);
    await expect(bodyRead).rejects.toThrow("Body read timed out.");
  });

  it("never-ending body does not leave orphan read after timeout", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    let listenerFired = false;

    const mockResponse = {
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: () => new Promise((_, reject) => {
        capturedSignal!.addEventListener("abort", () => {
          listenerFired = true;
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
      ok: true,
    } as unknown as Response;

    const fetchMock = vi.fn((input: any, init: any) => {
      capturedSignal = init.signal;
      return Promise.resolve(mockResponse);
    });
    globalThis.fetch = fetchMock as any;

    const result = await fetchWithAuth("/api/test");
    const bodyRead = result.text();

    vi.advanceTimersByTime(30_000);

    // Underlying signal must be aborted — proves transport was cancelled
    expect(capturedSignal?.aborted).toBe(true);
    expect(listenerFired).toBe(true);
    await expect(bodyRead).rejects.toThrow("Body read timed out.");
  });
});