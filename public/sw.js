// ── Valtriox Service Worker v11 ──
// Phase 18 rev 4: Fixed stale-page caching bug.
//
// PREVIOUS BUG (v10): The SW precached '/' (the authenticated dashboard SSR
// page) with a cache-first strategy. After every deploy, returning users got
// STALE HTML pointing to OLD JS chunk hashes (e.g. main-abc123.js) that no
// longer existed on the server → broken page. Required Ctrl+Shift+R to bypass
// the SW and fetch fresh HTML.
//
// FIX (v11):
//   1. Removed ALL HTML pages from the precache list — HTML is always fetched
//      network-first and never cached.
//   2. Added an HTML-detection guard at the top of the fetch handler that
//      BYPASSES the SW entirely for navigation requests. The browser handles
//      HTML with its native HTTP cache + ETag revalidation, which correctly
//      invalidates on deploy.
//   3. Only static assets (JS/CSS/images with hashed filenames) and API
//      responses are cached. Hashed filenames mean old caches are automatically
//      safe — a new deploy produces new hashes, so the SW never serves stale
//      chunks.
//   4. Bumped cache version v10 → v11 to invalidate ALL old caches on activate.
//
// Handles: push notifications, offline API fallback, static asset caching.

const CACHE_VERSION = 'v11';
const CACHE_NAME = `valtriox-${CACHE_VERSION}`;
const STATIC_CACHE = `valtriox-static-${CACHE_VERSION}`;
const API_CACHE = `valtriox-api-${CACHE_VERSION}`;

// ── App Shell: ONLY truly static assets (never HTML) ──
// HTML pages are deliberately excluded — they change per-deploy and per-user
// (SSR), so caching them causes stale-page bugs.
const APP_SHELL = [
  '/manifest.json',
  '/valtriox-logo.png',
  '/valtriox-icon-192.png',
  '/valtriox-icon-512.png',
  '/apple-touch-icon.png',
];

// ── API routes that should be cached with network-first ──
const API_CACHE_PATTERNS = [
  /\/api\/dashboard\/stats/,
  /\/api\/products/,
  /\/api\/orders/,
  /\/api\/customers/,
];

// NEVER cache these — auth-sensitive, per-user, or real-time
const NEVER_CACHE_PATTERNS = [
  /\/api\/auth/,
  /\/api\/ai-team\/ask/,
  /\/api\/ai-team\/tasks\/.*\/execute/,
  /\/api\/ai-team\/seed/,
  /\/api\/communications/,
  /\/api\/admin\/communications/,
  /\/api\/subscriptions\/payment/,
];

// ── Cache size limits ──
const MAX_API_CACHE_ENTRIES = 50;
const MAX_STATIC_CACHE_ENTRIES = 100;

// ── Install: precache ONLY static assets (no HTML) ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW v11] Pre-caching static shell (no HTML)');
      return cache.addAll(APP_SHELL).catch((err) => {
        // Don't fail install if a single asset is missing
        console.warn('[SW v11] Some shell assets failed to precache:', err);
      });
    })
  );
  self.skipWaiting(); // Activate new SW immediately on next load
});

// ── Activate: clean up ALL old caches (v10 and earlier) ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => {
            console.log('[SW v11] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim(); // Take control of open tabs immediately
});

// ── Push: show notification when server sends a push message ──
self.addEventListener('push', (event) => {
  let data = {
    title: 'Valtriox',
    body: 'You have a new notification',
    icon: '/valtriox-icon-192.png',
    badge: '/valtriox-icon-32.png',
    url: '/',
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
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
      tag: 'valtriox-notification',
      renotify: true,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ── Notification Click: focus or open the app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ── Helper: limit cache entries ──
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

// ── Fetch: strategy router ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ── CRITICAL: Bypass SW entirely for HTML navigations ──
  // HTML pages must NEVER be served from SW cache — they change per-deploy
  // (new JS chunk hashes) and per-user (SSR auth context). Let the browser's
  // native HTTP cache + ETag revalidation handle them. This is the fix for
  // the "stale page on every deploy" bug.
  if (request.mode === 'navigate' || request.destination === 'document') {
    return; // Don't call event.respondWith — let browser handle it
  }

  // Skip requests that should NEVER be cached
  if (NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // Strategy 1: API routes — Network First with API cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      event.respondWith(networkFirstWithApiCache(request));
    }
    return;
  }

  // Strategy 2: Static assets with hashed filenames (JS/CSS chunks, images)
  // — Stale-While-Revalidate. These are safe to cache indefinitely because
  // the filename hash changes on every deploy.
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot)$/) ||
    url.pathname.includes('/_next/static/') ||
    url.pathname.includes('/_next/image/')
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Strategy 3: Everything else (rare) — Network First, no HTML
  event.respondWith(networkFirst(request));
});

// ── Stale While Revalidate: serve cache immediately, update in background ──
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
        trimCache(STATIC_CACHE, MAX_STATIC_CACHE_ENTRIES);
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ── Network First: try network, fallback to cache ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Network First with API Cache: for API routes ──
async function networkFirstWithApiCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      trimCache(API_CACHE, MAX_API_CACHE_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'You are offline. Please check your connection.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ── Background Sync: sync pending requests when back online ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'valtriox-sync') {
    console.log('[SW v11] Background sync triggered');
  }
});

// ── Message handler: allow page to trigger SW update ──
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
