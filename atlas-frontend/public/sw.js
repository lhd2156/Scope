const CACHE_NAME = 'atlas-shell-v1';
const OFFLINE_URL = '/offline.html';
const APP_SHELL_URLS = ['/', OFFLINE_URL, '/manifest.webmanifest', '/favicon.svg', '/social-preview.png'];
const STATIC_ASSET_PATTERN = /\.(?:js|css|png|svg|jpg|jpeg|webp|gif|woff2?|ttf|eot|json)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (STATIC_ASSET_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || (await cache.match(OFFLINE_URL));
  }
}

async function handleStaticAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return cache.match(OFFLINE_URL);
  }
}
