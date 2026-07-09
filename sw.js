/**
 * Reelix - Optimized Service Worker
 * - Network-first strategy with cache fallback
 * - API response caching with 24-hour TTL
 * - Offline support for critical app shell
 */

const CACHE_NAME = 'reelix-v2';
const API_CACHE_NAME = 'reelix-api-v2';

const SHELL_FILES = [
  '/index.html',
  '/browse.html',
  '/watch.html',
  '/signup.html',
  '/pricing.html',
  '/activate.html',
  '/manifest.json',
  '/styles.css',
  '/firebase-init.js',
  '/subscription-cache.js',
  '/app-main.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const API_CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const API_PATTERNS = [
  /api\.themoviedb\.org/,
  /firestore\.googleapis\.com/
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES).catch(() => {
        console.log('Some shell files not available yet');
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isApi = API_PATTERNS.some((p) => p.test(url.origin));

  if (isApi) {
    event.respondWith(networkFirstWithCache(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then((res) => {
        return (
          res ||
          fetch(event.request).catch(() =>
            caches.match('/index.html')
          )
        );
      })
    );
  }
});

/**
 * Network-first strategy with cache expiry check
 * Tries network first, falls back to cache if offline
 */
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      const cloned = response.clone();
      const responseToCache = new Response(cloned.body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers: new Headers(cloned.headers)
      });
      responseToCache.headers.set('X-Cache-Time', new Date().toISOString());
      cache.put(request, responseToCache);
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      const cacheTime = new Date(cached.headers.get('X-Cache-Time'));
      const now = new Date();
      if ((now - cacheTime) < API_CACHE_DURATION) {
        return cached;
      }
    }
    return new Response('Offline - no cached data available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}
