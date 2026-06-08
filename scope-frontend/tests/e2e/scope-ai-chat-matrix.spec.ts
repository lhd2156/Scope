import type { Locator, Page, Route, TestInfo } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { expect, test, type ScopeApiMock } from './fixtures/scope-test';

const LOAD_COUNT_KEY = 'scope-e2e-scope-ai-chat-load-count';
const ASSISTANT_SURFACE_SELECTOR = '[data-test="trip-ai-response"], [data-test="trip-ai-place-results"]';

type PlannerField =
  | 'start'
  | 'end'
  | 'startDate'
  | 'endDate'
  | 'budgetMin'
  | 'budgetMax'
  | 'travelers'
  | 'mpg'
  | 'gasPrice';

interface ReloadBaseline {
  url: string;
  loadCount: string | null;
}

interface PanelMetrics {
  panelHeight: number;
  panelBottom: number;
  composerTop: number;
  composerBottom: number;
  bodyTop: number;
  bodyBottom: number;
  bodyScrollable: boolean;
  quickbarVisible: boolean;
}

interface PlannerSnapshot {
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  budgetMin: string;
  budgetMax: string;
  travelers: string;
  mpg: string;
  gasPrice: string;
  pace: string;
  interests: string[];
  fuelType: string;
}

interface FixtureCallSnapshot {
  geocodeQueries: string[];
  nearbyCalls: MatrixNearbyCall[];
  fuelCalls: MatrixFuelCall[];
  weatherCalls: MatrixWeatherCall[];
  ragCalls: string[];
}

interface MatrixNearbyCall {
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  body: unknown;
}

interface MatrixFuelCall {
  fuelType: string;
  sortBy: string;
  radiusKm: string | null;
  url: string;
}

interface MatrixWeatherCall {
  provider: 'backend' | 'openweathermap' | 'openmeteo' | 'openmeteo-air-quality';
  mode: MatrixFixtureState['weatherMode'];
  url: string;
}

interface ScopeAiTurnLog {
  index: number;
  prompt: string;
  promptWasRedacted: boolean;
  latestAssistantText: string;
  responseTimeMs: number;
  performanceBudgetMs: number;
  plannerBefore: PlannerSnapshot;
  plannerAfter: PlannerSnapshot;
  fixtureCalls: FixtureCallSnapshot;
  unsafeProviderTextDetected: boolean;
  cards: string[];
  chips: string[];
  quickSuggestions: string[];
  reload: {
    before: ReloadBaseline;
    after: ReloadBaseline;
    stable: boolean;
  };
  panelMetrics: PanelMetrics;
  browserErrors: string[];
  quality: {
    passed: boolean;
    checks: string[];
  };
}

interface ScopeAiTurnLogContext {
  fixtures: MatrixFixtureState;
  logs: ScopeAiTurnLog[];
  browserErrors: string[];
}

interface MatrixFixtureState {
  ambiguousSample: boolean;
  weatherMode: 'unavailable' | 'openweather' | 'openmeteo';
  ragMode: 'missing-route' | 'invented-live-facts';
  geocodeQueries: string[];
  nearbyCalls: MatrixNearbyCall[];
  fuelCalls: MatrixFuelCall[];
  weatherCalls: MatrixWeatherCall[];
  ragCalls: string[];
}

const TURN_LOG_CONTEXTS = new WeakMap<Page, ScopeAiTurnLogContext>();
const MAX_SCOPE_AI_CONFIGURED_REPLY_DELAY_MS = 10_000;
const SCOPE_AI_E2E_TIMING_BUFFER_MS = 2_000;

const UNSAFE_TEST_TERM_PARTS = [
  ['n', 'i', 'g', 'g', 'e', 'r'],
  ['n', 'i', 'g', 'g', 'a'],
  ['f', 'u', 'c', 'k'],
  ['s', 'h', 'i', 't'],
];

