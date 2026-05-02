// MARCALL service worker — minimal, network-first for the SPA shell.
// Goal: enable installability + offline fallback. We do NOT cache /api responses.

const CACHE_VERSION = 'marcall-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_SHELL).catch((err) => {
        // Don't block install if a single asset isn't ready yet.
        console.warn('[sw] precache partial:', err);
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept API, auth, webhooks, OAuth callbacks, or cross-origin requests.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/auth/')) return;
  if (url.pathname.startsWith('/webhooks/')) return;

  // Navigation requests: network-first with offline fallback to cached index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((c) => c || Response.error())),
    );
    return;
  }

  // Static assets: cache-first, fall back to network and store.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      }).catch(() => cached || Response.error());
    }),
  );
});
