import type { SpotSummary } from '@/types';

type SpotIdentityFields = Pick<SpotSummary, 'id' | 'title' | 'city' | 'latitude' | 'longitude'>;

function normalizeIdentityText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function getSpotCoordinateFingerprint(spot: Pick<SpotIdentityFields, 'latitude' | 'longitude'>): string {
  return Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)
    ? `${spot.latitude.toFixed(4)},${spot.longitude.toFixed(4)}`
    : '';
}

export function getSpotFingerprint(spot: Pick<SpotIdentityFields, 'title' | 'city' | 'latitude' | 'longitude'>): string {
  return [
    normalizeIdentityText(spot.title),
    normalizeIdentityText(spot.city),
    getSpotCoordinateFingerprint(spot),
  ].filter(Boolean).join('|');
}

export function getSpotDeduplicationKey(spot: SpotIdentityFields): string {
  return [spot.id, getSpotFingerprint(spot)].filter(Boolean).join('|');
}