function escapeUnsafeTestPart(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUnsafeTestPattern(parts: string[]): RegExp {
  return new RegExp(`\\b${parts.map(escapeUnsafeTestPart).join('[\\W_]*')}\\b`, 'gi');
}

const UNSAFE_TEST_PATTERNS = UNSAFE_TEST_TERM_PARTS.map(buildUnsafeTestPattern);

function unsafeTestTerm(codes: number[]): string {
  return String.fromCharCode(...codes);
}

function containsUnsafeTestText(value: string | null | undefined): boolean {
  const text = String(value ?? '');
  return UNSAFE_TEST_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function sanitizeTestArtifactText(value: string | null | undefined): string {
  let next = String(value ?? '');
  for (const pattern of UNSAFE_TEST_PATTERNS) {
    pattern.lastIndex = 0;
    next = next.replace(pattern, '[redacted]');
  }
  return next.replace(/[ \t]{2,}/g, ' ').trim();
}

function normalizePromptForRoute(value: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function geocodeResult(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: overrides.id,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    placeName: overrides.placeName,
    formattedAddress: overrides.formattedAddress,
    address: overrides.address,
    city: overrides.city,
    country: overrides.country ?? 'United States',
    precision: overrides.precision ?? 'address',
    source: 'playwright-matrix',
  };
}

async function installScopeAiMatrixFixtures(page: Page): Promise<MatrixFixtureState> {
  const state: MatrixFixtureState = {
    ambiguousSample: false,
    weatherMode: 'unavailable',
    ragMode: 'missing-route',
    geocodeQueries: [],
    nearbyCalls: [],
    fuelCalls: [],
    weatherCalls: [],
    ragCalls: [],
  };

  await page.route('**/api/intel/geocode**', async (route) => {
    const url = new URL(route.request().url());
    const query = normalizePromptForRoute(url.searchParams.get('q'));
    state.geocodeQueries.push(query);

    if (query.includes('e1500') && query.includes('hollis')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-e1500-hollis',
            latitude: 34.693,
            longitude: -99.912,
            placeName: 'E1500 Road',
            formattedAddress: 'E1500 Road, Hollis, Oklahoma, United States',
            address: 'E1500 Road',
            city: 'Hollis',
            precision: 'street',
          }),
        ],
      });
      return;
    }

    if (query.includes('100') && query.includes('example')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-100-example',
            latitude: 39.0000,
            longitude: -96.0000,
            placeName: '100 Example Road',
            formattedAddress: '100 Example Road, Example City, Texas 11111, United States',
            address: '100 Example Road',
            city: 'Example City',
          }),
        ],
      });
      return;
    }

    if (query.includes('5555') && query.includes('zipless')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-5555-zipless',
            latitude: 39.0100,
            longitude: -96.0100,
            placeName: '5555 Zipless Road',
            formattedAddress: '5555 Zipless Road, Example City, Texas, United States',
            address: '5555 Zipless Road',
            city: 'Example City',
          }),
        ],
      });
      return;
    }

    if (query.includes('200') && query.includes('sample')) {
      const hasTexasQualifier = /\b(?:texas|tx|11111|example city)\b/.test(query);
      const farSampleMatches = [
        geocodeResult({
          id: 'matrix-200-sample-other',
          latitude: 29.9844,
          longitude: -90.1632,
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Other City, Louisiana 22222, United States',
          address: '200 Sample Avenue',
          city: 'Other City',
        }),
        geocodeResult({
          id: 'matrix-200-sample-remote',
          latitude: -33.9484,
          longitude: 150.9031,
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Remote City New South Wales 33333, Australia',
          address: '200 Sample Avenue',
          city: 'Remote City',
          country: 'Australia',
        }),
        geocodeResult({
          id: 'matrix-200-sample-third',
          latitude: 36.9739,
          longitude: -93.7179,
          placeName: '200 South Sample Drive',
          formattedAddress: '200 South Sample Drive, Third City, Missouri 44444, United States',
          address: '200 South Sample Drive',
          city: 'Third City',
        }),
      ];

      await fulfillJson(route, 200, {
        data: state.ambiguousSample && !hasTexasQualifier
          ? farSampleMatches
          : [
              geocodeResult({
                id: 'matrix-200-sample-example',
                latitude: 39.0002,
                longitude: -96.0002,
                placeName: '200 Sample Avenue',
                formattedAddress: '200 Sample Avenue, Example City, Texas 11111, United States',
                address: '200 Sample Avenue',
                city: 'Example City',
              }),
              ...farSampleMatches,
            ],
      });
      return;
    }

    if (query.includes('fort worth')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-fort-worth',
            latitude: 32.7555,
            longitude: -97.3308,
            placeName: 'Fort Worth',
            formattedAddress: 'Fort Worth, Texas, United States',
            city: 'Fort Worth',
            precision: 'city',
          }),
        ],
      });
      return;
    }

    if (query.includes('jamaica') || query.includes('north richland hills')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-jamaica-north-richland-hills',
            latitude: 32.8547,
            longitude: -97.2256,
            placeName: '5673 Jamaica Circle',
            formattedAddress: '5673 Jamaica Circle, North Richland Hills, Texas 76180, United States',
            address: '5673 Jamaica Circle',
            city: 'North Richland Hills',
          }),
        ],
      });
      return;
    }

    if (query.includes('oriental') || query.includes('arlington')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-oriental-arlington',
            latitude: 32.7473,
            longitude: -97.0831,
            placeName: '1205 Oriental Avenue',
            formattedAddress: '1205 Oriental Avenue, Arlington, Texas 76011, United States',
            address: '1205 Oriental Avenue',
            city: 'Arlington',
          }),
        ],
      });
      return;
    }

    if (query.includes('austin')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-austin',
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Austin',
            formattedAddress: 'Austin, Texas, United States',
            city: 'Austin',
            precision: 'city',
          }),
        ],
      });
      return;
    }

    if (query.includes('dallas')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-dallas',
            latitude: 32.7767,
            longitude: -96.797,
            placeName: 'Dallas',
            formattedAddress: 'Dallas, Texas, United States',
            city: 'Dallas',
            precision: 'city',
          }),
        ],
      });
      return;
    }

    if (query.includes('miami')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-miami',
            latitude: 25.7617,
            longitude: -80.1918,
            placeName: 'Miami',
            formattedAddress: 'Miami, Florida, United States',
            city: 'Miami',
            precision: 'city',
          }),
        ],
      });
      return;
    }

    if (query.includes('1600') && query.includes('pennsylvania')) {
      await fulfillJson(route, 200, {
        data: [
          geocodeResult({
            id: 'matrix-white-house',
            latitude: 38.8977,
            longitude: -77.0365,
            placeName: '1600 Pennsylvania Avenue Northwest',
            formattedAddress: '1600 Pennsylvania Avenue Northwest, Washington, District of Columbia 20500, United States',
            address: '1600 Pennsylvania Avenue Northwest',
            city: 'Washington',
          }),
        ],
      });
      return;
    }

    await fulfillJson(route, 200, { data: [] });
  });

  await page.route('**/api/intel/travel/nearby**', async (route) => {
    const requestBody = route.request().postDataJSON?.() as { category?: string } | undefined;
    const category = requestBody?.category === 'scenic' ? 'scenic' : 'recommended';
    state.nearbyCalls.push({
      category,
      latitude: Number((requestBody as { latitude?: number } | undefined)?.latitude),
      longitude: Number((requestBody as { longitude?: number } | undefined)?.longitude),
      radiusKm: Number((requestBody as { radiusKm?: number } | undefined)?.radiusKm),
      body: requestBody ?? null,
    });
    await fulfillJson(route, 200, {
      data: {
        configured: true,
        coverage: `Playwright ${category} endpoint recommendation fixture`,
        source: 'Scope + Google Places',
        category,
        radiusKm: 64,
        suggestions: [
          {
            id: 'matrix-endpoint-quartz-mountain',
            placeId: 'matrix-endpoint-quartz-mountain',
            title: 'Quartz Mountain State Park',
            subtitle: 'Scenic endpoint duplicate fixture entry that should not render twice.',
            address: '14722 Highway 44A, Lone Wolf, Oklahoma',
            latitude: 34.889,
            longitude: -99.303,
            category: 'park',
            source: 'google',
            sourceLabel: 'Playwright Google Places fixture',
            distanceKm: 52.4,
            rating: 4.7,
            reviewCount: 320,
            reason: 'Scenic endpoint duplicate candidate to prove card dedupe.',
            anchorId: 'resolved-start',
            anchorLabel: 'E1500 Road, Hollis',
          },
          {
            id: 'matrix-endpoint-quartz-mountain',
            placeId: 'matrix-endpoint-quartz-mountain',
            title: 'Quartz Mountain State Park',
            subtitle: 'Scenic endpoint with a real mapped place near the rural start.',
            address: '14722 Highway 44A, Lone Wolf, Oklahoma',
            latitude: 34.889,
            longitude: -99.303,
            category: 'park',
            source: 'google',
            sourceLabel: 'Playwright Google Places fixture',
            distanceKm: 52.4,
            rating: 4.7,
            reviewCount: 320,
            reason: category === 'scenic'
              ? 'Scenic lake and mountain finish that fits a view-forward route.'
              : 'Practical endpoint with a real address instead of a raw road guess.',
            anchorId: 'resolved-start',
            anchorLabel: 'E1500 Road, Hollis',
          },
          {
            id: 'matrix-endpoint-altus',
            placeId: 'matrix-endpoint-altus',
            title: 'Downtown Altus',
            subtitle: 'Practical endpoint with food, fuel, and services.',
            address: 'Altus, Oklahoma',
            latitude: 34.638,
            longitude: -99.333,
            category: 'shopping',
            source: 'google',
            sourceLabel: 'Playwright Google Places fixture',
            distanceKm: 38.1,
            reason: 'Good practical finish after a rural road start.',
            anchorId: 'resolved-start',
            anchorLabel: 'E1500 Road, Hollis',
          },
          {
            id: 'matrix-endpoint-western-prairie',
            placeId: 'matrix-endpoint-western-prairie',
            title: 'Museum of the Western Prairie',
            subtitle: 'Cultural endpoint with a clear address.',
            address: '1100 Memorial Drive, Altus, Oklahoma',
            latitude: 34.652,
            longitude: -99.306,
            category: 'museum',
            source: 'google',
            sourceLabel: 'Playwright Google Places fixture',
            distanceKm: 40.8,
            reason: 'A specific place to end and inspect before building.',
            anchorId: 'resolved-start',
            anchorLabel: 'E1500 Road, Hollis',
          },
        ],
      },
    });
  });

  await page.route('**/api/intel/fuel/stations**', async (route) => {
    const url = new URL(route.request().url());
    const fuelType = url.searchParams.get('fuelType') || 'regular';
    const sortBy = url.searchParams.get('sortBy') || 'closest';
    state.fuelCalls.push({
      fuelType,
      sortBy,
      radiusKm: url.searchParams.get('radiusKm'),
      url: route.request().url(),
    });
    await fulfillJson(route, 200, {
      data: {
        configured: true,
        coverage: 'Playwright live fuel fixture',
        source: 'Google Places fuel fixture',
        radiusKm: Number(url.searchParams.get('radiusKm') ?? 10),
        sortBy,
        stations: [
          {
            id: 'matrix-fuel-cheap',
            name: sortBy === 'best_price' ? 'Matrix Cheap Fuel' : 'Matrix Route Fuel',
            brand: 'Matrix',
            address: '100 Route Test Lane',
            latitude: 32.868,
            longitude: -97.216,
            distanceKm: sortBy === 'best_price' ? 2.4 : 0.8,
            fuelType,
            pricePerUnit: sortBy === 'best_price' ? 2.91 : 3.12,
            currency: 'USD',
            isOpen: true,
          },
          {
            id: 'matrix-fuel-near',
            name: 'Matrix Near Pump',
            brand: 'Matrix',
            address: '200 Local Road',
            latitude: 32.866,
            longitude: -97.214,
            distanceKm: 1.1,
            fuelType,
            pricePerUnit: 3.18,
            currency: 'USD',
            isOpen: true,
          },
        ],
      },
    });
  });

  await page.route('**/api/intel/weather/current**', async (route) => {
    const url = new URL(route.request().url());
    state.weatherCalls.push({
      provider: 'backend',
      mode: state.weatherMode,
      url: route.request().url(),
    });

    if (state.weatherMode === 'openmeteo') {
      await fulfillJson(route, 200, {
        data: {
          label: url.searchParams.get('q') || 'Route point',
          latitude: Number(url.searchParams.get('lat') ?? 0),
          longitude: Number(url.searchParams.get('lng') ?? 0),
          temperatureF: 71.6,
          condition: 'Partly Cloudy',
          windMph: 9.4,
          provider: 'openmeteo',
          providerLabel: 'Open-Meteo fallback',
          conditionCode: 2,
          isDaytime: true,
          airQuality: {
            index: 44,
            label: 'Good',
            scale: 'us',
          },
        },
      });
      return;
    }

    if (state.weatherMode === 'openweather') {
      await fulfillJson(route, 200, {
        data: {
          label: url.searchParams.get('q') || 'Miami, Florida, United States',
          latitude: Number(url.searchParams.get('lat') ?? 25.7617),
          longitude: Number(url.searchParams.get('lng') ?? -80.1918),
          temperatureF: 84.4,
          condition: 'Broken Clouds',
          windMph: 12.1,
          provider: 'openweather',
          providerLabel: 'OpenWeatherMap',
          conditionCode: 803,
          iconCode: '04d',
          isDaytime: true,
          airQuality: {
            index: 1,
            label: 'Good',
            scale: 'openweather',
          },
        },
      });
      return;
    }

    await fulfillJson(route, 200, {
      data: {
        label: url.searchParams.get('q') || 'Route point',
        latitude: Number(url.searchParams.get('lat') ?? 0),
        longitude: Number(url.searchParams.get('lng') ?? 0),
        provider: 'openmeteo',
        providerLabel: 'Scope weather fixture unavailable',
      },
    });
  });

  await page.route('**/api/intel/place-photo**', async (route) => {
    await fulfillJson(route, 200, {
      data: {
        configured: false,
        coverage: 'Playwright place photo fixture: no live photo provider.',
        source: 'Google Places photo fixture',
      },
    });
  });

  await page.route('**/api/content/trips**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (method === 'GET') {
      await fulfillJson(route, 200, {
        data: [],
        meta: {
          page: 1,
          pageSize: 12,
          total: 0,
          totalPages: 1,
        },
      });
      return;
    }

    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      await route.fallback();
      return;
    }

    const body = request.postDataJSON?.() as Record<string, unknown> | undefined;
    await fulfillJson(route, 200, {
      data: {
        id: 'matrix-autosaved-trip',
        title: String(body?.title ?? 'Matrix autosaved trip'),
        destination: String(body?.destination ?? ''),
        endDestination: String(body?.endDestination ?? ''),
        description: '',
        isPublic: false,
        startDate: String(body?.startDate ?? '2027-05-18'),
        endDate: String(body?.endDate ?? '2027-05-18'),
        budget: Number(body?.budget ?? 0),
        currency: 'USD',
        status: 'draft',
        spots: [],
        members: [],
      },
    });
  });

  await page.route('**/api/rag/scope-ai', async (route) => {
    const requestBody = route.request().postDataJSON?.() as { message?: string } | undefined;
    state.ragCalls.push(String(requestBody?.message ?? ''));
    await fulfillJson(route, 200, {
      response: state.ragMode === 'invented-live-facts'
        ? 'Weather for Austin is sunny, 80F, and gas is $2.11/gal near the destination.'
        : 'Tell me a start, end, and budget and I can help plan this trip.',
      model: 'playwright-stale-rag',
    });
  });

  await page.route('**/api/intel/agent/trip-chat', async (route) => {
    const requestBody = route.request().postDataJSON?.() as { message?: string } | undefined;
    state.ragCalls.push(String(requestBody?.message ?? ''));
    await fulfillJson(route, 200, {
      response: state.ragMode === 'invented-live-facts'
        ? 'Weather for Austin is sunny, 80F, and gas is $2.11/gal near the destination.'
        : 'Tell me a start, end, and budget and I can help plan this trip.',
      model: 'playwright-stale-trip-chat',
    });
  });

  await page.route('https://api.openweathermap.org/**', async (route) => {
    state.weatherCalls.push({
      provider: 'openweathermap',
      mode: state.weatherMode,
      url: route.request().url(),
    });
    const url = new URL(route.request().url());
    if (state.weatherMode === 'openweather') {
      if (url.pathname.includes('/air_pollution')) {
        await fulfillJson(route, 200, { list: [{ main: { aqi: 1 } }] });
        return;
      }

      await fulfillJson(route, 200, {
        name: 'Miami',
        coord: { lat: 25.7617, lon: -80.1918 },
        main: { temp: 84.4 },
        weather: [{ id: 803, description: 'broken clouds', icon: '04d' }],
        wind: { speed: 12.1 },
        dt: 1779120000,
        sys: { sunrise: 1779087600, sunset: 1779138600 },
      });
      return;
    }

    await fulfillJson(route, 200, { current: {} });
  });
  await page.route('https://api.open-meteo.com/**', async (route) => {
    state.weatherCalls.push({
      provider: 'openmeteo',
      mode: state.weatherMode,
      url: route.request().url(),
    });
    if (state.weatherMode === 'openmeteo') {
      await fulfillJson(route, 200, {
        current: {
          temperature_2m: 71.6,
          weather_code: 2,
          wind_speed_10m: 9.4,
          is_day: 1,
        },
      });
      return;
    }

    await fulfillJson(route, 200, { current: {} });
  });
  await page.route('https://air-quality-api.open-meteo.com/**', async (route) => {
    state.weatherCalls.push({
      provider: 'openmeteo-air-quality',
      mode: state.weatherMode,
      url: route.request().url(),
    });
    await fulfillJson(route, 200, state.weatherMode === 'openmeteo'
      ? { current: { us_aqi: 44 } }
      : { current: {} });
  });

  return state;
}

