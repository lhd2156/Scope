import type mapboxgl from 'mapbox-gl';
import type { StyleSpecification } from 'mapbox-gl';

export type MapboxRuntime = typeof mapboxgl;
export type MapStyleValue = string | StyleSpecification;
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
export const TOKENLESS_MAP_STYLE_ID = 'tokenless-openstreetmap';
const TOKENLESS_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'openstreetmap',
      type: 'raster',
      source: 'openstreetmap',
      minzoom: 0,
      maxzoom: 19,
      paint: {
        'raster-brightness-min': 0.18,
        'raster-brightness-max': 0.82,
        'raster-contrast': 0.08,
        'raster-saturation': -0.12,
      },
    },
  ],
};

export function createTokenlessMapStyle(): StyleSpecification {
  return structuredClone(TOKENLESS_MAP_STYLE);
}

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

export function resolveConfiguredMapStyle(
  tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN,
  fallback = DEFAULT_MAP_STYLE,
  root: Element | null = typeof document === 'undefined' ? null : document.documentElement,
): MapStyleValue {
  return hasMapboxToken(tokenValue) ? resolveMapboxStyle(fallback, root) : createTokenlessMapStyle();
}

export function resolveConfiguredMapStyleKey(
  tokenValue: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN,
  fallback = DEFAULT_MAP_STYLE,
  root: Element | null = typeof document === 'undefined' ? null : document.documentElement,
): string {
  return hasMapboxToken(tokenValue) ? resolveMapboxStyle(fallback, root) : TOKENLESS_MAP_STYLE_ID;
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
