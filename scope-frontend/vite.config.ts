import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import istanbul from 'vite-plugin-istanbul';
import path from 'node:path';
import fs from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const realConfigDirectory = fs.realpathSync.native(configDirectory);
const GOOGLE_PLACES_FUEL_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.currentOpeningHours',
  'places.fuelOptions',
].join(',');
const GOOGLE_PLACES_PHOTO_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.photos',
].join(',');
const GOOGLE_PLACES_MAX_RESULT_COUNT = 20;
const GOOGLE_PLACES_PHOTO_MAX_RESULT_COUNT = 3;
const GOOGLE_PLACES_PHOTO_SEARCH_RADIUS_METERS = 1200;
const GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP = 5000;
const GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP = 1000;
const GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP = 1000;
const GOOGLE_PLACES_USAGE_FILE_NAME = '.scope-google-places-usage.json';
const GOOGLE_FUEL_TYPE_ALIASES: Record<string, string> = {
  REGULAR_UNLEADED: 'regular',
  MIDGRADE: 'midgrade',
  PREMIUM: 'premium',
  DIESEL: 'diesel',
  DIESEL_PLUS: 'diesel',
  SP91: 'regular',
  SP91_E10: 'regular',
  SP92: 'regular',
  SP95: 'premium',
  SP95_E10: 'premium',
  SP98: 'premium',
};
const GOOGLE_FUEL_MATCHES: Record<string, Set<string>> = {
  regular: new Set(['regular']),
  midgrade: new Set(['midgrade']),
  premium: new Set(['premium']),
  diesel: new Set(['diesel']),
};
const SCOPE_WASM_ARTIFACT_CANDIDATES = [
  { moduleFileName: 'scope_wasm.js', binaryFileName: 'scope_wasm.wasm' },
  { moduleFileName: 'scope_wasm.generated.js', binaryFileName: 'scope_wasm.generated.wasm' },
];

type GoogleFuelSortMode = 'closest' | 'best_price';
type GooglePlacesUsageSku = 'places_text_search_pro' | 'places_place_details_photos' | 'places_nearby_search_enterprise_atmosphere';

interface GoogleFuelPrice {
  fuelType: string;
  price: number;
  currency: string;
  updatedAt?: string;
}

interface GoogleFuelStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  fuelType: string;
  pricePerUnit: number | null;
  currency: string;
  isOpen: boolean | null;
  updatedAt?: string;
  prices: GoogleFuelPrice[];
  source: string;
}

interface GooglePlacePhotoLookup {
  configured: boolean;
  coverage: string;
  photoUrl?: string | null;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  source: string;
  license?: string;
}

interface GooglePlacesUsageCaps {
  textSearchPro: number;
  placeDetailsPhotos: number;
  nearbySearchEnterpriseAtmosphere: number;
}

function isReadableFile(filePath: string): boolean {
  try {
    const descriptor = fs.openSync(filePath, 'r');
    fs.closeSync(descriptor);
    return true;
  } catch {
    return false;
  }
}

function resolveReadableWasmArtifactPair(sourceDirectory: string) {
  return SCOPE_WASM_ARTIFACT_CANDIDATES.find((candidate) => (
    isReadableFile(path.resolve(sourceDirectory, candidate.moduleFileName))
    && isReadableFile(path.resolve(sourceDirectory, candidate.binaryFileName))
  )) ?? null;
}

function copyOptionalWasmArtifacts() {
  return {
    name: 'scope-copy-optional-wasm-artifacts',
    apply: 'build' as const,
    async closeBundle() {
      if (process.env.VITE_SKIP_OPTIONAL_WASM_COPY === 'true') {
        return;
      }

      const sourceDirectory = path.resolve(configDirectory, 'wasm/dist');
      if (!fs.existsSync(sourceDirectory)) {
        return;
      }

      const artifactPair = resolveReadableWasmArtifactPair(sourceDirectory);
      if (!artifactPair) {
        console.warn(`Skipping optional WASM copy because no readable artifact pair exists in ${sourceDirectory}`);
        return;
      }

      const targetDirectory = path.resolve(configDirectory, 'dist/wasm/dist');
      await mkdir(targetDirectory, { recursive: true });
      try {
        await copyFile(
          path.resolve(sourceDirectory, artifactPair.moduleFileName),
          path.resolve(targetDirectory, artifactPair.moduleFileName),
        );
        await copyFile(
          path.resolve(sourceDirectory, artifactPair.binaryFileName),
          path.resolve(targetDirectory, artifactPair.binaryFileName),
        );
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (code === 'EPERM' || code === 'EACCES') {
          console.warn(`Skipping optional WASM copy because ${sourceDirectory} is not readable: ${code}`);
          return;
        }

        throw error;
      }
    },
  };
}

