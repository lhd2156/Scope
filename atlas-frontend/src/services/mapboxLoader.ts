import type mapboxgl from 'mapbox-gl';

export type MapboxRuntime = typeof mapboxgl;

let mapboxRuntimePromise: Promise<MapboxRuntime> | null = null;
let mapboxStylesPromise: Promise<unknown> | null = null;

export async function loadMapboxRuntime(): Promise<MapboxRuntime> {
  if (!mapboxRuntimePromise) {
    mapboxStylesPromise ??= import('mapbox-gl/dist/mapbox-gl.css');
    mapboxRuntimePromise = Promise.all([
      mapboxStylesPromise,
      import('mapbox-gl/dist/esm-min/mapbox-gl.js'),
    ]).then(([, mapboxModule]) => mapboxModule.default as MapboxRuntime);
  }

  return mapboxRuntimePromise;
}
