/**
 * RA Syncbot Service Worker
 *
 * Network-first strategy with runtime caching.
 *
 * - On install: pre-cache '/' so Chrome's offline installability check passes
 * - On fetch: try network, cache successful GETs, fall back to cache when offline
 * - On activate: clear old caches
 *
 * Required for Android Chrome to fire 'beforeinstallprompt'.
 */

const CACHE_NAME = 'ra-syncbot-cache-v2'

self.addEventListener('install', (event) => {
  // Pre-cache the root route so the app responds 200 when offline
  // (Chrome's PWA installability check requires this)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Clear old caches from previous SW versions
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name)
        })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Skip cross-origin requests (analytics, fonts, etc.)
  if (url.origin !== self.location.origin) return

  // Skip API requests — always hit the network
  if (url.pathname.startsWith('/api/')) return

  // Network-first: try network, cache the response, fall back to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Offline — try cache, then 503 fallback
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          })
        })
      })
  )
})
