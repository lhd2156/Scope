import type mapboxgl from 'mapbox-gl';

export type MapboxRuntime = typeof mapboxgl;
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
export const LIGHT_MAP_STYLE = 'mapbox://styles/mapbox/outdoors-v12';
export const STREETS_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
export const SATELLITE_STREETS_MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

let mapboxRuntimePromise: Promise<MapboxRuntime> | null = null;
let mapboxStylesPromise: Promise<unknown> | null = null;
let mapboxWorkerPolicy: TrustedTypePolicy | null = null;

type TunableMapboxRuntime = MapboxRuntime & {
  prewarm?: () => void;
  workerCount?: number;
  workerUrl?: string | TrustedScriptURL;
};

export function getMapboxToken(tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN): string {
  return String(tokenValue ?? '').trim();
}

export function hasMapboxToken(tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN): boolean {
  return getMapboxToken(tokenValue).length > 0;
}

export function resolveMapboxStyle(
  fallback = DEFAULT_MAP_STYLE,
  root: Element | null = typeof document === 'undefined' ? null : document.documentElement,
): string {
  if (!root) {
    return fallback;
  }

  const configuredStyle = getComputedStyle(root)
    .getPropertyValue('--map-style')
    .trim()
    .replace(/^['"](.+)['"]$/, '$1');
  return configuredStyle || fallback;
}

export async function loadMapboxRuntime(): Promise<MapboxRuntime> {
  if (!mapboxRuntimePromise) {
    mapboxStylesPromise ??= import('mapbox-gl/dist/mapbox-gl.css');
    mapboxRuntimePromise = Promise.all([
      mapboxStylesPromise,
      import('mapbox-gl/dist/mapbox-gl-csp'),
      import('mapbox-gl/dist/mapbox-gl-csp-worker.js?url'),
    ]).then(([, mapboxModule, workerUrlModule]) => {
      const runtime = mapboxModule.default as TunableMapboxRuntime;
      runtime.workerUrl = createTrustedMapboxWorkerUrl(workerUrlModule.default);
      return runtime as MapboxRuntime;
    });
  }

  return mapboxRuntimePromise;
}

export async function loadConfiguredMapboxRuntime(
  tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN,
): Promise<MapboxRuntime> {
  const runtime = await loadMapboxRuntime();
  tuneMapboxRuntimeForDevice(runtime);
  runtime.accessToken = getMapboxToken(tokenValue);
  return runtime;
}

export async function prewarmConfiguredMapboxRuntime(
  tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN,
): Promise<MapboxRuntime | null> {
  if (!hasMapboxToken(tokenValue)) {
    return null;
  }

  const runtime = await loadConfiguredMapboxRuntime(tokenValue);
  try {
    (runtime as TunableMapboxRuntime).prewarm?.();
  } catch {
    // Prewarming is opportunistic; Mapbox will still initialize normally on mount.
  }

  return runtime;
}

function tuneMapboxRuntimeForDevice(runtime: MapboxRuntime): void {
  const tunableRuntime = runtime as TunableMapboxRuntime;
  if (typeof tunableRuntime.workerCount !== 'number') {
    return;
  }

  tunableRuntime.workerCount = resolveMapboxWorkerCount();
}

function createTrustedMapboxWorkerUrl(workerUrl: string): string | TrustedScriptURL {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return workerUrl;
  }

  mapboxWorkerPolicy ??= window.trustedTypes.createPolicy('scope-mapbox', {
    createScriptURL: (url) => url,
  });

  return mapboxWorkerPolicy.createScriptURL(workerUrl);
}

function resolveMapboxWorkerCount(): number {
  const hardwareConcurrency = typeof navigator === 'undefined'
    ? 0
    : Number(navigator.hardwareConcurrency ?? 0);

  if (!Number.isFinite(hardwareConcurrency) || hardwareConcurrency <= 4) {
    return 2;
  }

  if (hardwareConcurrency <= 8) {
    return 3;
  }

  return 4;
}
