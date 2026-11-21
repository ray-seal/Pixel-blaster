// Pixel Blaster service worker
// Versioned shell cache + separate runtime cache. Never allow an old runtime
// cache to shadow files from the current release.
const CACHE_NAME = 'pixel-blaster-v18';
const RUNTIME_CACHE = 'pixel-blaster-runtime-v10';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/ui-tweaks.css',
  '/neon-theme.css',
  '/game.js',
  '/edge-hazards.js',
  '/boost-system.js',
  '/install-prompt.js',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Never cache leaderboard/API traffic.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Always try the network for navigations, with the current shell as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html', { cacheName: CACHE_NAME }))
    );
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME)
      .then(cache => cache.match(request))
      .then(currentCached => {
        if (currentCached) return currentCached;
        return caches.open(RUNTIME_CACHE)
          .then(cache => cache.match(request))
          .then(runtimeCached => runtimeCached || fetch(request).then(response => {
            if (response && response.ok && response.type === 'basic') {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          }));
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