function resolveWorkspaceMapboxToken(mode: string): string {
  const workspaceEnv = loadEnv(mode, path.resolve(configDirectory, '..'), '');
  const frontendEnv = loadEnv(mode, configDirectory, '');
  const tokenCandidates = [
    { name: 'process.env.VITE_MAPBOX_TOKEN', value: process.env.VITE_MAPBOX_TOKEN },
    { name: 'scope-frontend/.env VITE_MAPBOX_TOKEN', value: frontendEnv.VITE_MAPBOX_TOKEN },
    { name: 'workspace .env VITE_MAPBOX_TOKEN', value: workspaceEnv.VITE_MAPBOX_TOKEN },
    { name: 'process.env.MAPBOX_PUBLIC_TOKEN', value: process.env.MAPBOX_PUBLIC_TOKEN },
    { name: 'scope-frontend/.env MAPBOX_PUBLIC_TOKEN', value: frontendEnv.MAPBOX_PUBLIC_TOKEN },
    { name: 'workspace .env MAPBOX_PUBLIC_TOKEN', value: workspaceEnv.MAPBOX_PUBLIC_TOKEN },
    { name: 'process.env.MAPBOX_ACCESS_TOKEN', value: process.env.MAPBOX_ACCESS_TOKEN },
    { name: 'workspace .env MAPBOX_ACCESS_TOKEN', value: workspaceEnv.MAPBOX_ACCESS_TOKEN },
  ]
    .map((candidate) => ({ ...candidate, value: (candidate.value ?? '').trim() }))
    .filter((candidate) => candidate.value);
  const publicTokenCandidate = tokenCandidates.find((candidate) => candidate.value.startsWith('pk.'));

  if (publicTokenCandidate) {
    return publicTokenCandidate.value;
  }

  if (tokenCandidates.length > 0) {
    const configuredSources = tokenCandidates.map((candidate) => candidate.name).join(', ');
    throw new Error(
      `Scope frontend Mapbox token must be a public pk.* token because it is bundled into browser JavaScript. ` +
        `Set VITE_MAPBOX_TOKEN or MAPBOX_PUBLIC_TOKEN to a public token; invalid source(s): ${configuredSources}.`,
    );
  }

  return '';
}

function resolveWorkspaceGooglePlacesApiKey(mode: string): string {
  const workspaceEnv = loadEnv(mode, path.resolve(configDirectory, '..'), '');
  const frontendEnv = loadEnv(mode, configDirectory, '');
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    workspaceEnv.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    workspaceEnv.GOOGLE_MAPS_API_KEY ||
    frontendEnv.GOOGLE_PLACES_API_KEY ||
    frontendEnv.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function resolveWorkspaceGooglePlacesUsageCaps(mode: string): GooglePlacesUsageCaps {
  const workspaceEnv = loadEnv(mode, path.resolve(configDirectory, '..'), '');
  const frontendEnv = loadEnv(mode, configDirectory, '');
  const readCap = (key: string, fallback: number): number => {
    const value = process.env[key] ?? frontendEnv[key] ?? workspaceEnv[key];
    if (value === undefined) {
      return fallback;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : fallback;
  };

  return {
    textSearchPro: readCap('GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP', GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP),
    placeDetailsPhotos: readCap('GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP', GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP),
    nearbySearchEnterpriseAtmosphere: readCap(
      'GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP',
      GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP,
    ),
  };
}

function exposeWorkspaceMapboxToken(mode: string): string {
  const mapboxToken = resolveWorkspaceMapboxToken(mode);
  if (mapboxToken && !process.env.VITE_MAPBOX_TOKEN) {
    process.env.VITE_MAPBOX_TOKEN = mapboxToken;
  }

  return mapboxToken;
}

function clampNumber(value: string | null, fallback: number, min: number, max: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, min), max);
}

function normalizeFuelType(value: string | null): string {
  const normalizedValue = String(value ?? 'all').trim().toLowerCase();
  return ['all', 'regular', 'midgrade', 'premium', 'diesel'].includes(normalizedValue) ? normalizedValue : 'all';
}