async function openScopeAiPlanner(page: Page, scopeApi: ScopeApiMock): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await scopeApi.seedSession(page, { email: 'louis@example.com' });
  await page.addInitScript((loadCountKey) => {
    window.localStorage.setItem('scope-analytics-consent', 'denied');
    const current = Number(window.sessionStorage.getItem(loadCountKey) ?? '0');
    window.sessionStorage.setItem(loadCountKey, String(current + 1));
  }, LOAD_COUNT_KEY);

  await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
  await expect(page.locator('[data-test="trip-ai-assist"]')).toBeVisible();
}

function assistantSurfaces(page: Page): Locator {
  return page.locator(ASSISTANT_SURFACE_SELECTOR);
}

function normalizeLogText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeDedupeKey(value: string): string {
  return normalizeLogText(value).toLowerCase();
}

function uniqueDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values.map(normalizeDedupeKey).filter(Boolean)) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

async function readPlannerSnapshot(page: Page): Promise<PlannerSnapshot> {
  const readInput = async (field: PlannerField): Promise<string> =>
    getPlannerFieldLocator(page, field).inputValue().catch(() => '');
  const readText = async (field: PlannerField): Promise<string> =>
    normalizeLogText(await getPlannerFieldLocator(page, field).innerText().catch(() => ''));
  const activeDataTest = async (selector: string, prefix: string): Promise<string> => {
    const dataTest = await page.locator(selector).first().getAttribute('data-test').catch(() => '');
    return String(dataTest ?? '').replace(prefix, '');
  };

  const interests = await page.locator('[data-test^="trip-interest-"].active').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-test') ?? '')
      .filter(Boolean)
      .map((value) => value.replace('trip-interest-', '')),
  ).catch(() => []);

  return {
    start: await readInput('start'),
    end: await readInput('end'),
    startDate: await readInput('startDate'),
    endDate: await readInput('endDate'),
    budgetMin: await readInput('budgetMin'),
    budgetMax: await readInput('budgetMax'),
    travelers: await readText('travelers'),
    mpg: await readInput('mpg'),
    gasPrice: await readInput('gasPrice'),
    pace: await activeDataTest('[data-test^="trip-pace-"].active', 'trip-pace-'),
    interests,
    fuelType: await activeDataTest('[data-test^="fuel-type-option-"].active', 'fuel-type-option-'),
  };
}

function snapshotFixtureCalls(fixtures: MatrixFixtureState): FixtureCallSnapshot {
  return {
    geocodeQueries: [...fixtures.geocodeQueries],
    nearbyCalls: fixtures.nearbyCalls.map((call) => ({ ...call })),
    fuelCalls: fixtures.fuelCalls.map((call) => ({ ...call })),
    weatherCalls: fixtures.weatherCalls.map((call) => ({ ...call })),
    ragCalls: [...fixtures.ragCalls],
  };
}

function diffFixtureCalls(before: FixtureCallSnapshot, after: FixtureCallSnapshot): FixtureCallSnapshot {
  return {
    geocodeQueries: after.geocodeQueries.slice(before.geocodeQueries.length),
    nearbyCalls: after.nearbyCalls.slice(before.nearbyCalls.length),
    fuelCalls: after.fuelCalls.slice(before.fuelCalls.length),
    weatherCalls: after.weatherCalls.slice(before.weatherCalls.length),
    ragCalls: after.ragCalls.slice(before.ragCalls.length),
  };
}

function getScopeAiTurnPerformanceBudgetMs(prompt: string, fixtureCalls: FixtureCallSnapshot): number {
  const normalized = normalizePromptForRoute(prompt);
  const configuredReplyDelayMs = getConfiguredScopeAiReplyDelayMs();
  const applyConfiguredDelay = (budgetMs: number): number =>
    budgetMs + configuredReplyDelayMs + SCOPE_AI_E2E_TIMING_BUFFER_MS;

  if (/\b(build|itinerary|tighten)\b/.test(normalized)) {
    return applyConfiguredDelay(45_000);
  }

  if (
    fixtureCalls.geocodeQueries.length ||
    fixtureCalls.nearbyCalls.length ||
    fixtureCalls.fuelCalls.length ||
    fixtureCalls.weatherCalls.length
  ) {
    return applyConfiguredDelay(25_000);
  }

  if (fixtureCalls.ragCalls.length) {
    return applyConfiguredDelay(20_000);
  }

  return applyConfiguredDelay(10_000);
}

