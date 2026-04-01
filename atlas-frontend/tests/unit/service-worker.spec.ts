import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(testFilePath), '../..');
const serviceWorkerSource = readFileSync(path.join(projectRoot, 'public/sw.js'), 'utf8');
const ORIGIN = 'https://atlas.local';
const APP_SHELL_CACHE = 'atlas-shell-v2';
const STATIC_ASSET_CACHE = 'atlas-static-v2';
const NAVIGATION_CACHE = 'atlas-navigation-v2';

type RequestLike =
  | string
  | URL
  | Request
  | {
      url: string;
      method?: string;
      mode?: string;
      cache?: string;
    };

type ServiceWorkerEventMap = Record<string, Array<(event: any) => void>>;

function normalizeRequestUrl(input: RequestLike): URL {
  if (input instanceof URL) {
    return input;
  }

  if (typeof input === 'string') {
    return new URL(input, ORIGIN);
  }

  return new URL(input.url, ORIGIN);
}

function normalizeCacheKey(input: RequestLike): string {
  const url = normalizeRequestUrl(input);
  return `${url.pathname}${url.search}`;
}

function cloneResponse(response: Response | undefined): Response | undefined {
  return response ? response.clone() : undefined;
}

function createServiceWorkerHarness() {
  const listeners: ServiceWorkerEventMap = {};
  const cacheStores = new Map<string, Map<string, Response>>();
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const claimClients = vi.fn().mockResolvedValue(undefined);
  const fetchMock = vi.fn(async (input: RequestLike) => {
    const url = normalizeRequestUrl(input);
    const pathname = `${url.pathname}${url.search}`;
    const contentType = pathname.endsWith('.js') ? 'application/javascript' : 'text/html';

    return new Response(`network:${pathname}`, {
      status: 200,
      headers: { 'content-type': contentType },
    });
  });

  const caches = {
    open: vi.fn(async (cacheName: string) => {
      if (!cacheStores.has(cacheName)) {
        cacheStores.set(cacheName, new Map());
      }

      const store = cacheStores.get(cacheName)!;

      return {
        addAll: vi.fn(async (urls: string[]) => {
          for (const url of urls) {
            store.set(
              normalizeCacheKey(url),
              new Response(`precached:${normalizeCacheKey(url)}`, {
                status: 200,
                headers: { 'content-type': 'text/plain' },
              }),
            );
          }
        }),
        match: vi.fn(async (input: RequestLike) => cloneResponse(store.get(normalizeCacheKey(input)))),
        put: vi.fn(async (input: RequestLike, response: Response) => {
          store.set(normalizeCacheKey(input), response.clone());
        }),
      };
    }),
    keys: vi.fn(async () => Array.from(cacheStores.keys())),
    delete: vi.fn(async (cacheName: string) => cacheStores.delete(cacheName)),
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim: claimClients },
    skipWaiting,
    addEventListener: (type: string, handler: (event: any) => void) => {
      listeners[type] ??= [];
      listeners[type].push(handler);
    },
  };

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchMock,
    URL,
    Request,
    Response,
    Headers,
    console,
    Promise,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Error,
    TypeError,
  });

  new vm.Script(serviceWorkerSource, { filename: 'sw.js' }).runInContext(context);

  async function dispatch(type: string, overrides: Record<string, unknown> = {}) {
    const waitUntilPromises: Promise<unknown>[] = [];
    let responsePromise: Promise<Response | null> | undefined;

    const event = {
      ...overrides,
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromises.push(Promise.resolve(promise));
      },
      respondWith: (promise: Promise<Response | null>) => {
        responsePromise = Promise.resolve(promise);
      },
    };

    for (const handler of listeners[type] ?? []) {
      handler(event);
    }

    const response = responsePromise ? await responsePromise : null;
    await Promise.all(waitUntilPromises);

    return {
      response,
      waitUntilPromises,
      event,
    };
  }

  async function readCachedResponse(cacheName: string, requestLike: RequestLike): Promise<string | null> {
    const store = cacheStores.get(cacheName);
    const response = cloneResponse(store?.get(normalizeCacheKey(requestLike)));

    return response ? await response.text() : null;
  }

  return {
    caches,
    cacheStores,
    claimClients,
    dispatch,
    fetchMock,
    readCachedResponse,
    skipWaiting,
  };
}

describe('service worker offline caching', () => {
  it('precaches the public app shell and installable icon assets', async () => {
    const harness = createServiceWorkerHarness();

    await harness.dispatch('install');

    expect(harness.skipWaiting).toHaveBeenCalledTimes(1);
    expect(Array.from(harness.cacheStores.get(APP_SHELL_CACHE)?.keys() ?? [])).toEqual(
      expect.arrayContaining([
        '/',
        '/map',
        '/map?source=pwa',
        '/explore',
        '/offline.html',
        '/manifest.webmanifest',
        '/site.webmanifest',
        '/pwa/icons/icon-192.png',
        '/pwa/icons/icon-512.png',
        '/pwa/icons/icon-maskable-192.png',
        '/pwa/icons/icon-maskable-512.png',
      ]),
    );
  });

  it('cleans old cache versions during activation and claims open clients', async () => {
    const harness = createServiceWorkerHarness();
    harness.cacheStores.set('atlas-shell-v1', new Map([['/', new Response('legacy')]]));
    harness.cacheStores.set(APP_SHELL_CACHE, new Map([['/', new Response('current-shell')]]));
    harness.cacheStores.set(STATIC_ASSET_CACHE, new Map([['/assets/index.js', new Response('asset')]]));
    harness.cacheStores.set(NAVIGATION_CACHE, new Map([['/map', new Response('page')]]));

    await harness.dispatch('activate');

    expect(harness.caches.delete).toHaveBeenCalledWith('atlas-shell-v1');
    expect(harness.cacheStores.has('atlas-shell-v1')).toBe(false);
    expect(harness.cacheStores.has(APP_SHELL_CACHE)).toBe(true);
    expect(harness.cacheStores.has(STATIC_ASSET_CACHE)).toBe(true);
    expect(harness.cacheStores.has(NAVIGATION_CACHE)).toBe(true);
    expect(harness.claimClients).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cached PWA start url when navigation requests are offline', async () => {
    const harness = createServiceWorkerHarness();
    await harness.dispatch('install');
    harness.fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    const offlineNavigation = await harness.dispatch('fetch', {
      request: {
        url: `${ORIGIN}/map?source=pwa`,
        method: 'GET',
        mode: 'navigate',
        cache: 'default',
      },
    });

    expect(await offlineNavigation.response?.text()).toBe('precached:/map?source=pwa');
  });

  it('serves cached static assets immediately and refreshes them in the background', async () => {
    const harness = createServiceWorkerHarness();
    const assetRequest = {
      url: `${ORIGIN}/assets/index.js`,
      method: 'GET',
      mode: 'same-origin',
      cache: 'default',
    };

    harness.fetchMock.mockResolvedValueOnce(
      new Response('asset-v1', {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      }),
    );

    const firstResponse = await harness.dispatch('fetch', { request: assetRequest });

    expect(await firstResponse.response?.text()).toBe('asset-v1');
    expect(await harness.readCachedResponse(STATIC_ASSET_CACHE, assetRequest)).toBe('asset-v1');

    harness.fetchMock.mockResolvedValueOnce(
      new Response('asset-v2', {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      }),
    );

    const cachedResponse = await harness.dispatch('fetch', { request: assetRequest });

    expect(await cachedResponse.response?.text()).toBe('asset-v1');
    expect(await harness.readCachedResponse(STATIC_ASSET_CACHE, assetRequest)).toBe('asset-v2');
  });
});