function normalizeFuelSortMode(value: string | null): GoogleFuelSortMode {
  const normalizedValue = String(value ?? 'closest').trim().toLowerCase().replace('-', '_');
  return normalizedValue === 'best_price' ? 'best_price' : 'closest';
}

function calculateDistanceKm(
  originLatitude: number,
  originLongitude: number,
  latitude: number | null,
  longitude: number | null,
): number | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  const earthRadiusKm = 6371.0088;
  const startLatitude = (originLatitude * Math.PI) / 180;
  const endLatitude = (latitude * Math.PI) / 180;
  const latitudeDelta = ((latitude - originLatitude) * Math.PI) / 180;
  const longitudeDelta = ((longitude - originLongitude) * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))).toFixed(2));
}

function normalizeGoogleFuelType(value: unknown): string {
  const normalizedValue = String(value ?? '').trim().toUpperCase();
  return GOOGLE_FUEL_TYPE_ALIASES[normalizedValue] ?? (normalizedValue.toLowerCase() || 'all');
}

function parseGoogleMoney(value: unknown): number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const money = value as { units?: unknown; nanos?: unknown };
  const amount = Number(money.units ?? 0) + Number(money.nanos ?? 0) / 1_000_000_000;
  return amount > 0 ? Number(amount.toFixed(3)) : null;
}

function normalizeGooglePrice(value: unknown): GoogleFuelPrice | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as { type?: unknown; price?: unknown; updateTime?: unknown };
  const price = parseGoogleMoney(entry.price);
  if (price === null) {
    return null;
  }

  const money = entry.price as { currencyCode?: unknown };
  return {
    fuelType: normalizeGoogleFuelType(entry.type),
    price,
    currency: String(money.currencyCode ?? 'USD'),
    updatedAt: typeof entry.updateTime === 'string' ? entry.updateTime : undefined,
  };
}

function selectGoogleFuelPrice(place: Record<string, unknown>, requestedFuelType: string): [GoogleFuelPrice | null, GoogleFuelPrice[]] {
  const fuelOptions = place.fuelOptions && typeof place.fuelOptions === 'object'
    ? place.fuelOptions as { fuelPrices?: unknown }
    : null;
  const rawPrices = Array.isArray(fuelOptions?.fuelPrices) ? fuelOptions.fuelPrices : [];
  const prices = rawPrices
    .map(normalizeGooglePrice)
    .filter((price): price is GoogleFuelPrice => Boolean(price));

  if (requestedFuelType !== 'all') {
    const allowedTypes = GOOGLE_FUEL_MATCHES[requestedFuelType] ?? new Set([requestedFuelType]);
    const matchingPrices = prices.filter((price) => allowedTypes.has(price.fuelType));
    return [
      [...matchingPrices].sort((left, right) => left.price - right.price)[0] ?? null,
      prices,
    ];
  }

  return [
    [...prices].sort((left, right) => left.price - right.price)[0] ?? null,
    prices,
  ];
}

function normalizeGoogleFuelStation(
  place: Record<string, unknown>,
  requestedFuelType: string,
  originLatitude: number,
  originLongitude: number,
): GoogleFuelStation | null {
  const displayName = place.displayName && typeof place.displayName === 'object'
    ? place.displayName as { text?: unknown }
    : null;
  const location = place.location && typeof place.location === 'object'
    ? place.location as { latitude?: unknown; longitude?: unknown }
    : null;
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const [selectedPrice, prices] = selectGoogleFuelPrice(place, requestedFuelType);
  const openingHours = place.currentOpeningHours && typeof place.currentOpeningHours === 'object'
    ? place.currentOpeningHours as { openNow?: unknown }
    : null;
  const currency = selectedPrice?.currency ?? prices.find((price) => price.currency)?.currency ?? 'USD';
  const name = String(displayName?.text ?? '').trim() || 'Fuel station';

  return {
    id: String(place.id ?? name),
    name,
    brand: '',
    address: String(place.formattedAddress ?? ''),
    latitude,
    longitude,
    distanceKm: calculateDistanceKm(originLatitude, originLongitude, latitude, longitude),
    fuelType: selectedPrice?.fuelType ?? requestedFuelType,
    pricePerUnit: selectedPrice?.price ?? null,
    currency,
    isOpen: typeof openingHours?.openNow === 'boolean' ? openingHours.openNow : null,
    updatedAt: selectedPrice?.updatedAt,
    prices,
    source: 'Google Places',
  };
}