function getConfiguredScopeAiReplyDelayMs(): number {
  const rawValue = process.env.VITE_SCOPE_AI_MIN_REPLY_MS;
  if (!rawValue) {
    return 0;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(MAX_SCOPE_AI_CONFIGURED_REPLY_DELAY_MS, Math.max(0, parsedValue));
}

function sanitizeFixtureCallsForArtifact(calls: FixtureCallSnapshot): FixtureCallSnapshot {
  return {
    geocodeQueries: calls.geocodeQueries.map(sanitizeTestArtifactText),
    nearbyCalls: calls.nearbyCalls.map((call) => ({
      ...call,
      body: JSON.parse(sanitizeTestArtifactText(JSON.stringify(call.body ?? null))),
    })),
    fuelCalls: calls.fuelCalls.map((call) => ({
      ...call,
      url: sanitizeTestArtifactText(call.url),
    })),
    weatherCalls: calls.weatherCalls.map((call) => ({
      ...call,
      url: sanitizeTestArtifactText(call.url),
    })),
    ragCalls: calls.ragCalls.map(sanitizeTestArtifactText),
  };
}

async function readLatestAssistantTurn(page: Page): Promise<Pick<ScopeAiTurnLog, 'latestAssistantText' | 'cards' | 'chips' | 'quickSuggestions'>> {
  const latestSurface = assistantSurfaces(page).last();
  const latestAssistantText = normalizeLogText(await latestSurface.innerText().catch(() => ''));
  const cards = (await latestSurface.locator('[data-test="trip-ai-place-result"]').allTextContents().catch(() => []))
    .map(normalizeLogText)
    .filter(Boolean);
  const chips = (await latestSurface.locator('[data-test="trip-ai-message-chip"]').allTextContents().catch(() => []))
    .map(normalizeLogText)
    .filter(Boolean);
  const quickSuggestions = (await page.locator('[data-test="trip-ai-quick-suggestion"]').allTextContents().catch(() => []))
    .map(normalizeLogText)
    .filter(Boolean);

  return {
    latestAssistantText,
    cards,
    chips,
    quickSuggestions,
  };
}

function enableScopeAiTurnLogging(page: Page, fixtures: MatrixFixtureState): ScopeAiTurnLogContext {
  const browserErrors = collectBrowserErrors(page);
  const context: ScopeAiTurnLogContext = {
    fixtures,
    logs: [],
    browserErrors,
  };
  TURN_LOG_CONTEXTS.set(page, context);
  return context;
}

function buildScopeAiTranscript(logs: ScopeAiTurnLog[]): string {
  return logs.map((log) => [
    `## Turn ${log.index}: ${log.prompt}`,
    '',
    `**Reply:** ${log.latestAssistantText || '(empty)'}`,
    '',
    `**Planner before:** ${JSON.stringify(log.plannerBefore)}`,
    '',
    `**Planner after:** ${JSON.stringify(log.plannerAfter)}`,
    '',
    `**Provider calls:** ${JSON.stringify(log.fixtureCalls)}`,
    '',
    log.cards.length ? `**Cards:**\n${log.cards.map((card) => `- ${card}`).join('\n')}` : '**Cards:** none',
    '',
    log.chips.length ? `**Chips:** ${log.chips.join(' | ')}` : '**Chips:** none',
    '',
    log.quickSuggestions.length ? `**Quick suggestions:** ${log.quickSuggestions.join(' | ')}` : '**Quick suggestions:** none',
    '',
    `**Reload stable:** ${log.reload.stable}`,
    '',
    `**Panel metrics:** ${JSON.stringify(log.panelMetrics)}`,
    '',
    `**Browser errors:** ${log.browserErrors.length ? log.browserErrors.join(' | ') : 'none'}`,
    '',
    `**Quality:** ${log.quality.passed ? 'passed' : 'failed'} (${log.quality.checks.join(', ')})`,
  ].join('\n')).join('\n\n---\n\n');
}

async function attachScopeAiTurnLogs(testInfo: TestInfo, context: ScopeAiTurnLogContext): Promise<void> {
  if (!context.logs.length) {
    return;
  }

  const jsonl = context.logs.map((log) => JSON.stringify(log)).join('\n');
  const transcript = buildScopeAiTranscript(context.logs);
  const jsonlPath = testInfo.outputPath('scope-ai-turn-log.jsonl');
  const transcriptPath = testInfo.outputPath('scope-ai-transcript.md');

  await fs.writeFile(jsonlPath, jsonl, 'utf8');
  await fs.writeFile(transcriptPath, transcript, 'utf8');

  await testInfo.attach('scope-ai-turn-log.jsonl', {
    path: jsonlPath,
    contentType: 'application/x-ndjson',
  });
  await testInfo.attach('scope-ai-transcript.md', {
    path: transcriptPath,
    contentType: 'text/markdown',
  });
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

function assertScopeAiTranscriptContract(context: ScopeAiTurnLogContext): void {
  const allArtifactText = context.logs.map((log) => [
    log.prompt,
    log.latestAssistantText,
    ...log.cards,
    ...log.chips,
    ...log.quickSuggestions,
    JSON.stringify(log.fixtureCalls),
  ].join(' ')).join('\n');

  expect(containsUnsafeTestText(allArtifactText), 'Unsafe text leaked into Scope AI proof artifacts').toBe(false);
  expect(context.logs.filter((log) => !log.quality.passed), 'Scope AI turn quality failures').toEqual([]);
  expect(context.logs.filter((log) => log.browserErrors.length), 'Scope AI browser error turns').toEqual([]);
  expect(context.logs.filter((log) => !log.reload.stable), 'Scope AI reload turns').toEqual([]);
  expect(context.logs.filter((log) => log.responseTimeMs > log.performanceBudgetMs), 'Scope AI slow turns').toEqual([]);

  const responseTimes = context.logs.map((log) => log.responseTimeMs);
  if (responseTimes.length >= 20) {
    const configuredReplyDelayMs = getConfiguredScopeAiReplyDelayMs();
    expect(percentile(responseTimes, 0.5), 'Scope AI median response time')
      .toBeLessThanOrEqual(10_000 + configuredReplyDelayMs + SCOPE_AI_E2E_TIMING_BUFFER_MS);
    expect(percentile(responseTimes, 0.95), 'Scope AI p95 response time')
      .toBeLessThanOrEqual(25_000 + configuredReplyDelayMs + SCOPE_AI_E2E_TIMING_BUFFER_MS);
  }
}

function assertScopeAiTurnQuality(log: ScopeAiTurnLog, context: ScopeAiTurnLogContext): void {
  const reply = log.latestAssistantText;
  const replyLower = reply.toLowerCase();
  const startKnown = Boolean(log.plannerAfter.start.trim());
  const endKnown = Boolean(log.plannerAfter.end.trim());

  log.quality.checks.push('no_browser_errors');
  expect(context.browserErrors, `Browser errors after prompt "${log.prompt}"`).toEqual([]);

  log.quality.checks.push('no_reload');
  expect(log.reload.stable, `Unexpected page reload after prompt "${log.prompt}"`).toBe(true);

  log.quality.checks.push('panel_visible');
  expect(log.panelMetrics.panelHeight).toBeGreaterThan(500);
  expect(log.panelMetrics.composerBottom).toBeLessThanOrEqual(log.panelMetrics.panelBottom + 2);
  expect(log.panelMetrics.composerTop).toBeGreaterThan(log.panelMetrics.bodyTop);
  expect(log.panelMetrics.quickbarVisible).toBe(true);

  log.quality.checks.push('response_time_budget');
  expect(log.responseTimeMs, `Slow Scope AI turn after prompt "${log.prompt}"`).toBeLessThanOrEqual(log.performanceBudgetMs);

  log.quality.checks.push('unsafe_language_redacted');
  const visibleText = [
    log.prompt,
    log.latestAssistantText,
    ...log.cards,
    ...log.chips,
    ...log.quickSuggestions,
    JSON.stringify(log.fixtureCalls),
  ].join(' ');
  expect(containsUnsafeTestText(visibleText), `Unsafe text leaked into visible artifacts after prompt "${log.prompt}"`).toBe(false);
  expect(log.unsafeProviderTextDetected, `Unsafe text leaked into provider/query calls after prompt "${log.prompt}"`).toBe(false);

  log.quality.checks.push('no_stale_missing_route_reply');
  if (startKnown) {
    expect(replyLower, `Reply asked for a start even though start is known after prompt "${log.prompt}"`).not.toMatch(/(?:tell me|add|need).{0,40}(?:start|starting point)/);
    expect(replyLower, `Reply asked for a real start even though start is known after prompt "${log.prompt}"`).not.toContain('set a real start point first');
  }
  if (endKnown) {
    expect(replyLower, `Reply asked for an end even though destination is known after prompt "${log.prompt}"`).not.toMatch(/(?:tell me|add|need).{0,40}(?:end|destination|final destination)/);
  }

  log.quality.checks.push('provider_source_disclosure');
  const hasWeatherFact = /\b\d{1,3}\s?F\b|\bAQI\b|\b\d+\s?mph\b|\b(?:sunny|cloudy|rain|snow|wind|conditions?)\b/i.test(reply);
  if (hasWeatherFact) {
    expect(reply, `Weather fact without source disclosure after prompt "${log.prompt}"`).toMatch(/Weather source:|configured frontend weather providers|did not guess|weather provider path|unavailable/i);
  }
  const hasFuelFact = /\$\d+(?:\.\d+)?\/gal|\bFuel near\b|\bMatrix (?:Cheap Fuel|Route Fuel|Near Pump)\b/i.test(reply);
  if (hasFuelFact) {
    expect(reply, `Fuel fact without source disclosure after prompt "${log.prompt}"`).toMatch(/Fuel source|configured fuel|fuel lookup|provider|source/i);
  }

  log.quality.checks.push('no_impossible_mutation_confirmation');
  const endDateConfirmation = reply.match(/Set the trip end date to (\d{4}-\d{2}-\d{2})/i);
  if (endDateConfirmation) {
    expect(log.plannerAfter.endDate).toBe(endDateConfirmation[1]);
  }
  const startDateConfirmation = reply.match(/Set the trip start date to (\d{4}-\d{2}-\d{2})/i);
  if (startDateConfirmation) {
    expect(log.plannerAfter.startDate).toBe(startDateConfirmation[1]);
  }
  const dateRangeConfirmation = reply.match(/Set the trip dates to (\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})/i);
  if (dateRangeConfirmation) {
    expect(log.plannerAfter.startDate).toBe(dateRangeConfirmation[1]);
    expect(log.plannerAfter.endDate).toBe(dateRangeConfirmation[2]);
  }
  const maxBudgetConfirmation = reply.match(/Set the max trip budget to \$(\d+)/i);
  if (maxBudgetConfirmation) {
    expect(log.plannerAfter.budgetMax).toBe(maxBudgetConfirmation[1]);
  }
  const budgetRangeConfirmation = reply.match(/Set the trip budget to \$(\d+) - \$(\d+)/i);
  if (budgetRangeConfirmation) {
    expect(log.plannerAfter.budgetMin).toBe(budgetRangeConfirmation[1]);
    expect(log.plannerAfter.budgetMax).toBe(budgetRangeConfirmation[2]);
  }
  const travelerConfirmation = reply.match(/Set the travel party to (\d+) traveler/i);
  if (travelerConfirmation) {
    expect(log.plannerAfter.travelers).toContain(travelerConfirmation[1]);
  }
  if (/Set the start place to/i.test(reply)) {
    expect(log.plannerAfter.start, `Start confirmation rendered but start field is empty after prompt "${log.prompt}"`).not.toBe('');
  }
  if (/Set the final destination to/i.test(reply)) {
    expect(log.plannerAfter.end, `End confirmation rendered but destination field is empty after prompt "${log.prompt}"`).not.toBe('');
  }

  log.quality.checks.push('no_duplicate_visible_artifacts');
  expect(uniqueDuplicateValues(log.cards), `Duplicate visible cards after prompt "${log.prompt}"`).toEqual([]);
  expect(uniqueDuplicateValues(log.chips), `Duplicate message chips after prompt "${log.prompt}"`).toEqual([]);
  expect(uniqueDuplicateValues(log.quickSuggestions), `Duplicate quick suggestions after prompt "${log.prompt}"`).toEqual([]);

  log.quality.checks.push('no_correction_word_geocode_leak');
  const leakedCorrectionQueries = log.fixtureCalls.geocodeQueries.filter((query) =>
    /\b(actually|actully|should|replace|change|use|start|end|destination|destnation|final|no)\b/i.test(query)
  );
  expect(leakedCorrectionQueries, `Correction words leaked into geocode queries after prompt "${log.prompt}"`).toEqual([]);

  log.quality.checks.push('no_bad_zip_on_zipless_address');
  if (/Set the start place to 5555 Zipless Road/i.test(reply)) {
    expect(reply, `Zipless provider result gained an invented ZIP after prompt "${log.prompt}"`).not.toMatch(/\b\d{5}\b/);
  } else if (/I found a few possible matches/i.test(reply) && /5555 Zipless Road/i.test(reply)) {
    const candidateText = reply.split(':').slice(1).join(':');
    expect(candidateText, `Zipless candidate gained an invented ZIP after prompt "${log.prompt}"`).not.toMatch(/5555 Zipless Road[^.;]*\b\d{5}\b/i);
  }

  const previous = context.logs.at(-2);
  if (previous && normalizeDedupeKey(previous.latestAssistantText) === normalizeDedupeKey(reply)) {
    log.quality.checks.push('duplicate_reply_has_reason');
    const samePrompt = normalizeDedupeKey(previous.prompt) === normalizeDedupeKey(log.prompt);
    const sameState = JSON.stringify(previous.plannerAfter) === JSON.stringify(log.plannerAfter);
    if (samePrompt && sameState) {
      expect(reply, `Repeated prompt/state produced duplicate reply instead of audited no-op after "${log.prompt}"`).toMatch(/No new change/i);
    }
  }
}

async function sendScopeAiPrompt(page: Page, prompt: string): Promise<void> {
  const safePromptLabel = sanitizeTestArtifactText(prompt);
  await test.step(`Scope AI prompt: ${safePromptLabel}`, async () => {
    const context = TURN_LOG_CONTEXTS.get(page);
    const plannerBefore = await readPlannerSnapshot(page);
    const reloadBefore = await getReloadBaseline(page);
    const fixtureBefore = context ? snapshotFixtureCalls(context.fixtures) : undefined;
    const before = await assistantSurfaces(page).count();
    const responseStartedAt = Date.now();

    await page.locator('[data-test="trip-ai-input"]').fill(prompt);
    await page.locator('[data-test="trip-ai-form"]').locator('button[type="submit"]').click();

    await expect.poll(async () => {
      const count = await assistantSurfaces(page).count();
      const submitText = await page.locator('[data-test="trip-ai-form"]').locator('button[type="submit"]').innerText().catch(() => '');
      return count > before && !submitText.includes('replaces');
    }, {
      timeout: 45_000,
      message: `Scope AI did not finish prompt: ${prompt}`,
    }).toBe(true);

    const responseTimeMs = Date.now() - responseStartedAt;

    if (!context || !fixtureBefore) {
      return;
    }

    const latestTurn = await readLatestAssistantTurn(page);
    const plannerAfter = await readPlannerSnapshot(page);
    const reloadAfter = await getReloadBaseline(page);
    const panelMetrics = await readPanelMetrics(page);
    const fixtureAfter = snapshotFixtureCalls(context.fixtures);
    const fixtureCalls = diffFixtureCalls(fixtureBefore, fixtureAfter);
    const unsafeProviderTextDetected = containsUnsafeTestText(JSON.stringify(fixtureCalls));
    const log: ScopeAiTurnLog = {
      index: context.logs.length + 1,
      prompt: safePromptLabel,
      promptWasRedacted: safePromptLabel !== prompt,
      latestAssistantText: latestTurn.latestAssistantText,
      responseTimeMs,
      performanceBudgetMs: getScopeAiTurnPerformanceBudgetMs(prompt, fixtureCalls),
      plannerBefore,
      plannerAfter,
      fixtureCalls: sanitizeFixtureCallsForArtifact(fixtureCalls),
      unsafeProviderTextDetected,
      cards: latestTurn.cards,
      chips: latestTurn.chips,
      quickSuggestions: latestTurn.quickSuggestions,
      reload: {
        before: reloadBefore,
        after: reloadAfter,
        stable: reloadBefore.url === reloadAfter.url && reloadBefore.loadCount === reloadAfter.loadCount,
      },
      panelMetrics,
      browserErrors: [...context.browserErrors],
      quality: {
        passed: false,
        checks: [],
      },
    };
    context.logs.push(log);

    try {
      assertScopeAiTurnQuality(log, context);
      log.quality.passed = true;
    } catch (error) {
      log.quality.passed = false;
      throw error;
    }
  });
}

async function expectLatestAiResponse(page: Page, expected: string | RegExp): Promise<void> {
  await expect(assistantSurfaces(page).last()).toContainText(expected);
}

function getPlannerFieldLocator(page: Page, field: PlannerField): Locator {
  const planner = page.locator('[data-test="trip-planner"]');
  switch (field) {
    case 'start':
      return planner.locator('[data-test="destination-input"]');
    case 'end':
      return planner.locator('[data-test="end-destination-input"]');
    case 'startDate':
      return planner.getByLabel('Start date');
    case 'endDate':
      return planner.getByLabel('End date');
    case 'budgetMin':
      return planner.locator('[data-test="budget-floor-input"]');
    case 'budgetMax':
      return planner.locator('[data-test="budget-ceiling-input"]');
    case 'travelers':
      return planner.locator('[data-test="traveler-count"]');
    case 'mpg':
      return planner.locator('[data-test="fuel-mpg-input"]');
    case 'gasPrice':
      return planner.locator('[data-test="fuel-price-input"]');
  }
}

async function expectPlannerField(page: Page, field: PlannerField, value: string | RegExp): Promise<void> {
  const locator = getPlannerFieldLocator(page, field);
  if (field === 'travelers') {
    await expect(locator).toContainText(value);
    return;
  }

  await expect(locator).toHaveValue(value);
}

async function expectPace(page: Page, pace: 'relaxed' | 'moderate' | 'packed'): Promise<void> {
  await expect(page.locator(`[data-test="trip-pace-${pace}"]`)).toHaveClass(/active/);
}

async function expectInterest(page: Page, interest: string): Promise<void> {
  await expect(page.locator(`[data-test="trip-interest-${interest}"]`)).toHaveClass(/active/);
}

async function expectFuelType(page: Page, fuelType: string): Promise<void> {
  await expect(page.locator(`[data-test="fuel-type-option-${fuelType}"]`)).toHaveClass(/active/);
}

async function getReloadBaseline(page: Page): Promise<ReloadBaseline> {
  return {
    url: page.url(),
    loadCount: await page.evaluate((loadCountKey) => window.sessionStorage.getItem(loadCountKey), LOAD_COUNT_KEY),
  };
}

async function expectNoReload(page: Page, baseline: ReloadBaseline): Promise<void> {
  expect(page.url()).toBe(baseline.url);
  await expect.poll(async () => page.evaluate((loadCountKey) => window.sessionStorage.getItem(loadCountKey), LOAD_COUNT_KEY)).toBe(baseline.loadCount);
}

async function readPanelMetrics(page: Page): Promise<PanelMetrics> {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-test="trip-ai-assist"]');
    const composer = document.querySelector('[data-test="trip-ai-form"]');
    const body = document.querySelector('.trip-ai-assist__body');
    const quickbar = document.querySelector('[data-test="trip-ai-quickbar"], [data-test="trip-ai-suggestion"]');
    const panelRect = panel?.getBoundingClientRect();
    const composerRect = composer?.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    const quickbarRect = quickbar?.getBoundingClientRect();

    return {
      panelHeight: panelRect?.height ?? 0,
      panelBottom: panelRect?.bottom ?? 0,
      composerTop: composerRect?.top ?? 0,
      composerBottom: composerRect?.bottom ?? 0,
      bodyTop: bodyRect?.top ?? 0,
      bodyBottom: bodyRect?.bottom ?? 0,
      bodyScrollable: body ? body.scrollHeight > body.clientHeight : false,
      quickbarVisible: Boolean(quickbarRect && quickbarRect.width > 0 && quickbarRect.height > 0),
    };
  });
}

