import type { RouteCoordinate } from '@/services/roadRouteService';
import type { ScopeWasmClusterResult } from '@/services/wasmService';
import type { MapNearbyPlacePin, MapPoint } from '@/types';

export function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasValidLatitudeLongitude(latitude: number | undefined, longitude: number | undefined): boolean {
  return isFiniteNumber(latitude)
    && isFiniteNumber(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function hasUsableNearbyPlaceCoordinates(place: Pick<MapNearbyPlacePin, 'latitude' | 'longitude'>): boolean {
  return hasValidLatitudeLongitude(place.latitude, place.longitude);
}

export function hasValidRouteCoordinate(coordinate: RouteCoordinate): boolean {
  const [longitude, latitude] = coordinate;
  return hasValidLatitudeLongitude(latitude, longitude);
}

export function hasValidMapPointCoordinates(point: Pick<MapPoint, 'latitude' | 'longitude'>): boolean {
  return hasValidLatitudeLongitude(point.latitude, point.longitude);
}

export function isValidClusterEntry(
  entry: Pick<ScopeWasmClusterResult, 'latitude' | 'longitude' | 'screenX' | 'screenY' | 'pointCount'>,
): boolean {
  return hasValidLatitudeLongitude(entry.latitude, entry.longitude)
    && isFiniteNumber(entry.screenX)
    && isFiniteNumber(entry.screenY)
    && entry.pointCount > 0;
}
