// Service Worker for Pixel Blaster PWA
// This service worker enables offline functionality and manages caching

// CACHE VERSION MANAGEMENT
// IMPORTANT: Increment version number (v4 -> v5 -> v6, etc.) for EVERY new deployment
// This ensures users get the latest code without manual cache clearing
// The version change triggers update detection in the main app (game.js)
const CACHE_NAME = 'pixel-blaster-v5';
const RUNTIME_CACHE = 'pixel-blaster-runtime-v5';

// All assets needed for offline play
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/game.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache all essential assets
// When a new version is deployed, this event fires with the new service worker
// The skipWaiting() call allows the new worker to activate immediately when approved by user
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching all essential assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Immediately activate this service worker once installed
        // But wait for user confirmation via the update notification in game.js
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Failed to cache assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - offline-first strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Allow Supabase API calls to pass through (don't cache)
  if (url.origin.includes('supabase.co') || url.origin.includes('jsdelivr.net')) {
    event.respondWith(fetch(request));
    return;
  }

  // Skip other cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cache the new response for runtime
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline page for HTML requests
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Message event - handle commands from the main app
// This enables the update notification system
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // When user accepts the update in the UI, skip waiting and activate immediately
    // This will trigger the 'controllerchange' event in the main app, causing a reload
    console.log('Received SKIP_WAITING message, activating new service worker...');
    self.skipWaiting();
  }
});