async function expectComposerVisibleAndPanelFixed(page: Page, baseline?: PanelMetrics): Promise<PanelMetrics> {
  const metrics = await readPanelMetrics(page);
  expect(metrics.panelHeight).toBeGreaterThan(500);
  expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.panelBottom + 2);
  expect(metrics.composerTop).toBeGreaterThan(metrics.bodyTop);
  expect(metrics.quickbarVisible).toBe(true);

  if (baseline) {
    expect(Math.abs(metrics.panelHeight - baseline.panelHeight)).toBeLessThanOrEqual(4);
  }

  return metrics;
}

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/^Failed to load resource:/i.test(message.text())) {
      const location = message.location();
      const source = location.url
        ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})`
        : '';
      errors.push(`${message.text()}${source}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.stack || error.message);
  });
  return errors;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickFuzz<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length] as T;
}

function perturbScopeAiPrompt(base: string, index: number, random: () => number): string {
  let prompt = base;
  const transforms = [
    (value: string) => value.toUpperCase(),
    (value: string) => value.replace(/\s+/g, '   '),
    (value: string) => `${pickFuzz(['hey', 'yo', 'pls', 'please', 'ok so'], random)} ${value}`,
    (value: string) => `${value}${pickFuzz(['!!!', '???', '...', '?!?', ' --'], random)}`,
    (value: string) => value.replace(/\bstart\b/gi, pickFuzz(['strt', 'START', 'starting place'], random)),
    (value: string) => value.replace(/\bdestination\b/gi, pickFuzz(['destnation', 'final dest', 'end place'], random)),
    (value: string) => value.replace(/\bweather\b/gi, pickFuzz(['wether', 'forecast', 'weather'], random)),
    (value: string) => value.replace(/\bbudget\b/gi, pickFuzz(['budgte', 'budget', 'spend'], random)),
    (value: string) => `${value} ${pickFuzz(['thanks', 'for real', 'if that makes sense', 'no guessing'], random)}`,
  ];

  const transformCount = 1 + (index % 3);
  for (let i = 0; i < transformCount; i += 1) {
    prompt = pickFuzz(transforms, random)(prompt);
  }

  return prompt.replace(/\s+/g, ' ').trim();
}