function normalizeGooglePlacePhotoText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function emptyGooglePlacePhotoLookup(configured: boolean, coverage: string): GooglePlacePhotoLookup {
  return {
    configured,
    coverage,
    photoUrl: null,
    source: 'Google Places',
    license: 'Google Maps Platform',
  };
}

function readGooglePlacesUsage(): { month: string; counters: Record<string, number> } {
  const usagePath = path.resolve(configDirectory, '..', GOOGLE_PLACES_USAGE_FILE_NAME);
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    const payload = fs.existsSync(usagePath)
      ? JSON.parse(fs.readFileSync(usagePath, 'utf8')) as { month?: unknown; counters?: unknown }
      : null;
    if (payload?.month === currentMonth && payload.counters && typeof payload.counters === 'object') {
      return {
        month: currentMonth,
        counters: payload.counters as Record<string, number>,
      };
    }
  } catch {
    // Reset corrupt local usage state below so the dev proxy remains usable.
  }

  return { month: currentMonth, counters: {} };
}

function writeGooglePlacesUsage(usage: { month: string; counters: Record<string, number> }): void {
  const usagePath = path.resolve(configDirectory, '..', GOOGLE_PLACES_USAGE_FILE_NAME);
  fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
}

function consumeGooglePlacesUsage(
  sku: GooglePlacesUsageSku,
  monthlyCap: number,
): { allowed: boolean; cap: number; used: number; remaining: number | null } {
  if (monthlyCap < 0) {
    return { allowed: true, cap: monthlyCap, used: 0, remaining: null };
  }

  const usage = readGooglePlacesUsage();
  const used = Number(usage.counters[sku] ?? 0);
  const remaining = monthlyCap - used;
  if (remaining < 1) {
    return { allowed: false, cap: monthlyCap, used, remaining: Math.max(remaining, 0) };
  }

  usage.counters[sku] = used + 1;
  writeGooglePlacesUsage(usage);
  return {
    allowed: true,
    cap: monthlyCap,
    used: usage.counters[sku],
    remaining: Math.max(monthlyCap - usage.counters[sku], 0),
  };
}

function googlePlacesCapCoverage(label: string, usage: { cap: number }): string {
  return `Google Places ${label} monthly free usage cap reached (${usage.cap}/month). Lookup stopped before pay-as-you-go usage.`;
}

function getGooglePlacePhotoDistance(place: Record<string, unknown>, originLatitude: number, originLongitude: number): number {
  const location = place.location && typeof place.location === 'object'
    ? place.location as { latitude?: unknown; longitude?: unknown }
    : null;
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  return calculateDistanceKm(
    originLatitude,
    originLongitude,
    Number.isFinite(latitude) ? latitude : null,
    Number.isFinite(longitude) ? longitude : null,
  ) ?? Number.MAX_SAFE_INTEGER;
}

function getGooglePlaceFirstPhoto(place: Record<string, unknown> | null): Record<string, unknown> | null {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  for (const photo of photos) {
    if (photo && typeof photo === 'object' && normalizeGooglePlacePhotoText((photo as Record<string, unknown>).name, 512)) {
      return photo as Record<string, unknown>;
    }
  }

  return null;
}

function getGooglePhotoAttribution(photo: Record<string, unknown> | null): { name?: string; uri?: string } {
  const attributions = Array.isArray(photo?.authorAttributions) ? photo.authorAttributions : [];
  for (const attribution of attributions) {
    if (!attribution || typeof attribution !== 'object') {
      continue;
    }

    const entry = attribution as Record<string, unknown>;
    const name = normalizeGooglePlacePhotoText(entry.displayName, 120);
    const uri = normalizeGooglePlacePhotoText(entry.uri, 2048);
    if (name || uri) {
      return {
        name: name || undefined,
        uri: uri || undefined,
      };
    }
  }

  return {};
}

