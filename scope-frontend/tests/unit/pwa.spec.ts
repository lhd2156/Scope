import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAppServiceWorker } from '@/utils/pwa';

const testFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(testFilePath), '../..');
const publicRoot = path.join(projectRoot, 'public');

interface ManifestIconEntry {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

function readJsonFile<T>(relativePath: string): T {
  const filePath = path.join(projectRoot, relativePath);
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function readHtmlDocument(relativePath: string): Document {
  const html = readFileSync(path.join(projectRoot, relativePath), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

function resolvePublicAssetPath(publicPath: string): string {
  return path.join(publicRoot, publicPath.replace(/^\//, ''));
}

function readPngDimensions(publicPath: string): { width: number; height: number } {
  const assetBuffer = readFileSync(resolvePublicAssetPath(publicPath));

  return {
    width: assetBuffer.readUInt32BE(16),
    height: assetBuffer.readUInt32BE(20),
  };
}

describe('registerAppServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, 'trustedTypes');
  });

  it('skips registration outside production builds', async () => {
    const register = vi.fn();

    await expect(
      registerAppServiceWorker({
        isProduction: false,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBeNull();

    expect(register).not.toHaveBeenCalled();
  });

  it('registers the shell service worker in production', async () => {
    const registration = { scope: '/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('uses a plain service worker URL when the window global is unavailable', async () => {
    const registration = { scope: '/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    vi.stubGlobal('window', undefined);

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('skips registration when service workers are unavailable or explicitly disabled', async () => {
    await expect(registerAppServiceWorker({ isProduction: true })).resolves.toBeNull();

    vi.stubEnv('VITE_DISABLE_SERVICE_WORKER', 'true');
    const register = vi.fn();
    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBeNull();

    expect(register).not.toHaveBeenCalled();
  });

  it('registers with a trusted script URL when Trusted Types are enforced', async () => {
    const registration = { scope: '/' } as ServiceWorkerRegistration;
    const trustedScriptUrl = { source: '/sw.js' };
    const createScriptURL = vi.fn().mockReturnValue(trustedScriptUrl);
    const createPolicy = vi.fn((_name: string, rules: { createScriptURL: (value: string) => string }) => ({
      createScriptURL: (value: string) => createScriptURL(rules.createScriptURL(value)),
    }));
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(window, 'trustedTypes', {
      configurable: true,
      value: { createPolicy },
    });

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBe(registration);

    expect(createPolicy).toHaveBeenCalledWith('scope-pwa', {
      createScriptURL: expect.any(Function),
    });
    expect(createScriptURL).toHaveBeenCalledWith('/sw.js');
    expect(register).toHaveBeenCalledWith(trustedScriptUrl, { scope: '/' });
  });

  it('falls back to a string service worker URL when Trusted Types policy creation fails', async () => {
    vi.resetModules();
    const registration = { scope: '/' } as ServiceWorkerRegistration;
    const createPolicy = vi.fn(() => {
      throw new Error('trusted types denied');
    });
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(window, 'trustedTypes', {
      configurable: true,
      value: { createPolicy },
    });

    const { registerAppServiceWorker: freshRegisterAppServiceWorker } = await import('@/utils/pwa');

    await expect(
      freshRegisterAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('returns null when registration fails', async () => {
    const register = vi.fn().mockRejectedValue(new Error('registration failed'));

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBeNull();
  });
});

describe('static PWA metadata', () => {
  it('ships a map-first manifest with installable any + maskable icons', () => {
    const manifest = readJsonFile<{
      id: string;
      start_url: string;
      scope: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: ManifestIconEntry[];
      shortcuts: Array<{ name: string; url: string }>;
    }>('public/manifest.webmanifest');
    const siteManifest = readJsonFile<{
      start_url: string;
      icons: ManifestIconEntry[];
      theme_color: string;
      background_color: string;
    }>('public/site.webmanifest');

    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/map?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#0f0f1a');
    expect(manifest.background_color).toBe('#0f0f1a');
    expect(manifest.shortcuts).toEqual([
      expect.objectContaining({ name: 'Open the map', url: '/map' }),
      expect.objectContaining({ name: 'Explore spots', url: '/explore' }),
    ]);

    expect(manifest.icons).toEqual([
      {
        src: '/pwa/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/pwa/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);

    for (const icon of manifest.icons) {
      const assetPath = resolvePublicAssetPath(icon.src);
      const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);

      expect(existsSync(assetPath)).toBe(true);
      expect(readPngDimensions(icon.src)).toEqual({ width: expectedWidth, height: expectedHeight });
    }

    expect(siteManifest.start_url).toBe(manifest.start_url);
    expect(siteManifest.theme_color).toBe(manifest.theme_color);
    expect(siteManifest.background_color).toBe(manifest.background_color);
    expect(siteManifest.icons).toEqual(manifest.icons);
  });

  it('publishes startup imagery, touch icons, and theme metadata in the app shell', () => {
    const htmlDocument = readHtmlDocument('index.html');
    const appleTouchIcon = htmlDocument.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const maskIcon = htmlDocument.querySelector<HTMLLinkElement>('link[rel="mask-icon"]');
    const manifestLink = htmlDocument.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const themeColorMeta = htmlDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const startupImages = Array.from(
      htmlDocument.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-startup-image"]'),
    );

    expect(themeColorMeta?.getAttribute('content')).toBe('#0f0f1a');
    expect(manifestLink?.getAttribute('href')).toBe('/manifest.webmanifest');
    expect(maskIcon?.getAttribute('href')).toBe('/mask-icon.svg');
    expect(maskIcon?.getAttribute('color')).toBe('#10b981');
    expect(appleTouchIcon?.getAttribute('href')).toBe('/pwa/icons/apple-touch-icon-180.png');
    expect(appleTouchIcon?.getAttribute('sizes')).toBe('180x180');
    expect(readPngDimensions('/pwa/icons/apple-touch-icon-180.png')).toEqual({ width: 180, height: 180 });

    const expectedStartupImages = new Map<string, { width: number; height: number }>([
      ['/pwa/splash/apple-splash-1170x2532.png', { width: 1170, height: 2532 }],
      ['/pwa/splash/apple-splash-2532x1170.png', { width: 2532, height: 1170 }],
      ['/pwa/splash/apple-splash-1536x2048.png', { width: 1536, height: 2048 }],
      ['/pwa/splash/apple-splash-2048x1536.png', { width: 2048, height: 1536 }],
      ['/pwa/splash/apple-splash-1668x2388.png', { width: 1668, height: 2388 }],
      ['/pwa/splash/apple-splash-2388x1668.png', { width: 2388, height: 1668 }],
    ]);

    expect(startupImages).toHaveLength(expectedStartupImages.size);

    for (const startupImage of startupImages) {
      const href = startupImage.getAttribute('href');
      const media = startupImage.getAttribute('media') ?? '';

      expect(href).not.toBeNull();
      expect(expectedStartupImages.has(href as string)).toBe(true);
      expect(media).toContain('-webkit-device-pixel-ratio');
      expect(media).toContain('orientation');
      expect(readPngDimensions(href as string)).toEqual(expectedStartupImages.get(href as string));
    }
  });
});