function buildScopeAiFuzzPrompts(count = 120): string[] {
  const severe = unsafeTestTerm([110, 105, 103, 103, 101, 114]);
  const commonProfanity = unsafeTestTerm([102, 117, 99, 107]);
  const bases = [
    'start 100 Example Road',
    'start actually 200 Sample Ave Example City TX 11111',
    'destination is Austin',
    'change destination to Dallas',
    'start 100 Example Road and start date 2027-05-17 and diesel fuel',
    'end Austin and max budget 700 and party of 4',
    'trip from 2027-05-17 to 2027-05-18',
    'end date maybe May 18 2027',
    'budget ceiling 400',
    'between 400 and 600',
    'party of 4',
    'solo trip',
    'make pace chill',
    'packed pace',
    'vibe food scenic nightlife',
    'nature culture shopping adventure',
    'weather for this route',
    'weather for Dallas',
    'find cheapest diesel within 10 mi',
    'find nearby coffee spots',
    'what should I pack for this trip',
    'add sunscreen to packing',
    'remove sunscreen from packing',
    'find practical endpoints',
    'find scenic endpoints',
    'where should we end from E1500 Road, Hollis',
    'show more endpoint ideas',
    'check route status',
    'tighten this route',
    'build the itinerary',
    'undo',
    'help',
    'asdkj qweqwe route???',
    `start 100 Example Road ${severe}`,
    `weather for Dallas ${commonProfanity}`,
    `find cheap gas ${severe}`,
    `yo ${commonProfanity} change start to 200 Sample Ave Example City TX 11111`,
  ];
  const random = createSeededRandom(0x5c0f3a11);
  const prompts: string[] = [];

  for (let index = 0; prompts.length < count; index += 1) {
    prompts.push(perturbScopeAiPrompt(bases[index % bases.length] as string, index, random));
  }

  return prompts;
}

test.afterEach(async ({ page }, testInfo) => {
  const context = TURN_LOG_CONTEXTS.get(page);
  if (!context) {
    return;
  }

  let contractError: unknown;
  try {
    assertScopeAiTranscriptContract(context);
  } catch (error) {
    contractError = error;
  } finally {
    await attachScopeAiTurnLogs(testInfo, context);
    TURN_LOG_CONTEXTS.delete(page);
  }

  if (contractError) {
    throw contractError;
  }
});

