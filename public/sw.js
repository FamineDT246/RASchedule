/**
 * RA Syncbot Service Worker
 *
 * Minimal service worker — required for Android Chrome to fire the
 * 'beforeinstallprompt' event (PWA installability check).
 *
 * Strategy: network-first for everything (we don't cache offline yet).
 * This keeps the app simple while satisfying the PWA installability
 * criteria. If you want true offline support later, add runtime caching
 * here.
 */

const SW_VERSION = 'ra-syncbot-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Network-first fetch handler (falls back to network on cache miss)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip cross-origin requests (analytics, fonts, etc.)
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Skip API requests — always hit the network
  if (url.pathname.startsWith('/api/')) return

  // Network-first: try the network, fall back to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
