import { cloneMapViewport, LOCALITY_MAP_ZOOM, UNITED_STATES_MAP_VIEWPORT } from '@/config/mapViewport';
import { geocode } from '@/services/mapService';
import type { MapViewport } from '@/types';
import { sanitizeSingleLineText } from '@/utils/sanitizers';

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

export function getUnitedStatesMapViewport(): MapViewport {
  return cloneMapViewport(UNITED_STATES_MAP_VIEWPORT);
}

export function getDefaultDiscoveryMapViewport(): MapViewport {
  return cloneMapViewport(UNITED_STATES_MAP_VIEWPORT);
}

export async function resolveHomeBaseMapViewport(homeBase: string): Promise<MapViewport | null> {
  const query = sanitizeSingleLineText(homeBase);
  if (!query) {
    return null;
  }

  const { data: results } = await geocode(query, 1);
  const result = results[0];
  if (!result || !isValidCoordinate(result.latitude, result.longitude)) {
    return null;
  }

  return {
    center: [result.longitude, result.latitude],
    zoom: LOCALITY_MAP_ZOOM,
    style: UNITED_STATES_MAP_VIEWPORT.style,
  };
}
