"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistrar - registers the Valtriox PWA service worker
 * on mount. Must be a client component placed inside <body>.
 */
export function ServiceWorkerRegistrar({ nonce }: { nonce?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        console.log("[SW] Registered:", registration.scope);

        // Check immediately instead of waiting for the browser's normal update
        // interval. The v11 worker removes legacy page/API caches on activation.
        await registration.update();
      })
      .catch((error) => {
        console.warn("[SW] Registration failed:", error);
      });
  }, []);

  return null;
}
