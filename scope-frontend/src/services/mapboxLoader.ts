import type mapboxgl from 'mapbox-gl';

export type MapboxRuntime = typeof mapboxgl;
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

let mapboxRuntimePromise: Promise<MapboxRuntime> | null = null;
let mapboxStylesPromise: Promise<unknown> | null = null;

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
      import('mapbox-gl'),
    ]).then(([, mapboxModule]) => mapboxModule.default as MapboxRuntime);
  }

  return mapboxRuntimePromise;
}

export async function loadConfiguredMapboxRuntime(
  tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN,
): Promise<MapboxRuntime> {
  const runtime = await loadMapboxRuntime();
  runtime.accessToken = getMapboxToken(tokenValue);
  return runtime;
}
