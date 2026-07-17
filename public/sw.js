// Valtriox Service Worker v11
// Provides push notifications and a small, bounded cache for safe static assets.
// Page navigations and API responses are deliberately never stored in Cache Storage.

const CACHE_PREFIX = "valtriox-";
const STATIC_CACHE = "valtriox-static-v11";
const MAX_STATIC_CACHE_ENTRIES = 10;

const PRECACHE_ASSETS = [
  "/valtriox-logo.png",
  "/valtriox-icon-32.png",
  "/valtriox-icon-192.png",
  "/valtriox-icon-512.png",
  "/apple-touch-icon.png",
];

const PRECACHE_PATHS = new Set(PRECACHE_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;

  if (excess > 0) {
    await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
  }
}

function canStoreResponse(response) {
  if (!response || !response.ok || response.type === "opaque") return false;

  const cacheControl = response.headers.get("cache-control") || "";
  return !/(?:no-store|private)/i.test(cacheControl);
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (canStoreResponse(response)) {
    await cache.put(request, response.clone());
    await trimCache(STATIC_CACHE, MAX_STATIC_CACHE_ENTRIES);
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests, pages, or API data. This prevents
  // visited pages and authenticated responses from accumulating in Cache Storage.
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/")) return;

  // The browser already caches Next.js build assets using their HTTP headers.
  // Keeping only the small fixed PWA images here avoids duplicate storage.
  const isPrecachedAsset = PRECACHE_PATHS.has(url.pathname) && !url.search;

  if (isPrecachedAsset) {
    event.respondWith(cacheFirstStatic(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_VALTRIOX_CACHES") return;

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Valtriox",
    body: "You have a new notification",
    icon: "/valtriox-icon-192.png",
    badge: "/valtriox-icon-32.png",
    url: "/",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
      tag: "valtriox-notification",
      renotify: true,
      actions: [
        { action: "open", title: "Open App" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
