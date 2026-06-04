import api from '@/services/api';
import { DEMO_MODE_ENABLED } from '@/services/demoMode';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, FuelStationLookup, FuelStationPrice } from '@/types';

const FUEL_BASE_PATH = '/api/intel/fuel/stations';
const CACHE_TTL_MS = 2 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 30 * 1000;
const DEMO_FUEL_PRICES_ENABLED = import.meta.env.VITE_ENABLE_DEMO_FUEL_PRICES === 'true';

type FuelType = 'all' | 'regular' | 'midgrade' | 'premium' | 'diesel';
type FuelSortMode = 'closest' | 'best_price';

interface FuelLookupOptions {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  fuelType?: FuelType;
  limit?: number;
  sortBy?: FuelSortMode;
}

interface CachedFuelLookup {
  expiresAt: number;
  payload: FuelStationLookup;
}

const lookupCache = new Map<string, CachedFuelLookup>();

const DEMO_FUEL_STATION_NAMES = [
  'Routeway Market Fuel',
  'Trailhead Travel Stop',
  'Scope Roadside Energy',
  'Crossroads Fuel Co.',
  'Waypoint Service Station',
];
const DEMO_FUEL_PRICE_OFFSETS: Record<Exclude<FuelType, 'all'>, number> = {
  regular: 0,
  midgrade: 0.28,
  premium: 0.58,
  diesel: 0.44,
};

function buildCacheKey(options: Required<FuelLookupOptions>): string {
  return [
    options.latitude.toFixed(3),
    options.longitude.toFixed(3),
    options.radiusKm,
    options.fuelType,
    options.sortBy,
    options.limit,
  ].join(':');
}

function sanitizeFuelStation(station: FuelStationPrice): FuelStationPrice {
  const name = String(station.name ?? 'Fuel station').trim() || 'Fuel station';
  const id = String(station.id ?? name).trim() || name || 'fuel-station';

  return {
    ...station,
    id,
    name,
    address: String(station.address ?? '').trim(),
    fuelType: station.fuelType || 'all',
    currency: station.currency || 'USD',
    pricePerUnit: Number.isFinite(Number(station.pricePerUnit)) ? Number(station.pricePerUnit) : null,
    distanceKm: Number.isFinite(Number(station.distanceKm)) ? Number(station.distanceKm) : undefined,
  };
}

function sanitizeFuelLookup(payload: FuelStationLookup): FuelStationLookup {
  return {
    configured: Boolean(payload.configured),
    coverage: String(payload.coverage ?? '').trim(),
    source: String(payload.source ?? '').trim() || 'Google Places',
    license: payload.license ? String(payload.license) : undefined,
    radiusKm: Number.isFinite(Number(payload.radiusKm)) ? Number(payload.radiusKm) : undefined,
    sortBy: payload.sortBy ? String(payload.sortBy) : undefined,
    stations: Array.isArray(payload.stations) ? payload.stations.map(sanitizeFuelStation) : [],
  };
}

function buildDemoFuelLookup(options: Required<FuelLookupOptions>): FuelStationLookup {
  const seed = Math.abs(Math.sin(options.latitude * 12.9898 + options.longitude * 78.233));
  const count = Math.max(0, Math.min(options.limit, DEMO_FUEL_STATION_NAMES.length));
  const demoFuelType: Exclude<FuelType, 'all'> = options.fuelType === 'all' ? 'regular' : options.fuelType;
  const stations = DEMO_FUEL_STATION_NAMES.slice(0, count).map((name, index): FuelStationPrice => {
    const priceOffset = ((Math.floor((seed + index) * 100) % 55) / 100) + index * 0.04;
    const fuelOffset = DEMO_FUEL_PRICE_OFFSETS[demoFuelType] ?? 0;
    return {
      id: `demo-fuel-${options.latitude.toFixed(3)}-${options.longitude.toFixed(3)}-${index}`,
      name,
      brand: 'Scope Demo',
      address: index === 0 ? 'Closest mapped route point' : `Route preview stop ${index + 1}`,
      latitude: options.latitude + (index * 0.008),
      longitude: options.longitude - (index * 0.008),
      distanceKm: Number((0.7 + index * 1.1).toFixed(1)),
      fuelType: demoFuelType,
      pricePerUnit: Number((3.08 + fuelOffset + priceOffset).toFixed(2)),
      currency: 'USD',
      isOpen: true,
    };
  });

  return sanitizeFuelLookup({
    configured: true,
    coverage: 'Demo fuel preview. Live routes use the Intel fuel endpoint backed by Google Places when configured.',
    source: 'Scope demo fuel preview',
    license: 'Local demo fixture',
    radiusKm: options.radiusKm,
    sortBy: options.sortBy,
    stations,
  });
}

async function getDevGoogleFuelStations(options: Required<FuelLookupOptions>): Promise<FuelStationLookup | null> {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || typeof fetch !== 'function' || typeof window === 'undefined') {
    return null;
  }

  const url = new URL('/__scope-dev/fuel/stations', window.location.origin);
  url.searchParams.set('lat', String(options.latitude));
  url.searchParams.set('lng', String(options.longitude));
  url.searchParams.set('radiusKm', String(options.radiusKm));
  url.searchParams.set('fuelType', options.fuelType);
  url.searchParams.set('limit', String(options.limit));
  url.searchParams.set('sortBy', options.sortBy);

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return null;
    }

    const payload = sanitizeFuelLookup(unwrapApiData(await response.json()));
    return payload.configured ? payload : null;
  } catch {
    return null;
  }
}

export async function getNearbyFuelStations(options: FuelLookupOptions): Promise<FuelStationLookup> {
  const normalizedOptions: Required<FuelLookupOptions> = {
    latitude: options.latitude,
    longitude: options.longitude,
    radiusKm: options.radiusKm ?? 10,
    fuelType: options.fuelType ?? 'all',
    limit: options.limit ?? 5,
    sortBy: options.sortBy ?? 'closest',
  };
  const cacheKey = buildCacheKey(normalizedOptions);
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  try {
    const { data } = await api.get<ApiEnvelope<FuelStationLookup> | FuelStationLookup>(FUEL_BASE_PATH, {
      params: {
        lat: normalizedOptions.latitude,
        lng: normalizedOptions.longitude,
        radiusKm: normalizedOptions.radiusKm,
        fuelType: normalizedOptions.fuelType,
        limit: normalizedOptions.limit,
        sortBy: normalizedOptions.sortBy,
      },
    });
    const payload = sanitizeFuelLookup(unwrapApiData(data));
    lookupCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });
    return payload;
  } catch {
    const devFuelLookup = await getDevGoogleFuelStations(normalizedOptions);
    if (devFuelLookup) {
      lookupCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload: devFuelLookup,
      });
      return devFuelLookup;
    }

    if (DEMO_MODE_ENABLED && DEMO_FUEL_PRICES_ENABLED) {
      const payload = buildDemoFuelLookup(normalizedOptions);
      lookupCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      });
      return payload;
    }

    const payload = sanitizeFuelLookup({
      configured: false,
      coverage: 'Google Places fuel lookup is unavailable right now.',
      source: 'Google Places',
      license: 'Google Maps Platform',
      radiusKm: normalizedOptions.radiusKm,
      sortBy: normalizedOptions.sortBy,
      stations: [],
    });
    lookupCache.set(cacheKey, {
      expiresAt: Date.now() + FALLBACK_CACHE_TTL_MS,
      payload,
    });
    return payload;
  }
}
