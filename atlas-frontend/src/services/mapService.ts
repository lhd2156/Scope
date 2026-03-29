import api from '@/services/api';
import { mockSpots } from '@/services/mockData';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope } from '@/types';

const INTEL_BASE_PATH = '/api/intel';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  placeName: string;
  city?: string;
  country?: string;
}

function buildPlaceName(result: GeocodeResult): string {
  return [result.placeName, result.city, result.country].filter(Boolean).join(', ');
}

function distanceScore(firstLatitude: number, firstLongitude: number, secondLatitude: number, secondLongitude: number): number {
  const latitudeDistance = Math.abs(firstLatitude - secondLatitude);
  const longitudeDistance = Math.abs(firstLongitude - secondLongitude);
  return latitudeDistance + longitudeDistance;
}

export async function geocode(query: string, limit = 5): Promise<ApiEnvelope<GeocodeResult[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<GeocodeResult[]>>(`${INTEL_BASE_PATH}/geocode`, {
      params: { q: query, limit },
    });
    return data;
  } catch {
    const normalizedQuery = query.trim().toLowerCase();
    const matchedSpots = mockSpots
      .filter((spot) => [spot.title, spot.address, spot.city, spot.country].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
      .map<GeocodeResult>((spot) => ({
        latitude: spot.latitude,
        longitude: spot.longitude,
        placeName: spot.title,
        city: spot.city,
        country: spot.country,
      }));

    return paginateItems(matchedSpots.slice(0, limit), 1, limit);
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
  try {
    const { data } = await api.get<ApiEnvelope<GeocodeResult> | GeocodeResult>(`${INTEL_BASE_PATH}/reverse-geocode`, {
      params: { lat: latitude, lng: longitude },
    });
    return unwrapApiData(data);
  } catch {
    const nearestSpot = [...mockSpots].sort(
      (left, right) =>
        distanceScore(latitude, longitude, left.latitude, left.longitude) -
        distanceScore(latitude, longitude, right.latitude, right.longitude),
    )[0];

    if (!nearestSpot) {
      return {
        latitude,
        longitude,
        placeName: 'Pinned location',
      };
    }

    const fallbackResult: GeocodeResult = {
      latitude: nearestSpot.latitude,
      longitude: nearestSpot.longitude,
      placeName: nearestSpot.title,
      city: nearestSpot.city,
      country: nearestSpot.country,
    };

    return {
      ...fallbackResult,
      placeName: buildPlaceName(fallbackResult),
    };
  }
}