async function lookupGooglePlacePhoto(
  apiKey: string,
  options: {
    query: string;
    address: string;
    latitude: number;
    longitude: number;
    maxWidthPx: number;
  },
  usageCaps: GooglePlacesUsageCaps,
): Promise<GooglePlacePhotoLookup> {
  const query = normalizeGooglePlacePhotoText(options.query, 160);
  if (!query) {
    return emptyGooglePlacePhotoLookup(Boolean(apiKey), 'A place name is required before loading a photo.');
  }

  if (!apiKey) {
    return emptyGooglePlacePhotoLookup(false, 'Set GOOGLE_PLACES_API_KEY in the workspace .env to show Google Places photos during local frontend dev.');
  }

  const searchUsage = consumeGooglePlacesUsage('places_text_search_pro', usageCaps.textSearchPro);
  if (!searchUsage.allowed) {
    return emptyGooglePlacePhotoLookup(true, googlePlacesCapCoverage('Text Search Pro', searchUsage));
  }

  const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_PLACES_PHOTO_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: [query, normalizeGooglePlacePhotoText(options.address, 220)].filter(Boolean).join(' ').slice(0, 260),
      maxResultCount: GOOGLE_PLACES_PHOTO_MAX_RESULT_COUNT,
      locationBias: {
        circle: {
          center: {
            latitude: options.latitude,
            longitude: options.longitude,
          },
          radius: GOOGLE_PLACES_PHOTO_SEARCH_RADIUS_METERS,
        },
      },
    }),
  });

  if (!searchResponse.ok) {
    return emptyGooglePlacePhotoLookup(true, `Google Places photo search failed with status ${searchResponse.status}.`);
  }

  const searchPayload = await searchResponse.json() as { places?: unknown };
  const place = (Array.isArray(searchPayload.places) ? searchPayload.places : [])
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .filter((entry) => Boolean(getGooglePlaceFirstPhoto(entry)))
    .sort((left, right) => (
      getGooglePlacePhotoDistance(left, options.latitude, options.longitude) -
      getGooglePlacePhotoDistance(right, options.latitude, options.longitude)
    ))[0] ?? null;
  const photo = getGooglePlaceFirstPhoto(place);
  const photoName = normalizeGooglePlacePhotoText(photo?.name, 512);
  if (!photoName) {
    return emptyGooglePlacePhotoLookup(true, 'Google Places did not return a photo for this place.');
  }

  const photoUsage = consumeGooglePlacesUsage('places_place_details_photos', usageCaps.placeDetailsPhotos);
  if (!photoUsage.allowed) {
    return emptyGooglePlacePhotoLookup(true, googlePlacesCapCoverage('Place Details Photos', photoUsage));
  }

  const mediaUrl = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  mediaUrl.searchParams.set('key', apiKey);
  mediaUrl.searchParams.set('maxWidthPx', String(options.maxWidthPx));
  mediaUrl.searchParams.set('skipHttpRedirect', 'true');

  const photoResponse = await fetch(mediaUrl);
  if (!photoResponse.ok) {
    return emptyGooglePlacePhotoLookup(true, `Google Places photo media failed with status ${photoResponse.status}.`);
  }

  const photoPayload = await photoResponse.json() as { photoUri?: unknown };
  const photoUrl = normalizeGooglePlacePhotoText(photoPayload.photoUri, 2048);
  if (!photoUrl) {
    return emptyGooglePlacePhotoLookup(true, 'Google Places did not return a usable photo URL.');
  }

  const attribution = getGooglePhotoAttribution(photo);
  return {
    configured: true,
    coverage: 'Google Places photo coverage for the clicked place when a place photo is available.',
    photoUrl,
    photoAttribution: attribution.name,
    photoAttributionUrl: attribution.uri,
    source: 'Google Places',
    license: 'Google Maps Platform',
  };
}

function compareGoogleFuelStations(sortMode: GoogleFuelSortMode) {
  return (left: GoogleFuelStation, right: GoogleFuelStation): number => {
    const leftDistance = left.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const rightDistance = right.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const leftPrice = left.pricePerUnit ?? Number.MAX_SAFE_INTEGER;
    const rightPrice = right.pricePerUnit ?? Number.MAX_SAFE_INTEGER;
    const leftMissingPrice = left.pricePerUnit === null;
    const rightMissingPrice = right.pricePerUnit === null;

    if (sortMode === 'best_price') {
      if (leftMissingPrice !== rightMissingPrice) {
        return leftMissingPrice ? 1 : -1;
      }

      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return leftDistance - rightDistance;
    }

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (leftMissingPrice !== rightMissingPrice) {
      return leftMissingPrice ? 1 : -1;
    }

    return leftPrice - rightPrice;
  };
}

