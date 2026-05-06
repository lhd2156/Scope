import { DEFAULT_MAP_STYLE } from '@/services/mapboxLoader';
import type { MapViewport } from '@/types';

export const UNITED_STATES_MAP_VIEWPORT: MapViewport = {
  center: [-98.5795, 39.8283],
  zoom: 3.25,
  style: DEFAULT_MAP_STYLE,
};

export const LOCALITY_MAP_ZOOM = 9.4;

export function cloneMapViewport(viewport: MapViewport): MapViewport {
  return {
    center: [...viewport.center] as [number, number],
    zoom: viewport.zoom,
    style: viewport.style,
  };
}
