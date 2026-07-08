"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistrar - registers the Valtriox PWA service worker on mount.
 *
 * Phase 18 rev 4: Now also calls `registration.update()` on every mount to
 * force-check for SW updates. Combined with `self.skipWaiting()` + `clients.claim()`
 * in sw.js, this means a new SW version takes effect on the NEXT page load
 * (not 24h later as Chrome's default heuristic does).
 *
 * Also listens for the `controllerchange` event and reloads the page once so
 * users get the new SW's cache strategy immediately rather than living with
 * a half-migrated state.
 */
export function ServiceWorkerRegistrar({ nonce }: { nonce?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          // Check for SW updates every page load (default is up to 24h)
          updateViaCache: "none",
        });
        console.log("[SW] Registered:", registration.scope);

        // Force-check for SW update on every mount
        await registration.update();
      } catch (error) {
        console.warn("[SW] Registration failed:", error);
      }
    };

    // When a new SW takes control, reload once so the page uses the new
    // cache strategy + fresh assets. The `reloaded` flag prevents infinite loops.
    const onControllerChange = () => {
      if (!reloaded) {
        reloaded = true;
        console.log("[SW] New controller active — reloading for fresh assets");
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    registerSW();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