function writeJsonResponse(response: import('node:http').ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function googleFuelDevProxyPlugin(mode: string) {
  const apiKey = resolveWorkspaceGooglePlacesApiKey(mode);
  const usageCaps = resolveWorkspaceGooglePlacesUsageCaps(mode);

  return {
    name: 'scope-google-fuel-dev-proxy',
    apply: 'serve' as const,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://scope.local');
        if (requestUrl.pathname === '/__scope-dev/place-photo') {
          if (request.method !== 'GET') {
            writeJsonResponse(response, 405, { error: { message: 'Method not allowed' } });
            return;
          }

          const latitude = clampNumber(requestUrl.searchParams.get('lat'), Number.NaN, -90, 90);
          const longitude = clampNumber(requestUrl.searchParams.get('lng'), Number.NaN, -180, 180);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            writeJsonResponse(response, 400, { error: { message: 'Latitude and longitude are required.' } });
            return;
          }

          const maxWidthPx = Math.round(clampNumber(requestUrl.searchParams.get('maxWidthPx'), 640, 128, 1600));
          try {
            const payload = await lookupGooglePlacePhoto(apiKey, {
              query: requestUrl.searchParams.get('q') ?? '',
              address: requestUrl.searchParams.get('address') ?? '',
              latitude,
              longitude,
              maxWidthPx,
            }, usageCaps);
            writeJsonResponse(response, 200, { data: payload });
          } catch {
            writeJsonResponse(response, 200, {
              data: emptyGooglePlacePhotoLookup(true, 'Google Places photo lookup is temporarily unavailable.'),
            });
          }
          return;
        }

        if (requestUrl.pathname !== '/__scope-dev/fuel/stations') {
          next();
          return;
        }

        if (request.method !== 'GET') {
          writeJsonResponse(response, 405, { error: { message: 'Method not allowed' } });
          return;
        }

        if (!apiKey) {
          writeJsonResponse(response, 200, {
            data: {
              configured: false,
              coverage: 'Set GOOGLE_PLACES_API_KEY in the workspace .env to show Google fuel prices during local frontend dev.',
              stations: [],
              source: 'Google Places',
              license: 'Google Maps Platform',
            },
          });
          return;
        }

        const latitude = clampNumber(requestUrl.searchParams.get('lat'), Number.NaN, -90, 90);
        const longitude = clampNumber(requestUrl.searchParams.get('lng'), Number.NaN, -180, 180);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          writeJsonResponse(response, 400, { error: { message: 'Latitude and longitude are required.' } });
          return;
        }

        const radiusKm = clampNumber(requestUrl.searchParams.get('radiusKm'), 10, 1, 50);
        const limit = Math.round(clampNumber(requestUrl.searchParams.get('limit'), 5, 1, 20));
        const fuelType = normalizeFuelType(requestUrl.searchParams.get('fuelType'));
        const sortMode = normalizeFuelSortMode(requestUrl.searchParams.get('sortBy'));
        const usage = consumeGooglePlacesUsage(
          'places_nearby_search_enterprise_atmosphere',
          usageCaps.nearbySearchEnterpriseAtmosphere,
        );
        if (!usage.allowed) {
          writeJsonResponse(response, 200, {
            data: {
              configured: true,
              coverage: googlePlacesCapCoverage('Nearby Search Enterprise + Atmosphere', usage),
              stations: [],
              source: 'Google Places',
              license: 'Google Maps Platform',
              radiusKm,
              sortBy: sortMode,
            },
          });
          return;
        }

        try {
          const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': GOOGLE_PLACES_FUEL_FIELD_MASK,
            },
            body: JSON.stringify({
              includedTypes: ['gas_station'],
              maxResultCount: GOOGLE_PLACES_MAX_RESULT_COUNT,
              rankPreference: 'DISTANCE',
              locationRestriction: {
                circle: {
                  center: {
                    latitude,
                    longitude,
                  },
                  radius: radiusKm * 1000,
                },
              },
            }),
          });

          if (!googleResponse.ok) {
            writeJsonResponse(response, 200, {
              data: {
                configured: true,
                coverage: `Google Places fuel lookup failed with status ${googleResponse.status}.`,
                stations: [],
                source: 'Google Places',
                license: 'Google Maps Platform',
                radiusKm,
                sortBy: sortMode,
              },
            });
            return;
          }

          const payload = await googleResponse.json() as { places?: unknown };
          const places = Array.isArray(payload.places) ? payload.places : [];
          const stations = places
            .filter((place): place is Record<string, unknown> => Boolean(place) && typeof place === 'object')
            .map((place) => normalizeGoogleFuelStation(place, fuelType, latitude, longitude))
            .filter((station): station is GoogleFuelStation => Boolean(station))
            .sort(compareGoogleFuelStations(sortMode))
            .slice(0, limit);

          writeJsonResponse(response, 200, {
            data: {
              configured: true,
              coverage: 'Google Places gas station coverage with fuel prices where Google has current station data.',
              stations,
              source: 'Google Places',
              license: 'Google Maps Platform',
              radiusKm,
              sortBy: sortMode,
            },
          });
        } catch {
          writeJsonResponse(response, 200, {
            data: {
              configured: true,
              coverage: 'Google Places fuel lookup is temporarily unavailable.',
              stations: [],
              source: 'Google Places',
              license: 'Google Maps Platform',
              radiusKm,
              sortBy: sortMode,
            },
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  let workspaceMapboxToken = '';
  if (mode !== 'test') {
    workspaceMapboxToken = exposeWorkspaceMapboxToken(mode);
  }

  return {
  root: realConfigDirectory,
  plugins: [
    vue(),
    ...(process.env.VITE_COVERAGE === 'true'
      ? [
          istanbul({
            include: ['src/**/*.{ts,vue}'],
            exclude: ['node_modules/**', 'tests/**'],
            extension: ['.ts', '.vue'],
            requireEnv: true,
            forceBuildInstrument: true,
            cwd: realConfigDirectory,
          }),
        ]
      : []),
    copyOptionalWasmArtifacts(),
    googleFuelDevProxyPlugin(mode),
  ],
  define: workspaceMapboxToken
    ? {
        'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(workspaceMapboxToken),
      }
    : undefined,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        configDirectory,
        realConfigDirectory,
        path.resolve(configDirectory, '..'),
        path.resolve(realConfigDirectory, '..'),
      ],
    },
    watch: {
      ignored: ['**/emsdk/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        ws: true,
      },
      '/media': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(realConfigDirectory, 'src'),
    },
  },
  build: {
    // mapbox-gl is intentionally isolated and lazy-loaded by the map service.
    // Keep the warning threshold just above that known vendor payload so any
    // future accidental mega-chunk still shows up during production builds.
    chunkSizeWarningLimit: 1_800,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        const warningId = 'id' in warning && typeof warning.id === 'string' ? warning.id.replace(/\\/g, '/') : '';

        if (
          warning.code === 'INVALID_ANNOTATION' &&
          warningId.includes('/node_modules/@microsoft/signalr/') &&
          warning.message.includes('#__PURE__')
        ) {
          return;
        }

        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          // Heavy map bundle is its own chunk so only map-bearing routes pay
          // the cost; other routes never download it.
          if (normalizedId.includes('/node_modules/mapbox-gl/')) {
            return 'mapbox-gl';
          }

          // SignalR is only used by authenticated realtime surfaces. Keep it
          // isolated so the unauthenticated shell never downloads it.
          if (normalizedId.includes('/node_modules/@microsoft/signalr/')) {
            return 'signalr';
          }

          // Framework vendor chunk: vue + vue-router + pinia + @vueuse are
          // imported by essentially every route, so splitting them into a
          // dedicated chunk lets the browser long-term-cache ~130 KB across
          // every app-code deploy. Without this, changes to app code bust the
          // cache for a file that also contains vendor JS that never changed.
          if (
            normalizedId.includes('/node_modules/vue/') ||
            normalizedId.includes('/node_modules/@vue/') ||
            normalizedId.includes('/node_modules/vue-router/') ||
            normalizedId.includes('/node_modules/pinia/') ||
            normalizedId.includes('/node_modules/@vueuse/')
          ) {
            return 'vue-vendor';
          }

          // Axios is used on almost every page for API calls; pin it to its
          // own chunk so a vue upgrade doesn't also bust the HTTP client cache.
          if (normalizedId.includes('/node_modules/axios/')) {
            return 'http-vendor';
          }

          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.d.ts',
        'src/assets/**',
        'src/main.ts',
        'src/mock/**',
        'src/types/**',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 95,
        statements: 94.9,
        functions: 95,
        branches: 80,
      },
    },
  },
  };
});
