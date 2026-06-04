const SERVICE_WORKER_VERSION = 'v3';
const APP_SHELL_CACHE = `scope-shell-${SERVICE_WORKER_VERSION}`;
const STATIC_ASSET_CACHE = `scope-static-${SERVICE_WORKER_VERSION}`;
const NAVIGATION_CACHE = `scope-navigation-${SERVICE_WORKER_VERSION}`;
const START_URL = '/map?source=pwa';
const OFFLINE_URL = '/offline.html';
const APP_SHELL_URLS = [
  '/',
  '/map',
  START_URL,
  '/explore',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/mask-icon.svg',
  '/scope-icons.svg',
  '/social-preview.png',
  '/pwa/icons/apple-touch-icon-180.png',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
  '/pwa/icons/icon-maskable-192.png',
  '/pwa/icons/icon-maskable-512.png',
];
const STATIC_ASSET_PATTERN = /\.(?:js|css|png|svg|jpg|jpeg|webp|gif|woff2?|ttf|eot|json|webmanifest)$/i;
const CACHE_ALLOWLIST = [APP_SHELL_CACHE, STATIC_ASSET_CACHE, NAVIGATION_CACHE];
const CONTROL_CHARACTER_PATTERN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
  'g',
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !CACHE_ALLOWLIST.includes(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
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

  if (isStaticAssetRequest(requestUrl)) {
    event.respondWith(handleStaticAssetRequest(request, event));
  }
});

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event);
  const title = sanitizeNotificationCopy(payload.title || 'Scope update', 'Scope update');
  const options = {
    body: sanitizeNotificationCopy(payload.body || payload.message || 'A new Scope notification is ready.', 'A new Scope notification is ready.'),
    icon: '/pwa/icons/icon-192.png',
    badge: '/favicon.svg',
    tag: sanitizeNotificationCopy(payload.tag || payload.id || 'scope-notification', 'scope-notification'),
    renotify: Boolean(payload.renotify),
    data: {
      url: normalizeAppPath(payload.actionUrl || payload.url || '/notifications'),
      notificationId: sanitizeNotificationCopy(payload.notificationId || payload.id || '', ''),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(normalizeAppPath(event.notification?.data?.url || '/notifications'), self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client && new URL(client.url).origin === self.location.origin) {
            return client.focus().then(() => client.navigate(targetUrl));
          }
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});

function isStaticAssetRequest(requestUrl) {
  const requestKey = `${requestUrl.pathname}${requestUrl.search}`;

  return STATIC_ASSET_PATTERN.test(requestUrl.pathname) || APP_SHELL_URLS.includes(requestKey) || APP_SHELL_URLS.includes(requestUrl.pathname);
}

function parsePushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return {
      body: event.data.text(),
    };
  }
}

function sanitizeNotificationCopy(value, fallback) {
  return String(value || fallback)
    .replace(CONTROL_CHARACTER_PATTERN, '')
    .trim()
    .slice(0, 240) || fallback;
}

function normalizeAppPath(value) {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/notifications';
  }

  return candidate;
}

async function handleNavigationRequest(request) {
  const navigationCache = await caches.open(NAVIGATION_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await navigationCache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const appShellCache = await caches.open(APP_SHELL_CACHE);

    return (
      (await navigationCache.match(request)) ||
      (await appShellCache.match(START_URL)) ||
      (await appShellCache.match('/')) ||
      (await appShellCache.match(OFFLINE_URL))
    );
  }
}

async function handleStaticAssetRequest(request, event) {
  const staticAssetCache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await staticAssetCache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        await staticAssetCache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    event.waitUntil(networkResponsePromise);
    return cachedResponse;
  }

  const networkResponse = await networkResponsePromise;

  if (networkResponse) {
    return networkResponse;
  }

  const appShellCache = await caches.open(APP_SHELL_CACHE);

  return (await appShellCache.match(request)) || Response.error();
}