test.describe('Scope AI chat prompt matrix', () => {
  test('corrects start and destination commands without leaking correction words into geocode', async ({ page, scopeApi }) => {
    test.setTimeout(420_000);
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baseline = await getReloadBaseline(page);

    const startCorrections = [
      'START ACTUALLY 200 SAMPLE AVE EXAMPLE CITY TX 11111',
      'start is actually 200 Sample Ave Example City TX 11111',
      'no start should be 200 Sample Ave Example City TX 11111',
      'change start from 100 Example Road to 200 Sample Ave Example City TX 11111',
      'replace start with 200 Sample Ave Example City TX 11111',
      'use 200 Sample Ave Example City TX 11111 as the start',
      'can you sstart at 200 Sample Ave',
    ];

    for (const prompt of startCorrections) {
      fixtures.ambiguousSample = false;
      await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD');
      await expectPlannerField(page, 'start', /100 Example Road/);

      await sendScopeAiPrompt(page, prompt);
      await expectLatestAiResponse(page, /Set the start place to 200 Sample Avenue, Example City/i);
      await expectPlannerField(page, 'start', /200 Sample Avenue, Example City/);
      await expectPlannerField(page, 'end', '');
    }

    const endCorrections = [
      'END ACTUALLY Austin',
      'destination is actually Austin',
      'no destination should be Austin',
      'change end from Dallas to Austin',
      'replace final destination with Austin',
      'use Austin as the final destination',
    ];

    for (const prompt of endCorrections) {
      await sendScopeAiPrompt(page, 'end Dallas');
      await expectPlannerField(page, 'end', /Dallas, Texas/);

      await sendScopeAiPrompt(page, prompt);
      await expectLatestAiResponse(page, /Set the final destination to Austin, Texas/i);
      await expectPlannerField(page, 'start', /200 Sample Avenue, Example City/);
      await expectPlannerField(page, 'end', /Austin, Texas/);
    }

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD');
    await expectPlannerField(page, 'start', /100 Example Road/);
    fixtures.ambiguousSample = true;

    await sendScopeAiPrompt(page, 'START ACTUALLY 200 SAMPLE AVE');
    await expectLatestAiResponse(page, /I found a few possible matches for the start place "200 SAMPLE AVE"/i);
    await expect(assistantSurfaces(page).last()).toContainText('200 Sample Avenue, Other City, Louisiana 22222');
    await expectPlannerField(page, 'start', /100 Example Road/);

    await sendScopeAiPrompt(page, 'is there one in Texas');
    await expectLatestAiResponse(page, /Set the start place to 200 Sample Avenue, Example City, Texas 11111/i);
    await expectPlannerField(page, 'start', /200 Sample Avenue, Example City, Texas 11111/);
    expect(fixtures.geocodeQueries.some((query) =>
      query.includes('200')
      && /\b(?:texas|tx|11111|example city)\b/.test(query)
    )).toBe(true);

    const leakedCorrectionQueries = fixtures.geocodeQueries.filter((query) =>
      query.includes('200')
      && /\b(actually|should|replace|change|use|start|end)\b/.test(query)
    );
    expect(leakedCorrectionQueries).toEqual([]);
    await expectNoReload(page, baseline);
  });

  test('verifies address ZIPs through provider results and never invents missing postal codes', async ({ page, scopeApi }) => {
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baseline = await getReloadBaseline(page);

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD 11111');
    await expectLatestAiResponse(page, /Set the start place to 100 Example Road, Example City, Texas 11111/i);
    await expectPlannerField(page, 'start', /100 Example Road, Example City, Texas 11111/);

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD 99999');
    await expectLatestAiResponse(page, /I found a few possible matches for the start place "100 EXAMPLE ROAD 99999"/i);
    await expectPlannerField(page, 'start', /100 Example Road, Example City, Texas 11111/);

    await sendScopeAiPrompt(page, 'START 5555 ZIPLESS ROAD');
    await expectLatestAiResponse(page, /Set the start place to 5555 Zipless Road, Example City, Texas, United States/i);
    await expectPlannerField(page, 'start', '5555 Zipless Road, Example City, Texas, United States');
    await expect(assistantSurfaces(page).last()).not.toContainText('11111');

    await sendScopeAiPrompt(page, 'START 5555 ZIPLESS ROAD 11111');
    await expectLatestAiResponse(page, /I found a few possible matches for the start place "5555 ZIPLESS ROAD 11111"/i);
    await expectPlannerField(page, 'start', '5555 Zipless Road, Example City, Texas, United States');
    await expectNoReload(page, baseline);
  });

  test('recommends endpoint cards first and applies selected endpoint follow-ups', async ({ page, scopeApi }) => {
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baseline = await getReloadBaseline(page);

    await sendScopeAiPrompt(page, 'Find practical endpoints');
    await expectLatestAiResponse(page, /Set a real start point first/i);
    await expectPlannerField(page, 'start', '');
    await expectPlannerField(page, 'end', '');

    await sendScopeAiPrompt(page, 'Help me choose an endpoint from E1500 Road, Hollis');
    const placeResults = page.locator('[data-test="trip-ai-place-results"]').last();
    await expect(placeResults).toContainText(/Endpoint ideas from (?:E1500 Road|Hollis, Oklahoma)/);
    await expect(placeResults.locator('[data-test="trip-ai-place-result"]')).toHaveCount(3);
    await expect(placeResults).toContainText('Quartz Mountain State Park');
    await expect(placeResults).toContainText('Playwright Google Places fixture');
    await expect(placeResults.locator('[data-test="trip-ai-place-add"]').first()).toHaveText('Use as final destination');
    await expectPlannerField(page, 'start', /E1500 Road, Hollis|Hollis, Oklahoma/);
    await expectPlannerField(page, 'end', '');

    await placeResults.locator('[data-test="trip-ai-place-add"]').first().click();
    await expectPlannerField(page, 'end', /Quartz Mountain State Park|14722 Highway 44A/);

    await sendScopeAiPrompt(page, 'Find scenic endpoints');
    const scenicResults = page.locator('[data-test="trip-ai-place-results"]').last();
    await expect(scenicResults).toContainText(/Endpoint ideas from (?:E1500 Road|Hollis, Oklahoma)/);
    await expect(scenicResults).toContainText(/Scenic (lake|endpoint)/);
    await expectPlannerField(page, 'end', /Quartz Mountain State Park|14722 Highway 44A/);

    await sendScopeAiPrompt(page, 'second one');
    await expectLatestAiResponse(page, /Set the final destination to Altus, Oklahoma/i);
    await expectPlannerField(page, 'end', /Altus, Oklahoma/);

    await sendScopeAiPrompt(page, 'Build the itinerary from E1500 Road, Hollis to Altus, Oklahoma');
    await expectLatestAiResponse(page, /How many days should I plan for/i);

    const endpointCallsBeforeRefresh = fixtures.nearbyCalls.length;
    await sendScopeAiPrompt(page, 'Show more endpoint ideas');
    const refreshedResults = page.locator('[data-test="trip-ai-place-results"]').last();
    await expect(refreshedResults).toContainText(/Endpoint ideas from (?:E1500 Road|Hollis, Oklahoma)/);
    await expect(refreshedResults.locator('[data-test="trip-ai-place-result"]')).toHaveCount(3);
    await expect(refreshedResults).toContainText('Playwright Google Places fixture');
    await expect(refreshedResults).not.toContainText(/How many days should I plan for|What kind of trip should this feel like/i);
    expect(fixtures.nearbyCalls.length).toBeGreaterThan(endpointCallsBeforeRefresh);
    await expectPlannerField(page, 'end', /Altus, Oklahoma/);
    await expectNoReload(page, baseline);
  });

  test('applies dates and budgets through the UI without stale backend replies or inverted ranges', async ({ page, scopeApi }) => {
    test.setTimeout(300_000);
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);

    await getPlannerFieldLocator(page, 'budgetMin').fill('500');
    await getPlannerFieldLocator(page, 'budgetMax').fill('1500');

    const maxOnlyPrompts = [
      'set max budget to 400',
      'max 400',
      'under 400',
      'cap at 400',
      'budget ceiling 400',
    ];

    for (const prompt of maxOnlyPrompts) {
      await getPlannerFieldLocator(page, 'budgetMin').fill('500');
      await getPlannerFieldLocator(page, 'budgetMax').fill('1500');
      await sendScopeAiPrompt(page, prompt);
      await expectLatestAiResponse(page, /Set the max trip budget to \$400\./);
      await expectPlannerField(page, 'budgetMin', '400');
      await expectPlannerField(page, 'budgetMax', '400');
      await expect(assistantSurfaces(page).last()).not.toContainText('$500 - $400');
    }

    const rangePrompts = [
      'min 400 max 600',
      'between 400 and 600',
      '400 to 600',
      'maximum 600 minimum 400',
    ];

    for (const prompt of rangePrompts) {
      await sendScopeAiPrompt(page, prompt);
      await expectLatestAiResponse(page, 'Set the trip budget to $400 - $600.');
      await expectPlannerField(page, 'budgetMin', '400');
      await expectPlannerField(page, 'budgetMax', '600');
    }

    await sendScopeAiPrompt(page, 'END DATE MAYBE 2027-05-18?');
    await expectLatestAiResponse(page, 'Set the trip end date to 2027-05-18.');
    await expectPlannerField(page, 'endDate', '2027-05-18');
    await expect(assistantSurfaces(page).last()).not.toContainText('Set the travel party');

    await sendScopeAiPrompt(page, 'end date May 18 2027');
    await expectPlannerField(page, 'endDate', '2027-05-18');

    await sendScopeAiPrompt(page, 'start date 2027-05-17');
    await expectLatestAiResponse(page, 'Set the trip start date to 2027-05-17.');
    await expectPlannerField(page, 'startDate', '2027-05-17');

    await sendScopeAiPrompt(page, 'trip from 2027-05-17 to 2027-05-18');
    await expectLatestAiResponse(page, 'Set the trip dates to 2027-05-17 - 2027-05-18.');
    await expectPlannerField(page, 'startDate', '2027-05-17');
    await expectPlannerField(page, 'endDate', '2027-05-18');

    await sendScopeAiPrompt(page, 'trip from 2027-06-01 to 2027-06-03');
    await expectLatestAiResponse(page, 'Set the trip dates to 2027-06-01 - 2027-06-03.');
    await expectPlannerField(page, 'startDate', '2027-06-01');
    await expectPlannerField(page, 'endDate', '2027-06-03');
  });

  test('recovers noisy prompts and refuses unclear gibberish without guessing', async ({ page, scopeApi }) => {
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD');
    await expectPlannerField(page, 'start', /100 Example Road/);

    await sendScopeAiPrompt(page, 'strt actully 200 Sample Ave Example City TX 11111!!!');
    await expectLatestAiResponse(page, /Set the start place to 200 Sample Avenue, Example City/i);
    await expectPlannerField(page, 'start', /200 Sample Avenue, Example City/);

    await sendScopeAiPrompt(page, 'destnation is actully Austin');
    await expectLatestAiResponse(page, /Set the final destination to Austin, Texas/i);
    await expectPlannerField(page, 'end', /Austin, Texas/);

    await sendScopeAiPrompt(page, 'maxx budgte 400');
    await expectLatestAiResponse(page, 'Set the max trip budget to $400.');
    await expectPlannerField(page, 'budgetMax', '400');

    fixtures.weatherMode = 'openmeteo';
    await sendScopeAiPrompt(page, 'wether fr Dallas???');
    await expectLatestAiResponse(page, /Dallas, Texas.*72F.*Weather source: Open-Meteo fallback/is);

    await sendScopeAiPrompt(page, 'asdkj qweqwe ???');
    await expectLatestAiResponse(page, /cannot confidently answer that without guessing/i);
    await expect(assistantSurfaces(page).last()).not.toContainText('200 Sample Avenue');
    await expect(assistantSurfaces(page).last()).not.toContainText('Austin, Texas');
    await expect(assistantSurfaces(page).last()).not.toContainText('Tell me a start');
  });

  test('mutates travelers, pace, vibes, packing, fuel, nearby, and weather with provider source disclosure', async ({ page, scopeApi }) => {
    test.setTimeout(420_000);
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);

    await sendScopeAiPrompt(page, '2 travelers');
    await expectLatestAiResponse(page, 'Set the travel party to 2 travelers.');
    await expectPlannerField(page, 'travelers', '2');

    await sendScopeAiPrompt(page, 'party of 4');
    await expectPlannerField(page, 'travelers', '4');

    await sendScopeAiPrompt(page, 'solo trip');
    await expectLatestAiResponse(page, 'Set the travel party to 1 traveler.');
    await expectPlannerField(page, 'travelers', '1');

    await sendScopeAiPrompt(page, 'make it chill pace');
    await expectPace(page, 'relaxed');
    await sendScopeAiPrompt(page, 'moderate pace');
    await expectPace(page, 'moderate');
    await sendScopeAiPrompt(page, 'packed pace');
    await expectPace(page, 'packed');

    await sendScopeAiPrompt(page, 'vibe around food scenic nightlife');
    await expectInterest(page, 'food');
    await expectInterest(page, 'scenic');
    await expectInterest(page, 'nightlife');

    await sendScopeAiPrompt(page, 'vibe around nature culture shopping adventure');
    await expectInterest(page, 'nature');
    await expectInterest(page, 'culture');
    await expectInterest(page, 'shopping');
    await expectInterest(page, 'adventure');

    await sendScopeAiPrompt(page, 'add sunscreen to packing');
    await expectLatestAiResponse(page, 'Added sunscreen to the packing list.');
    await expect(page.locator('[data-test="trip-packing-card"]')).toContainText(/sunscreen/i);

    await sendScopeAiPrompt(page, 'remove sunscreen from packing');
    await expectLatestAiResponse(page, 'Removed sunscreen from the packing list if it was there.');
    await expect(page.locator('[data-test="trip-packing-card"]')).not.toContainText(/sunscreen/i);

    await sendScopeAiPrompt(page, 'what should I pack for this trip?');
    await expectLatestAiResponse(page, /For this trip, pack:/);

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD');
    await expectPlannerField(page, 'start', /100 Example Road/);

    await sendScopeAiPrompt(page, 'diesel fuel');
    await expectFuelType(page, 'diesel');

    await sendScopeAiPrompt(page, '25 mpg');
    await expectPlannerField(page, 'mpg', '25');

    await sendScopeAiPrompt(page, 'gas price is 3.45');
    await expectPlannerField(page, 'gasPrice', '3.45');

    await sendScopeAiPrompt(page, 'find cheapest diesel within 20 miles');
    await expectLatestAiResponse(page, /Fuel near 100 Example Road.*Matrix Cheap Fuel.*\$2\.91\/gal/is);
    await expectLatestAiResponse(page, /Fuel source\s*:?\s*configured fuel lookup/i);
    expect(fixtures.fuelCalls.at(-1)).toMatchObject({
      fuelType: 'diesel',
      sortBy: 'best_price',
    });

    await sendScopeAiPrompt(page, 'set gas price');
    await expectLatestAiResponse(page, /Set the gas price to \$2\.91\/gal from the provider-backed fuel result/i);
    await expectPlannerField(page, 'gasPrice', '2.91');

    await sendScopeAiPrompt(page, 'find nearby coffee spots');
    await expectLatestAiResponse(page, /I could not find nearby coffee places around 100 Example Road/i);

    fixtures.weatherMode = 'openmeteo';
    await sendScopeAiPrompt(page, 'weather for this route');
    await expectLatestAiResponse(page, /100 Example Road.*72F.*Partly Cloudy.*9 mph wind.*AQI 44 Good.*Weather source: Open-Meteo fallback/is);

    fixtures.weatherMode = 'openweather';
    await sendScopeAiPrompt(page, 'weather for Miami');
    await expectLatestAiResponse(page, /Miami, Florida.*84F.*Broken Clouds.*12 mph wind.*AQI 1 Good.*Weather source: OpenWeatherMap/is);
    await expect(assistantSurfaces(page).last()).not.toContainText('Example City');
    expect(
      fixtures.geocodeQueries.includes('miami') ||
      fixtures.weatherCalls.some((call) => /lat=25\./.test(call.url) && /(?:lng|lon)=-80\./.test(call.url)),
    ).toBe(true);

    fixtures.weatherMode = 'openmeteo';
    await sendScopeAiPrompt(page, 'weather at 1600 Pennsylvania Ave NW Washington DC');
    await expectLatestAiResponse(page, /1600 Pennsylvania Avenue Northwest, Washington.*72F.*Weather source: Open-Meteo fallback/is);
    await expect(assistantSurfaces(page).last()).not.toContainText('Example City');
    expect(
      fixtures.geocodeQueries.includes('1600 pennsylvania ave nw washington dc') ||
      fixtures.weatherCalls.some((call) => /lat=38\./.test(call.url) && /(?:lng|lon)=-77\./.test(call.url)),
    ).toBe(true);

    await sendScopeAiPrompt(page, 'weather for Dallas');
    await expectLatestAiResponse(page, /Dallas, Texas.*72F.*Weather source: Open-Meteo fallback/is);

    fixtures.weatherMode = 'unavailable';
    await sendScopeAiPrompt(page, 'weather for Dallas');
    await expectLatestAiResponse(page, /Weather is unavailable for Dallas, Texas.*after checking the configured frontend weather providers.*I did not guess conditions/i);
  });

  test('overrides stale RAG, builds from current state, and auto-syncs day-by-day dates unless user locked', async ({ page, scopeApi }) => {
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baseline = await getReloadBaseline(page);

    await sendScopeAiPrompt(page, 'from Fort Worth to Austin');
    await expectPlannerField(page, 'start', /Fort Worth, Texas/);
    await expectPlannerField(page, 'end', /Austin, Texas/);

    await sendScopeAiPrompt(page, 'set max budget to 900');
    await expectPlannerField(page, 'budgetMax', '900');

    await sendScopeAiPrompt(page, 'Any ideas for this route?');
    await expectLatestAiResponse(page, /I have the route from Fort Worth, Texas.*Austin, Texas/i);
    await expect(assistantSurfaces(page).last()).not.toContainText('Tell me a start, end');
    expect(fixtures.ragCalls).toContain('Any ideas for this route?');

    fixtures.ragMode = 'invented-live-facts';
    await sendScopeAiPrompt(page, 'Give me a confidence summary for this route');
    await expectLatestAiResponse(page, /I have the route from Fort Worth, Texas.*Austin, Texas/i);
    await expect(assistantSurfaces(page).last()).not.toContainText('80F');
    await expect(assistantSurfaces(page).last()).not.toContainText('$2.11/gal');
    fixtures.ragMode = 'missing-route';

    await sendScopeAiPrompt(page, 'Check route status');
    await expectLatestAiResponse(page, /Route status.*Fort Worth, Texas.*Austin, Texas/i);

    await sendScopeAiPrompt(page, 'Check route status');
    await expectLatestAiResponse(page, /No new change.*Fort Worth, Texas.*Austin, Texas/i);

    await sendScopeAiPrompt(page, 'Tighten this route');
    await expectLatestAiResponse(page, /I will tighten against the route state I already have/i);

    await sendScopeAiPrompt(page, 'start date 2027-05-17');
    await sendScopeAiPrompt(page, 'Build the itinerary');
    await expectLatestAiResponse(page, /route builder, map preview, and copilot are synced now/i);
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(2);
    await expectPlannerField(page, 'endDate', '2027-05-18');

    await sendScopeAiPrompt(page, 'end date 2027-05-20');
    await expectPlannerField(page, 'endDate', '2027-05-20');
    await sendScopeAiPrompt(page, 'Build the itinerary');
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(4);
    await expectPlannerField(page, 'endDate', '2027-05-20');

    await expectNoReload(page, baseline);
  });

  test('keeps a pending duration reply as an exact 4-day itinerary build', async ({ page, scopeApi }) => {
    const fixtures = await installScopeAiMatrixFixtures(page);
    enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);

    await sendScopeAiPrompt(page, 'from 5673 Jamaica Circle, North Richland Hills to 1205 Oriental Avenue, Arlington');
    await expectPlannerField(page, 'start', /North Richland Hills/);
    await expectPlannerField(page, 'end', /Arlington/);

    await sendScopeAiPrompt(page, 'start date 2027-05-17');
    await expectPlannerField(page, 'startDate', '2027-05-17');
    await sendScopeAiPrompt(page, 'end date 2027-05-17');
    await expectPlannerField(page, 'endDate', '2027-05-17');
    await page.locator('[data-test="trip-interest-food"]').click();
    await page.locator('[data-test="trip-interest-scenic"]').click();

    await sendScopeAiPrompt(page, 'Build a balanced first draft');
    await expectLatestAiResponse(page, /How many days should I plan for/i);

    await sendScopeAiPrompt(page, '4');
    await expectLatestAiResponse(page, /4-day itinerary/i);
    await expectPlannerField(page, 'endDate', '2027-05-20');
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(4);
    await expect(assistantSurfaces(page).last()).not.toContainText(/into an itinerary with 4 stops/i);
  });

  test('keeps the chat panel fixed and error-free during a long mixed prompt soak', async ({ page, scopeApi }) => {
    test.setTimeout(1_500_000);
    const fixtures = await installScopeAiMatrixFixtures(page);
    const logger = enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baselineReload = await getReloadBaseline(page);
    const baselinePanel = await expectComposerVisibleAndPanelFixed(page);

    const prompts = [
      'START 100 EXAMPLE ROAD',
      'START ACTUALLY 200 SAMPLE AVE EXAMPLE CITY TX 11111',
      'end Austin',
      'set max budget to 400',
      'min 250 max 900',
      'END DATE MAYBE 2027-05-18?',
      'start date 2027-05-17',
      '2 travelers',
      'party of 4',
      'solo trip',
      'make it chill pace',
      'balanced pace',
      'packed pace',
      'vibe around food scenic nightlife',
      'vibe around nature culture shopping adventure',
      'add sunscreen to packing',
      'remove sunscreen from packing',
      'what should I pack?',
      'diesel fuel',
      '25 mpg',
      'gas price is 3.45',
      'find cheapest diesel within 15 miles',
      'find nearby coffee spots',
      'weather for this route',
      'Find scenic endpoints',
      'Show more endpoint ideas',
      'Check route status',
      'Tighten this route',
      'Any ideas for this route?',
      'Build the itinerary',
      'strt actully 200 Sample Ave Example City TX 11111',
      'destnation is actully Austin',
      'maxx budgte 400',
      'wether fr Dallas',
      'asdkj qweqwe ???',
      'START 100 EXAMPLE ROAD 99999',
      'START 5555 ZIPLESS ROAD',
      'START 5555 ZIPLESS ROAD 11111',
      'find cheep gas',
      'find cheep diesel within 10 mi',
      'wether fr this route',
      'party ov 4',
      'solo trip!!!',
      'vibe food scenic nightlife',
      'budgte ceiling 700',
      'end date maybe May 18 2027???',
      'trip from 2027-05-17 to 2027-05-18',
      'where should we end from E1500 Road, Hollis',
      'Show more endpoint ideas',
      'Check route status',
    ];

    for (const prompt of prompts) {
      await sendScopeAiPrompt(page, prompt);
      await expectComposerVisibleAndPanelFixed(page, baselinePanel);
      await expectNoReload(page, baselineReload);
    }

    const finalMetrics = await expectComposerVisibleAndPanelFixed(page, baselinePanel);
    expect(finalMetrics.bodyScrollable).toBe(true);
    await expect(page.locator('[data-test="trip-ai-input"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-ai-message-chip"], [data-test="trip-ai-quick-suggestion"]').last()).toBeVisible();
    expect(logger.browserErrors).toEqual([]);
  });

  test('keeps replies safe and performant across deterministic unknown-edge fuzz prompts', async ({ page, scopeApi }) => {
    test.setTimeout(2_700_000);
    const fixtures = await installScopeAiMatrixFixtures(page);
    fixtures.weatherMode = 'openmeteo';
    const logger = enableScopeAiTurnLogging(page, fixtures);
    await openScopeAiPlanner(page, scopeApi);
    const baselineReload = await getReloadBaseline(page);
    const baselinePanel = await expectComposerVisibleAndPanelFixed(page);

    await sendScopeAiPrompt(page, 'START 100 EXAMPLE ROAD');
    await sendScopeAiPrompt(page, 'end Austin');

    for (const prompt of buildScopeAiFuzzPrompts(100)) {
      await sendScopeAiPrompt(page, prompt);
      await expectComposerVisibleAndPanelFixed(page, baselinePanel);
      await expectNoReload(page, baselineReload);
    }

    const responseTimes = logger.logs.map((log) => log.responseTimeMs);
    expect(percentile(responseTimes, 0.5)).toBeLessThanOrEqual(10_000);
    expect(percentile(responseTimes, 0.95)).toBeLessThanOrEqual(25_000);
    expect(logger.logs.filter((log) => log.promptWasRedacted).length).toBeGreaterThan(0);
    expect(logger.browserErrors).toEqual([]);
  });
});
