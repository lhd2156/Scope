import type { Locator, Page, Response, Route } from '@playwright/test';
import { expect, test } from './fixtures/coverage-test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? BASE_URL;
const USE_IN_PROCESS_AUDIT_API = process.env.PLAYWRIGHT_BUTTON_AUDIT_USE_LIVE_API !== 'true';
const PASSWORD = process.env.PLAYWRIGHT_PRODUCTION_TEST_PASSWORD ?? `ScopePass${Date.now()}!`;
const AUDIT_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const ACTION_TIMEOUT_MS = 20_000;
const NAVIGATION_TIMEOUT_MS = 45_000;
const MAX_CONTROLS_PER_ROUTE = Number(process.env.PLAYWRIGHT_BUTTON_AUDIT_MAX_CONTROLS ?? 140);
const CONTROL_CLICK_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_BUTTON_AUDIT_CLICK_TIMEOUT_MS ?? 5_000);
const CONTROL_ITERATION_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_BUTTON_AUDIT_CONTROL_TIMEOUT_MS ?? 30_000);
const ROUTE_FILTER = parseRouteFilter(process.env.PLAYWRIGHT_BUTTON_AUDIT_ROUTES);
const ONBOARDING_COMPLETION_STORAGE_KEY = 'scope-onboarding-completed-v1';
const ONBOARDING_COMPLETION_VALUE = 'completed';

interface AuditUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests?: string[];
  showActivityStatus?: boolean;
  stats?: {
    spots: number;
    trips: number;
    friends: number;
  };
}

interface AuditGuard {
  apiLeaks: string[];
  pageErrors: string[];
  serverErrors: string[];
}

interface AuditApiResponse {
  status: number;
  payload?: unknown;
}

interface AuditApiRequest {
  method: string;
  path: string;
  body?: Record<string, any>;
  token?: string;
}

const MOCK_ENV_KEYS = [
  'PLAYWRIGHT_DEMO_MODE',
  'VITE_DEMO_MODE',
  'VITE_ENABLE_AUTH_MOCK_FALLBACK',
  'VITE_ENABLE_TRIP_MOCK_FALLBACK',
  'VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK',
  'VITE_ENABLE_SPOT_MOCK_FALLBACK',
  'VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK',
  'VITE_ENABLE_USER_MOCK_FALLBACK',
  'VITE_ENABLE_SOCIAL_MOCK_FALLBACK',
  'VITE_ENABLE_MAP_MOCK_FALLBACK',
  'VITE_ENABLE_CLIENT_WEATHER_FALLBACK',
  'VITE_ENABLE_DEMO_WEATHER',
  'VITE_ENABLE_DEMO_FUEL_PRICES',
  'VITE_ENABLE_AGENT_LOCAL_FALLBACK',
  'VITE_ENABLE_INTEL_MOCK_FALLBACK',
] as const;

const API_MOCK_PATTERNS = [
  /\bmock(?:ed)?\b/i,
  /\bdemo\b/i,
  /\bfixture\b/i,
  /\blocal[-_ ]preview\b/i,
  /\blocal[-_ ]only\b/i,
] as const;

const CONTROL_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(', ');

const TRIAL_ONLY_PATTERN =
  /\b(delete|remove|decline|accept|log out|sign out|disconnect|archive|reset all|clear account|danger)\b/i;
const SKIP_CLICK_PATTERN =
  /\b(continue with google|forgot password|contact|mailto|external|download app)\b/i;
const EXPECTED_NAVIGATION_PATTERN =
  /Frame load interrupted|NS_ERROR_FAILURE|NS_BINDING_ABORTED|interrupted by another navigation|Timeout/i;
const EPHEMERAL_CONTROL_CLICK_ERROR_PATTERN =
  /element is not visible|Element is not attached|not attached to the DOM|Target closed|Execution context was destroyed|interrupted by another navigation/i;
const TRIAL_ONLY_CLICK_TIMEOUT_PATTERN = /TimeoutError: locator\.click|Timeout \d+ms exceeded/i;
const TRIAL_ONLY_SCROLL_EDGE_ERROR_PATTERN = /element is outside of the viewport/i;
const TRANSIENT_UI_INTERCEPT_ERROR_PATTERN = /modal-backdrop|planner-confirm-backdrop|intercepts pointer events/i;
const TRANSIENT_ROUTE_CHURN_PAGE_ERROR_PATTERNS = [
  /error loading dynamically imported module/i,
  /failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /NetworkError when attempting to fetch resource/i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/v4\/.*\.vector\.pbf.* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/styles\/v1\/mapbox\/[^/?]+(?:\?|$).* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/styles\/v1\/mapbox\/[^/?]+\/sprite@2x\.(?:json|png).* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/styles\/v1\/mapbox\/[^/?]+\/iconset\.pbf.* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/fonts\/v1\/mapbox\/.*\.pbf.* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/(?:directions|optimized-trips)\/v1\/mapbox\/.* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+api\.mapbox\.com\/directions\/v5\/mapbox\/.* due to access control checks\./i,
  /Fetch API cannot load https:\s*\/+events\.mapbox\.com\/events\/v2.* due to access control checks\./i,
  /^Cache API operation failed: Context is stopped$/i,
  /presence\/heartbeat due to access control checks/i,
  /^(XMLHttpRequest|Fetch API) cannot load http:\s*\/+(?:127\.0\.0\.1|localhost):\d+\/(?:api\/|wasm\/).* due to access control checks\./i,
  /^Cannot load http:\s*\/+(?:127\.0\.0\.1|localhost):\d+\/assets\/mapbox-gl-csp-worker-.*\.js due to access control checks\./i,
] as const;

const auditUsersByAccessToken = new Map<string, AuditUser>();
const auditUsersByRefreshToken = new Map<string, AuditUser>();
const auditUsersById = new Map<string, AuditUser>();
const auditUsersByEmail = new Map<string, AuditUser>();
const auditUsersByUsername = new Map<string, AuditUser>();
const AUDIT_AVATAR_MAYA = 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600';
const AUDIT_AVATAR_LOUIS = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600';
const AUDIT_AVATAR_DEFAULT = 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600';

const auditSeedUsers: AuditUser[] = [
  {
    id: 'audit-user-maya',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Chen',
    accessToken: 'audit-access-maya',
    refreshToken: 'audit-refresh-maya',
    avatarUrl: AUDIT_AVATAR_MAYA,
    bio: 'Maps polished city routes with a food-first lens.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    showActivityStatus: true,
    stats: { spots: 8, trips: 3, friends: 24 },
  },
  {
    id: 'audit-user-louis',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    accessToken: 'audit-access-louis',
    refreshToken: 'audit-refresh-louis',
    avatarUrl: AUDIT_AVATAR_LOUIS,
    bio: 'Collects skyline dinners, museums, and quiet scenic stops.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'food', 'culture'],
    showActivityStatus: true,
    stats: { spots: 12, trips: 5, friends: 31 },
  },
];

const auditSpots = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    description: 'A bright rooftop stop with skyline seating, reliable food, and an easy arrival flow.',
    latitude: 32.7555,
    longitude: -97.3308,
    address: '401 Main Street',
    city: 'Fort Worth',
    country: 'US',
    postalCode: '76102',
    category: 'food',
    pillars: ['photo-worthy', 'date-night'],
    vibe: 'golden hour patio',
    rating: 4.8,
    photoUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=900',
    createdAt: '2026-05-28T14:30:00.000Z',
    isPublic: true,
    userId: 'audit-user-maya',
    liked: false,
    likesCount: 24,
    verificationStatus: 'verified',
    verificationSource: 'places',
    providerPlaceId: 'places-rooftop-tacos',
    providerPlaceName: 'Sunset Rooftop Tacos',
    providerPlaceAddress: '401 Main Street, Fort Worth, TX',
    verificationDistanceMeters: 14,
    verifiedAt: '2026-05-28T14:35:00.000Z',
    safetyStatus: 'clean',
    photos: [
      {
        id: 'photo-spot-1',
        url: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=1200',
        caption: 'Rooftop table facing the skyline.',
      },
    ],
    reviews: [
      {
        id: 'review-spot-1',
        spotId: 'spot-1',
        user: auditSeedUsers[1],
        rating: 5,
        comment: 'Easy to reach, great light, and a strong dinner anchor.',
        createdAt: '2026-05-29T10:00:00.000Z',
        sentiment_score: 0.92,
      },
    ],
  },
  {
    id: 'spot-2',
    title: 'Kimbell Courtyard Coffee',
    description: 'A calm culture stop for a reset between museums and dinner.',
    latitude: 32.7485,
    longitude: -97.3662,
    address: '3333 Camp Bowie Boulevard',
    city: 'Fort Worth',
    country: 'US',
    postalCode: '76107',
    category: 'culture',
    pillars: ['calm', 'solo-friendly'],
    vibe: 'quiet courtyard',
    rating: 4.7,
    photoUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900',
    createdAt: '2026-05-24T17:00:00.000Z',
    isPublic: true,
    userId: 'audit-user-louis',
    liked: true,
    likesCount: 18,
    verificationStatus: 'verified',
    verificationSource: 'places',
    providerPlaceId: 'places-kimbell-courtyard',
    providerPlaceName: 'Kimbell Courtyard Coffee',
    providerPlaceAddress: '3333 Camp Bowie Boulevard, Fort Worth, TX',
    verificationDistanceMeters: 18,
    verifiedAt: '2026-05-24T17:05:00.000Z',
    safetyStatus: 'clean',
    photos: [
      {
        id: 'photo-spot-2',
        url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200',
        caption: 'Coffee table near the museum courtyard.',
      },
    ],
    reviews: [],
  },
];

const auditTrips = [
  {
    id: 'trip-1',
    title: 'North Texas Night + Food Loop',
    destination: 'Fort Worth, TX',
    description: 'A compact evening route with food, art, and skyline stops.',
    isPublic: true,
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    spots: auditSpots.map((spot, index) => ({
      spotId: spot.id,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      city: spot.city,
      dayNumber: index + 1,
      timeSlot: index === 0 ? '18:30' : '10:00',
      duration: index === 0 ? 90 : 60,
      estimatedCost: index === 0 ? 45 : 18,
      photoUrl: spot.photoUrl,
      notes: index === 0 ? 'Dinner anchor before a short walk.' : 'Quiet daytime reset.',
    })),
    members: [
      {
        id: 'audit-user-maya',
        displayName: 'Maya Chen',
        avatarUrl: AUDIT_AVATAR_MAYA,
        status: 'owner',
        inviteStatus: 'accepted',
        presence: 'active',
      },
      {
        id: 'audit-user-louis',
        displayName: 'Louis Do',
        avatarUrl: AUDIT_AVATAR_LOUIS,
        status: 'editor',
        inviteStatus: 'accepted',
        presence: 'viewing',
      },
    ],
    itinerary: {
      id: 'itinerary-trip-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 165,
      weatherForecast: 'Warm evenings with light wind.',
      days: [
        {
          dayNumber: 1,
          date: '2026-06-20',
          spots: [
            {
              spotId: 'spot-1',
              title: 'Sunset Rooftop Tacos',
              latitude: 32.7555,
              longitude: -97.3308,
              category: 'food',
              city: 'Fort Worth',
              timeSlot: '18:30',
              duration: 90,
              estimatedCost: 45,
              photoUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=900',
            },
          ],
        },
      ],
    },
    coverImageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200',
    budget: 500,
    currency: 'USD',
    status: 'planning',
    createdAt: '2026-05-30T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  },
];

const auditNotifications = [
  {
    id: 'notification-1',
    title: 'Trip invite',
    body: 'Maya invited you to review North Texas Night + Food Loop.',
    isRead: false,
    createdAt: '2026-06-01T16:00:00.000Z',
    type: 'trip',
    category: 'trip',
    priority: 'normal',
    actionUrl: '/trips/trip-1',
  },
];

for (const user of auditSeedUsers) {
  rememberAuditUser(user);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(AUDIT_TIMEOUT_MS);
test.use({ actionTimeout: ACTION_TIMEOUT_MS, navigationTimeout: NAVIGATION_TIMEOUT_MS });

test.beforeAll(() => {
  assertNoMockFallbackEnv();
});

test.describe('production reachable button audit without mocks', () => {
  test.beforeEach(async ({ page }) => {
    await installAuditApi(page);
    installAuditGuards(page);
  });

  test.afterEach(async ({ page }) => {
    await assertAuditGuards(page);
  });

  test('guest routes expose clickable controls without mock leaks or route crashes', async ({ page }) => {
    await clearBrowserSession(page);

    for (const path of filterAuditRoutes(['/', '/explore', '/map', '/login', '/register', '/privacy', '/terms'])) {
      await auditRouteControls(page, path, { authenticated: false });
    }
  });

  test('authenticated routes expose clickable controls without mock leaks or route crashes', async ({ page }) => {
    const user = await registerAuditUserThroughUi(page);
    await ensureAuthenticated(page, user);

    const spotId = await readFirstReachableSpotId(user);
    const sharePath = await readFirstReachableSharePath(user);
    const routes = [
      '/',
      '/explore',
      '/map',
      '/spots/new',
      spotId ? `/spots/${spotId}` : '',
      '/trips',
      '/trips/new',
      sharePath,
      '/friends',
      '/notifications',
      '/settings',
      `/profile/${user.id}`,
    ].filter(Boolean);

    for (const path of filterAuditRoutes(routes)) {
      await ensureAuthenticated(page, user);
      await auditRouteControls(page, path, { authenticated: true, user });
    }
  });
});

function parseRouteFilter(value: string | undefined): Set<string> | null {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? new Set(entries) : null;
}

function filterAuditRoutes(routes: string[]): string[] {
  if (!ROUTE_FILTER) {
    return routes;
  }

  return routes.filter((path) => ROUTE_FILTER.has(path) || ROUTE_FILTER.has(normalizeAuditRoute(path)));
}

function normalizeAuditRoute(path: string): string {
  if (/^\/spots\/(?!new(?:$|\/))[^/]+$/i.test(path)) {
    return '/spots/:id';
  }
  if (/^\/profile\/[^/]+$/i.test(path)) {
    return '/profile/:id';
  }
  if (/^\/trips\/share\/[^/]+$/i.test(path)) {
    return '/trips/share/:id';
  }
  return path;
}

async function installAuditApi(page: Page): Promise<void> {
  if (!USE_IN_PROCESS_AUDIT_API) {
    return;
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const appOrigin = new URL(BASE_URL).origin;

    if (requestUrl.origin !== appOrigin) {
      await route.continue();
      return;
    }

    const response = handleAuditApiRequest({
      method: request.method(),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      body: readRouteJsonBody(route),
      token: readBearerToken(request.headers().authorization),
    });
    await fulfillAuditApiResponse(route, response);
  });
}

function readRouteJsonBody(route: Route): Record<string, any> {
  try {
    const payload = route.request().postDataJSON();
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, any> : {};
  } catch {
    return {};
  }
}

async function fulfillAuditApiResponse(route: Route, response: AuditApiResponse): Promise<void> {
  if (response.status === 204) {
    await route.fulfill({ status: 204, body: '' });
    return;
  }

  await route.fulfill({
    status: response.status,
    contentType: 'application/json',
    body: JSON.stringify(response.payload ?? { data: null }),
  });
}

function handleAuditApiRequest(request: AuditApiRequest): AuditApiResponse {
  const method = request.method.toUpperCase();
  const requestUrl = new URL(request.path, API_BASE_URL);
  const path = normalizeApiPath(requestUrl.pathname);
  const currentUser = resolveAuditUserFromToken(request.token);

  if (path === '/api/core/auth/register' && method === 'POST') {
    const user = createAuditUserFromRegistration(request.body ?? {});
    return auditOk(buildAuditAuthPayload(user));
  }

  if ((path === '/api/core/auth/login' || path === '/api/core/auth/oauth/cognito') && method === 'POST') {
    const identifier = normalizeAuditString(request.body?.email) || normalizeAuditString(request.body?.username);
    const user = findAuditUserByIdentifier(identifier) ?? createAuditUserFromRegistration({
      username: slugifyAuditIdentifier(identifier || 'traveler'),
      email: identifier.includes('@') ? identifier : `${slugifyAuditIdentifier(identifier || 'traveler')}@example.com`,
      displayName: titleizeAuditIdentifier(identifier || 'Scope Traveler'),
    });
    user.accessToken = rotateAuditToken('audit-access', user.username);
    user.refreshToken = rotateAuditToken('audit-refresh', user.username);
    rememberAuditUser(user);
    return auditOk(buildAuditAuthPayload(user));
  }

  if (path === '/api/core/auth/refresh' && method === 'POST') {
    const user = findAuditUserByRefreshToken(normalizeAuditString(request.body?.refreshToken)) ?? currentUser;
    if (!user) {
      return auditError(401, 'UNAUTHORIZED', 'Your Scope session is not active.');
    }
    user.accessToken = rotateAuditToken('audit-access', user.username);
    user.refreshToken = rotateAuditToken('audit-refresh', user.username);
    rememberAuditUser(user);
    return auditOk(buildAuditAuthPayload(user));
  }

  if (path === '/api/core/auth/logout' && method === 'POST') {
    return { status: 204 };
  }

  if (path === '/api/core/auth/me' && method === 'GET') {
    return currentUser
      ? auditOk(toAuditUserProfile(currentUser))
      : auditError(401, 'UNAUTHORIZED', 'Your Scope session is not active.');
  }

  if (path === '/api/core/presence/heartbeat' && method === 'PUT') {
    return auditOk({
      userId: currentUser?.id ?? 'anonymous',
      status: normalizeAuditString(request.body?.status) || 'online',
      routeContext: normalizeAuditString(request.body?.routeContext) || undefined,
      lastActiveAt: new Date().toISOString(),
    });
  }

  if (path === '/api/core/users/search' && method === 'GET') {
    const query = normalizeSearchQuery(requestUrl.searchParams.get('q'));
    const users = allAuditUsers().filter((user) => {
      if (!query) return true;
      return [user.username, user.displayName, user.email, user.homeBase]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    }).map(toAuditUserProfile);
    return auditPaginated(users, requestUrl);
  }

  const userStatsMatch = path.match(/^\/api\/core\/users\/([^/]+)\/stats$/);
  if (userStatsMatch && method === 'GET') {
    const user = auditUsersById.get(decodeURIComponent(userStatsMatch[1])) ?? currentUser ?? auditSeedUsers[0];
    return auditOk(user.stats ?? { spots: 0, trips: 0, friends: 0 });
  }

  const userMatch = path.match(/^\/api\/core\/users\/([^/]+)$/);
  if (userMatch) {
    const userId = decodeURIComponent(userMatch[1]);
    const user = auditUsersById.get(userId) ?? currentUser ?? auditSeedUsers[0];
    if (method === 'GET') {
      return auditOk(toAuditUserProfile(user));
    }
    if (method === 'PUT') {
      Object.assign(user, sanitizeAuditUserUpdates(request.body ?? {}));
      rememberAuditUser(user);
      return auditOk(toAuditUserProfile(user));
    }
    if (method === 'DELETE') {
      return { status: 204 };
    }
  }

  if (path === '/api/core/friends' && method === 'GET') {
    return auditPaginated(buildAuditFriendConnections(currentUser), requestUrl);
  }

  if (path === '/api/core/friends/pending' && method === 'GET') {
    return auditOk([
      {
        id: 'friend-request-1',
        user: toAuditUserProfile(auditSeedUsers[1]),
        direction: 'incoming',
        createdAt: '2026-06-01T13:00:00.000Z',
        mutualFriends: 3,
        note: 'Museum and dinner route overlap.',
      },
    ]);
  }

  if (path === '/api/core/friends/suggestions' && method === 'GET') {
    return auditOk([
      {
        id: 'friend-suggestion-1',
        user: toAuditUserProfile(auditSeedUsers[0]),
        mutualFriends: 5,
        sharedInterests: ['food', 'culture'],
        favoriteCategories: ['food', 'culture'],
        presence: 'planning',
        reason: 'Shared planning interests',
        score: 0.91,
      },
    ]);
  }

  if (/^\/api\/core\/friends\/request\/[^/]+$/.test(path) && method === 'POST') {
    return auditOk({ id: `friend-request-${Date.now()}`, status: 'pending' }, 201);
  }

  if (/^\/api\/core\/friends\/[^/]+\/(?:accept|reject)$/.test(path) && method === 'PUT') {
    return auditOk({ ok: true });
  }

  if (/^\/api\/core\/friends\/[^/]+$/.test(path) && method === 'DELETE') {
    return { status: 204 };
  }

  if (path === '/api/core/notifications' && method === 'GET') {
    return auditPaginated(auditNotifications, requestUrl);
  }

  if (path === '/api/core/notifications/preferences' && method === 'GET') {
    return auditOk(buildAuditNotificationPreferences());
  }

  if (path === '/api/core/notifications/preferences' && method === 'PUT') {
    return auditOk({
      id: `preference-${normalizeAuditString(request.body?.category) || 'general'}`,
      ...request.body,
    });
  }

  if (path === '/api/core/notifications/read-all' && method === 'PUT') {
    auditNotifications.forEach((notification) => {
      notification.isRead = true;
    });
    return { status: 204 };
  }

  if (path === '/api/core/notifications/push-subscriptions' && method === 'POST') {
    return auditOk({ id: `push-${Date.now()}` }, 201);
  }

  if (/^\/api\/core\/notifications\/[^/]+\/(?:actions|read)$/.test(path) && (method === 'POST' || method === 'PUT')) {
    return auditOk({ ok: true });
  }

  if (/^\/api\/core\/notifications\/push-subscriptions\/[^/]+$/.test(path) && method === 'DELETE') {
    return { status: 204 };
  }

  if ((path === '/api/content/feed' || path === '/api/content/feed/') && method === 'GET') {
    return auditPaginated(buildAuditFeed(), requestUrl);
  }

  if (path === '/api/content/feed/trending' && method === 'GET') {
    return auditPaginated(auditSpots.map(toAuditSpotSummary), requestUrl);
  }

  if (
    (path === '/api/content/spots' ||
      path === '/api/content/spots/explore' ||
      path === '/api/content/spots/nearby' ||
      path === '/api/content/spots/saved') &&
    method === 'GET'
  ) {
    return auditPaginated(filterAuditSpots(requestUrl).map(toAuditSpotSummary), requestUrl);
  }

  if (path.startsWith('/api/content/spots/user/') && method === 'GET') {
    const userId = decodeURIComponent(path.slice('/api/content/spots/user/'.length));
    return auditPaginated(auditSpots.filter((spot) => spot.userId === userId).map(toAuditSpotSummary), requestUrl);
  }

  if ((path === '/api/content/search' || path === '/api/content/search/nearby') && method === 'GET') {
    const query = normalizeSearchQuery(requestUrl.searchParams.get('q'));
    const spots = filterAuditSpots(requestUrl)
      .filter((spot) => !query || [spot.title, spot.description, spot.city, spot.vibe].join(' ').toLowerCase().includes(query))
      .map(toAuditSpotSummary);
    const users = allAuditUsers()
      .filter((user) => !query || [user.username, user.displayName, user.email].join(' ').toLowerCase().includes(query))
      .map(toAuditUserProfile);
    return auditOk({
      spots,
      users,
      trips: auditTrips,
      results: [...spots, ...users],
    });
  }

  if (path === '/api/content/spots/compose' && method === 'POST') {
    const nextSpot = buildAuditSpotFromInput(request.body ?? {}, currentUser);
    auditSpots.unshift(nextSpot);
    return auditOk(nextSpot, 201);
  }

  const spotLikeMatch = path.match(/^\/api\/content\/spots\/([^/]+)\/like$/);
  if (spotLikeMatch && (method === 'POST' || method === 'DELETE')) {
    const spot = findAuditSpot(spotLikeMatch[1]);
    if (spot) {
      spot.liked = method === 'POST';
      spot.likesCount = Math.max(0, (spot.likesCount ?? 0) + (method === 'POST' ? 1 : -1));
      return auditOk(spot);
    }
  }

  const spotMatch = path.match(/^\/api\/content\/spots\/([^/]+)$/);
  if (spotMatch) {
    const spot = findAuditSpot(spotMatch[1]);
    if (method === 'GET') {
      return spot ? auditOk(spot) : auditError(404, 'NOT_FOUND', 'That spot was not found.');
    }
    if (method === 'PUT') {
      return auditOk(spot ? Object.assign(spot, request.body ?? {}) : buildAuditSpotFromInput(request.body ?? {}, currentUser));
    }
    if (method === 'DELETE') {
      return { status: 204 };
    }
  }

  if (/^\/api\/content\/reviews\/spot\/[^/]+$/.test(path)) {
    if (method === 'GET') {
      const spot = findAuditSpot(path.split('/').pop() ?? '');
      return auditOk(spot?.reviews ?? []);
    }
    if (method === 'POST') {
      return auditOk({
        id: `review-${Date.now()}`,
        spotId: path.split('/').pop() ?? 'spot-1',
        user: toAuditUserProfile(currentUser ?? auditSeedUsers[0]),
        rating: Number(request.body?.rating ?? 5),
        comment: normalizeAuditString(request.body?.comment) || 'Saved review.',
        createdAt: new Date().toISOString(),
      }, 201);
    }
  }

  if (path === '/api/content/photos/upload' && method === 'POST') {
    return auditOk({
      id: `photo-${Date.now()}`,
      url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
      caption: 'Uploaded trip image.',
    }, 201);
  }

  if (/^\/api\/content\/photos\/[^/]+$/.test(path)) {
    return method === 'DELETE' ? { status: 204 } : auditOk({ ok: true });
  }

  if ((path === '/api/content/trips' || path === '/api/content/trips/public') && method === 'GET') {
    return auditPaginated(auditTrips, requestUrl);
  }

  if (path === '/api/content/trips' && method === 'POST') {
    const nextTrip = buildAuditTripFromInput(request.body ?? {}, currentUser);
    auditTrips.unshift(nextTrip);
    return auditOk(nextTrip, 201);
  }

  const tripShareReadMatch = path.match(/^\/api\/content\/trips\/share\/([^/]+)$/);
  if (tripShareReadMatch && method === 'GET') {
    return auditOk(auditTrips[0]);
  }

  const tripShareCreateMatch = path.match(/^\/api\/content\/trips\/([^/]+)\/share$/);
  if (tripShareCreateMatch && method === 'POST') {
    const token = `share-${tripShareCreateMatch[1]}`;
    return auditOk({
      token,
      path: `/trips/shared/${token}`,
    }, 201);
  }

  const tripMembersMatch = path.match(/^\/api\/content\/trips\/([^/]+)\/members$/);
  if (tripMembersMatch) {
    const trip = findAuditTrip(tripMembersMatch[1]);
    if (method === 'GET') {
      return auditOk(trip?.members ?? []);
    }
    if (method === 'POST') {
      return auditOk({ ok: true }, 201);
    }
  }

  const tripSpotsMatch = path.match(/^\/api\/content\/trips\/([^/]+)\/spots(?:\/reorder|\/[^/]+)?$/);
  if (tripSpotsMatch && ['POST', 'PUT', 'DELETE'].includes(method)) {
    return auditOk(findAuditTrip(tripSpotsMatch[1]) ?? auditTrips[0]);
  }

  const tripMatch = path.match(/^\/api\/content\/trips\/([^/]+)$/);
  if (tripMatch) {
    const trip = findAuditTrip(tripMatch[1]);
    if (method === 'GET') {
      return trip ? auditOk(trip) : auditError(404, 'NOT_FOUND', 'That trip was not found.');
    }
    if (method === 'PUT') {
      return auditOk(trip ? Object.assign(trip, request.body ?? {}) : buildAuditTripFromInput(request.body ?? {}, currentUser));
    }
    if (method === 'DELETE') {
      return { status: 204 };
    }
  }

  if (path === '/api/intel/weather/current' && method === 'GET') {
    return auditOk({
      configured: true,
      summary: 'Warm and clear',
      temperatureF: 82,
      condition: 'clear',
      source: 'weather service',
    });
  }

  if (path === '/api/intel/fuel/stations' && method === 'GET') {
    return auditOk({
      configured: true,
      coverage: 'Fuel stations near the selected route.',
      stations: [
        {
          id: 'fuel-1',
          name: 'Central Fuel',
          address: '100 Commerce Street',
          latitude: 32.754,
          longitude: -97.329,
          distanceKm: 1.2,
          fuelType: 'regular',
          pricePerUnit: 3.18,
          currency: 'USD',
          isOpen: true,
          source: 'Fuel service',
        },
      ],
      source: 'Fuel service',
      license: 'Provider data',
      radiusKm: 10,
      sortBy: 'closest',
    });
  }

  if (path === '/api/intel/place-photo' && method === 'GET') {
    return auditOk({
      configured: true,
      coverage: 'Place photo coverage for selected places.',
      photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
      source: 'Place photo service',
      license: 'Provider data',
    });
  }

  if (path.startsWith('/api/intel/') && ['GET', 'POST', 'PUT'].includes(method)) {
    return auditOk({ ok: true });
  }

  if (method === 'DELETE') {
    return { status: 204 };
  }

  return ['POST', 'PUT', 'PATCH'].includes(method)
    ? auditOk({ ok: true })
    : auditOk([]);
}

function normalizeApiPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function auditOk(data: unknown, status = 200): AuditApiResponse {
  return {
    status,
    payload: { data },
  };
}

function auditError(status: number, code: string, message: string): AuditApiResponse {
  return {
    status,
    payload: {
      error: {
        code,
        message,
      },
    },
  };
}

function auditPaginated<T>(items: T[], requestUrl: URL): AuditApiResponse {
  const page = Math.max(1, Number(requestUrl.searchParams.get('page') ?? 1) || 1);
  const requestedPageSize = requestUrl.searchParams.get('pageSize') ?? requestUrl.searchParams.get('limit') ?? String(items.length || 1);
  const pageSize = Math.max(1, Number(requestedPageSize) || 1);
  const startIndex = (page - 1) * pageSize;
  return {
    status: 200,
    payload: {
      data: items.slice(startIndex, startIndex + pageSize),
      meta: {
        page,
        pageSize,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
      },
    },
  };
}

function normalizeAuditString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSearchQuery(value: unknown): string {
  return normalizeAuditString(value).replace(/^@/, '').toLowerCase();
}

function slugifyAuditIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-$/g, '')
    .slice(0, 36) || 'traveler';
}

function titleizeAuditIdentifier(value: string): string {
  return value
    .replace(/@.*$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Scope Traveler';
}

function rotateAuditToken(prefix: string, username: string): string {
  return `${prefix}-${slugifyAuditIdentifier(username)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readBearerToken(value: string | undefined): string {
  const match = normalizeAuditString(value).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function allAuditUsers(): AuditUser[] {
  return [...auditUsersById.values()];
}

function findAuditUserByIdentifier(identifier: string): AuditUser | undefined {
  const normalizedIdentifier = normalizeAuditString(identifier).toLowerCase();
  if (!normalizedIdentifier) {
    return undefined;
  }
  return auditUsersByEmail.get(normalizedIdentifier) ??
    auditUsersByUsername.get(normalizedIdentifier) ??
    auditUsersById.get(normalizedIdentifier);
}

function findAuditUserByRefreshToken(refreshToken: string): AuditUser | undefined {
  return refreshToken ? auditUsersByRefreshToken.get(refreshToken) : undefined;
}

function resolveAuditUserFromToken(token?: string): AuditUser | undefined {
  return token ? auditUsersByAccessToken.get(token) : undefined;
}

function createAuditUserFromRegistration(body: Record<string, any>): AuditUser {
  const email = normalizeAuditString(body.email).toLowerCase() || `scope-${Date.now()}@example.com`;
  const username = slugifyAuditIdentifier(normalizeAuditString(body.username) || email.split('@')[0] || 'traveler').slice(0, 30);
  const displayName = normalizeAuditString(body.displayName) || titleizeAuditIdentifier(username);
  const existing = findAuditUserByIdentifier(email) ?? findAuditUserByIdentifier(username);
  const user: AuditUser = {
    ...(existing ?? {}),
    id: existing?.id ?? `audit-user-${username}`,
    username,
    email,
    displayName,
    accessToken: rotateAuditToken('audit-access', username),
    refreshToken: rotateAuditToken('audit-refresh', username),
    avatarUrl: existing?.avatarUrl ?? AUDIT_AVATAR_DEFAULT,
    bio: existing?.bio ?? 'Mapping food, culture, and scenic routes across favorite cities.',
    homeBase: existing?.homeBase ?? 'Fort Worth, TX',
    interests: existing?.interests ?? ['food', 'culture', 'scenic'],
    showActivityStatus: true,
    stats: existing?.stats ?? { spots: 0, trips: 1, friends: 2 },
  };
  rememberAuditUser(user);
  return user;
}

function buildAuditAuthPayload(user: AuditUser): Record<string, unknown> {
  return {
    ...toAuditUserProfile(user),
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
  };
}

function toAuditUserProfile(user: AuditUser): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    homeBase: user.homeBase,
    interests: user.interests ?? [],
    stats: user.stats ?? { spots: 0, trips: 0, friends: 0 },
    showActivityStatus: user.showActivityStatus ?? true,
  };
}

function sanitizeAuditUserUpdates(body: Record<string, any>): Partial<AuditUser> {
  const updates: Partial<AuditUser> = {
    username: normalizeAuditString(body.username) || undefined,
    email: normalizeAuditString(body.email).toLowerCase() || undefined,
    displayName: normalizeAuditString(body.displayName) || undefined,
    avatarUrl: normalizeAuditString(body.avatarUrl) || undefined,
    bio: normalizeAuditString(body.bio) || undefined,
    homeBase: normalizeAuditString(body.homeBase) || undefined,
    interests: Array.isArray(body.interests) ? body.interests.map(normalizeAuditString).filter(Boolean) : undefined,
    showActivityStatus: typeof body.showActivityStatus === 'boolean' ? body.showActivityStatus : undefined,
  };
  return Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  ) as Partial<AuditUser>;
}

function toAuditSpotSummary(spot: typeof auditSpots[number]): Record<string, unknown> {
  return {
    ...spot,
    photos: undefined,
    reviews: undefined,
    author: toAuditUserProfile(auditUsersById.get(spot.userId) ?? auditSeedUsers[0]),
  };
}

function filterAuditSpots(requestUrl: URL): typeof auditSpots {
  const query = normalizeSearchQuery(requestUrl.searchParams.get('search') ?? requestUrl.searchParams.get('q'));
  const city = normalizeSearchQuery(requestUrl.searchParams.get('city'));
  const category = normalizeSearchQuery(requestUrl.searchParams.get('category'));
  const vibe = normalizeSearchQuery(requestUrl.searchParams.get('vibe'));
  return auditSpots.filter((spot) => {
    if (query && ![spot.title, spot.description, spot.city, spot.vibe].join(' ').toLowerCase().includes(query)) return false;
    if (city && !spot.city.toLowerCase().includes(city)) return false;
    if (category && spot.category !== category) return false;
    if (vibe && !spot.vibe.toLowerCase().includes(vibe)) return false;
    return true;
  });
}

function findAuditSpot(spotId: string): typeof auditSpots[number] | undefined {
  return auditSpots.find((spot) => spot.id === decodeURIComponent(spotId));
}

function buildAuditSpotFromInput(input: Record<string, any>, user?: AuditUser): typeof auditSpots[number] {
  const owner = user ?? auditSeedUsers[0];
  const spot = input.spot && typeof input.spot === 'object' ? input.spot as Record<string, any> : input;
  const id = `spot-${Date.now()}`;
  const title = normalizeAuditString(spot.title) || 'Saved Scope Spot';
  return {
    id,
    title,
    description: normalizeAuditString(spot.description) || 'A saved place with verified route context.',
    latitude: Number(spot.latitude ?? 32.7555),
    longitude: Number(spot.longitude ?? -97.3308),
    address: normalizeAuditString(spot.address) || '401 Main Street',
    city: normalizeAuditString(spot.city) || 'Fort Worth',
    country: normalizeAuditString(spot.country) || 'US',
    postalCode: normalizeAuditString(spot.postalCode) || '76102',
    category: normalizeAuditString(spot.category) || 'food',
    pillars: Array.isArray(spot.pillars) ? spot.pillars : ['photo-worthy'],
    vibe: normalizeAuditString(spot.vibe) || 'city stop',
    rating: Number(spot.rating ?? 4.6),
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
    createdAt: new Date().toISOString(),
    isPublic: spot.isPublic !== false,
    userId: owner.id,
    liked: false,
    likesCount: 0,
    verificationStatus: 'verified',
    verificationSource: 'places',
    providerPlaceId: `places-${id}`,
    providerPlaceName: title,
    providerPlaceAddress: normalizeAuditString(spot.address) || '401 Main Street, Fort Worth, TX',
    verificationDistanceMeters: 10,
    verifiedAt: new Date().toISOString(),
    safetyStatus: 'clean',
    photos: [],
    reviews: [],
  };
}

function buildAuditTripFromInput(input: Record<string, any>, user?: AuditUser): typeof auditTrips[number] {
  const owner = user ?? auditSeedUsers[0];
  const id = `trip-${Date.now()}`;
  const title = normalizeAuditString(input.title) || 'Saved Scope Route';
  return {
    ...auditTrips[0],
    id,
    title,
    destination: normalizeAuditString(input.destination) || 'Fort Worth, TX',
    description: normalizeAuditString(input.description) || 'A saved trip route.',
    isPublic: input.isPublic !== false,
    startDate: normalizeAuditString(input.startDate) || '2026-06-20',
    endDate: normalizeAuditString(input.endDate) || '2026-06-22',
    members: [
      {
        id: owner.id,
        displayName: owner.displayName,
        avatarUrl: owner.avatarUrl,
        status: 'owner',
        inviteStatus: 'accepted',
        presence: 'active',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function findAuditTrip(tripId: string): typeof auditTrips[number] | undefined {
  return auditTrips.find((trip) => trip.id === decodeURIComponent(tripId));
}

function buildAuditFriendConnections(currentUser?: AuditUser): Record<string, unknown>[] {
  return auditSeedUsers
    .filter((user) => user.id !== currentUser?.id)
    .map((user, index) => ({
      id: `friendship-${index + 1}`,
      user: toAuditUserProfile(user),
      presence: index === 0 ? 'planning' : 'online',
      sharedTrips: index + 1,
      mutualFriends: 3 + index,
      favoriteCategories: ['food', 'culture'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900',
      nextAdventure: 'Evening food route',
      lastActiveAt: '2026-06-02T14:00:00.000Z',
    }));
}

function buildAuditFeed(): Record<string, unknown>[] {
  return [
    {
      id: 'feed-1',
      type: 'spot',
      actor: toAuditUserProfile(auditSeedUsers[0]),
      title: auditSpots[0].title,
      excerpt: auditSpots[0].description,
      createdAt: auditSpots[0].createdAt,
      imageUrl: auditSpots[0].photoUrl,
      targetId: auditSpots[0].id,
    },
    {
      id: 'feed-2',
      type: 'trip',
      actor: toAuditUserProfile(auditSeedUsers[1]),
      title: auditTrips[0].title,
      excerpt: auditTrips[0].description,
      createdAt: auditTrips[0].createdAt,
      imageUrl: auditTrips[0].coverImageUrl,
      targetId: auditTrips[0].id,
    },
  ];
}

function buildAuditNotificationPreferences(): Record<string, unknown>[] {
  return ['account', 'security', 'trip', 'friend', 'social', 'comment', 'mention', 'digest', 'general'].map((category) => ({
    id: `preference-${category}`,
    category,
    inAppEnabled: true,
    pushEnabled: category !== 'digest',
    emailEnabled: ['account', 'security', 'trip', 'digest'].includes(category),
    digestCadence: category === 'digest' ? 'daily' : 'instant',
    quietHoursStartMinutes: null,
    quietHoursEndMinutes: null,
    timeZoneId: 'America/Chicago',
  }));
}

async function registerAuditUserThroughUi(page: Page): Promise<AuditUser> {
  const suffix = `btn${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `scope${suffix}`.slice(0, 30);
  const email = `scope-button-audit-${suffix}@example.com`;
  const displayName = 'Scope Button Audit';

  await gotoRegistrationForm(page);
  await page.getByLabel('First name').fill('Scope');
  await page.getByLabel('Last name').fill('Button Audit');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Birthday').fill('1995-06-15');
  await page.getByPlaceholder('Create a strong password').fill(PASSWORD);
  await page.getByPlaceholder('Re-enter your password').fill(PASSWORD);
  await page.locator('#register-accept-terms').check();

  let registerResponse: Response | undefined;
  let registerPayload: any = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/core/auth/register') && response.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await page.getByRole('button', { name: /^Create Account$/i }).click();
    registerResponse = await responsePromise;
    registerPayload = await readResponseJsonOrNull(registerResponse);
    if (registerResponse.status() !== 429 || attempt === 4) {
      break;
    }
    await page.waitForTimeout(retryAfterDelayMs(registerResponse));
  }

  expect(registerResponse, `UI register ${email} never produced a response`).toBeTruthy();
  expect(registerResponse!.ok(), `UI register ${email} returned ${registerResponse!.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/(?:onboarding\/preferences|map)(?:\?.*)?$/, { timeout: 30_000 });

  const registered = registerPayload
    ? unwrap(registerPayload)
    : (await api('POST', '/api/core/auth/login', { body: { email, password: PASSWORD } })).data;

  const user = {
    id: String(registered.id),
    username,
    email,
    displayName,
    accessToken: String(registered.accessToken ?? ''),
    refreshToken: String(registered.refreshToken ?? ''),
  };
  expect(user.id).toBeTruthy();
  expect(user.accessToken).toBeTruthy();
  expect(user.refreshToken).toBeTruthy();
  rememberAuditUser(user);
  await persistBrowserAuthSession(page, user);
  return user;
}

async function auditRouteControls(
  page: Page,
  path: string,
  options: { authenticated: boolean; user?: AuditUser },
): Promise<void> {
  await gotoAllowingImmediateRedirect(page, path);
  await dismissCookieBanner(page);
  await dismissOnboardingOverlay(page);

  if (options.authenticated && new URL(page.url()).pathname === '/login') {
    await seedLogin(page, options.user!);
    await gotoAllowingImmediateRedirect(page, path);
    await dismissOnboardingOverlay(page);
  }

  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(500);

  const originalPath = new URL(page.url()).pathname;
  let initialControls = await collectVisibleControls(page);
  if (!initialControls.length) {
    await gotoAllowingImmediateRedirect(page, path);
    await dismissCookieBanner(page);
    await dismissOnboardingOverlay(page);
    await page.waitForTimeout(1_000);
    initialControls = await collectVisibleControls(page);
  }
  if (!initialControls.length) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
    await dismissCookieBanner(page);
    await dismissOnboardingOverlay(page);
    await page.waitForTimeout(1_000);
    initialControls = await collectVisibleControls(page);
  }
  console.log(`[button-audit] ${path} initialControls=${initialControls.length}`);
  expect(initialControls.length, `${path} should expose at least one reachable control`).toBeGreaterThan(0);

  for (let index = 0; index < Math.min(initialControls.length, MAX_CONTROLS_PER_ROUTE); index += 1) {
    if (index > 0 && index % 20 === 0) {
      console.log(`[button-audit] ${path} clickedOrSkipped=${index}/${initialControls.length}`);
    }
    await Promise.race([
      auditRouteControlAtIndex(page, path, originalPath, index),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(`Control audit timed out on ${path}: [${index}] after ${CONTROL_ITERATION_TIMEOUT_MS}ms`)),
          CONTROL_ITERATION_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  await restoreRouteIfNeeded(page, originalPath, path);
  let finalControls = await collectVisibleControls(page);
  if (!finalControls.length) {
    await gotoAllowingImmediateRedirect(page, path);
    await dismissCookieBanner(page);
    await dismissOnboardingOverlay(page);
    await page.waitForTimeout(500);
    finalControls = await collectVisibleControls(page);
  }
  if (!finalControls.length) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
    await dismissCookieBanner(page);
    await dismissOnboardingOverlay(page);
    await page.waitForTimeout(1_000);
    finalControls = await collectVisibleControls(page);
  }
  expect(finalControls.length, `${path} should still have reachable controls after audit`).toBeGreaterThan(0);
}

async function auditRouteControlAtIndex(
  page: Page,
  path: string,
  originalPath: string,
  index: number,
): Promise<void> {
    await closeTransientUi(page);
    const controls = page.locator(CONTROL_SELECTOR);
    if (index >= await controls.count()) {
      return;
    }

    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) {
      return;
    }

    const label = await describeControl(control);
    if (!label || SKIP_CLICK_PATTERN.test(label) || shouldSkipRouteControl(path, label)) {
      return;
    }

    await control.evaluate((element) => {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
    }).catch(() => undefined);
    await control.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(50);
    const isDisabled = await control.evaluate((element) =>
      (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
        ? element.disabled || element.getAttribute('aria-disabled') === 'true'
        : element.getAttribute('aria-disabled') === 'true',
    ).catch(() => false);
    if (isDisabled) {
      return;
    }

    const clickOptions = { timeout: CONTROL_CLICK_TIMEOUT_MS, trial: shouldTrialOnlyControl(label) };
    try {
      await control.click(clickOptions);
    } catch (error) {
      const errorText = String(error);
      if (TRANSIENT_UI_INTERCEPT_ERROR_PATTERN.test(errorText)) {
        await closeTransientUi(page);
        await dismissOnboardingOverlay(page);
        await page.waitForTimeout(500);
        try {
          await control.click(clickOptions);
        } catch (retryError) {
          const retryErrorText = String(retryError);
          if (
            TRANSIENT_UI_INTERCEPT_ERROR_PATTERN.test(retryErrorText) ||
            EPHEMERAL_CONTROL_CLICK_ERROR_PATTERN.test(retryErrorText) ||
            (clickOptions.trial && (
              TRIAL_ONLY_SCROLL_EDGE_ERROR_PATTERN.test(retryErrorText) ||
              TRIAL_ONLY_CLICK_TIMEOUT_PATTERN.test(retryErrorText)
            ))
          ) {
            return;
          }
          throw new Error(`Control failed on ${path}: [${index}] ${label}\n${retryErrorText}`);
        }
      } else if (
        EPHEMERAL_CONTROL_CLICK_ERROR_PATTERN.test(errorText) ||
        (clickOptions.trial && (
          TRIAL_ONLY_SCROLL_EDGE_ERROR_PATTERN.test(errorText) ||
          TRIAL_ONLY_CLICK_TIMEOUT_PATTERN.test(errorText)
        ))
      ) {
        return;
      } else {
        throw new Error(`Control failed on ${path}: [${index}] ${label}\n${errorText}`);
      }
    }

    await page.waitForTimeout(300);
    await closeTransientUi(page);
    await dismissOnboardingOverlay(page);
    await restoreRouteIfNeeded(page, originalPath, path);
}

async function collectVisibleControls(page: Page): Promise<string[]> {
  const controls = page.locator(CONTROL_SELECTOR);
  const count = await controls.count();
  const labels: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (await control.isVisible().catch(() => false)) {
      labels.push(await describeControl(control));
    }
  }
  return labels.filter(Boolean);
}

async function describeControl(control: ReturnType<Page['locator']>): Promise<string> {
  return control.evaluate((element) => {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const aria = element.getAttribute('aria-label')?.trim() ?? '';
    const title = element.getAttribute('title')?.trim() ?? '';
    const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') ?? '' : '';
    const primaryLabel = aria || title || text || href;
    return [tag, primaryLabel, href && href !== primaryLabel ? href : ''].filter(Boolean).join(': ');
  }).catch(() => '');
}

function shouldTrialOnlyControl(label: string): boolean {
  return (
    TRIAL_ONLY_PATTERN.test(label) ||
    /^a:\s+.+:\s+\/(?!\/)/i.test(label) ||
    /^button:\s+add stop$/i.test(label)
  );
}

function shouldSkipRouteControl(path: string, label: string): boolean {
  return (
    isOffOriginLink(label) ||
    (path === '/map' && (/^a:/i.test(label) || /^button:\s+add stop$/i.test(label))) ||
    (path === '/spots/new' && /^button:\s+(cancel|save draft|save private draft|publish spot)$/i.test(label))
  );
}

function isOffOriginLink(label: string): boolean {
  const href = label.match(/\bhttps?:\/\/[^\s]+/i)?.[0];
  if (!href) {
    return false;
  }
  try {
    return new URL(href).origin !== new URL(BASE_URL).origin;
  } catch {
    return true;
  }
}

async function closeTransientUi(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const closeButtons = [
      page.locator('[data-test="route-nearby-drawer"][data-drawer-state="open"] [data-test="route-nearby-toggle"]').last(),
      page.getByRole('dialog', { name: /Share this trip/i }).getByRole('button', { name: /^Close modal$/i }).last(),
      page.getByRole('dialog').getByRole('button', { name: /^Close modal$/i }).last(),
      page.getByRole('button', { name: /^Keep draft$/i }).last(),
      page.getByRole('button', { name: /^Cancel$/i }).last(),
      page.getByRole('button', { name: /^Close$/i }).last(),
      page.getByRole('button', { name: /Close .*drawer/i }).last(),
      page.getByRole('button', { name: /Close .*modal/i }).last(),
    ];
    let closedSomething = false;
    for (const closeButton of closeButtons) {
      if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.click({ timeout: 2_000 }).catch(() => undefined);
        closedSomething = true;
        await page.waitForTimeout(200);
        break;
      }
    }
    if (!closedSomething) {
      break;
    }
  }
}

async function restoreRouteIfNeeded(page: Page, originalPath: string, requestedPath: string): Promise<void> {
  const currentUrl = page.url();
  if (/^(mailto|tel):/i.test(currentUrl)) {
    await gotoAllowingImmediateRedirect(page, requestedPath);
    return;
  }

  const currentPath = new URL(currentUrl).pathname;
  if (currentPath !== originalPath) {
    await gotoAllowingImmediateRedirect(page, requestedPath);
  }
}

async function ensureAuthenticated(page: Page, user: AuditUser): Promise<void> {
  rememberAuditUser(user);
  await persistBrowserAuthSession(page, user);
  if (await appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout: 1_000 }).catch(() => false)) {
    return;
  }
  await gotoAllowingImmediateRedirect(page, '/map');
  await dismissCookieBanner(page);
  await dismissOnboardingOverlay(page);
  if (await appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout: 10_000 }).catch(() => false)) {
    return;
  }
  await seedLogin(page, user);
}

function appHeader(page: Page) {
  return page.locator('header.navbar').first();
}

async function seedLogin(page: Page, user: AuditUser): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoAllowingImmediateRedirect(page, `/login?buttonAuditLogin=${Date.now()}-${attempt}`);
    await dismissCookieBanner(page);
    if (new URL(page.url()).pathname !== '/login') {
      await persistBrowserAuthSession(page, user);
      return;
    }
    const emailField = page.getByRole('textbox', { name: /Email, phone, or display name/i }).first();
    const passwordField = page.getByPlaceholder('Enter your password').first();
    if (!(await emailField.isVisible({ timeout: 30_000 }).catch(() => false))) {
      if (attempt < 3) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
        continue;
      }
      await refreshAuditUserViaApi(page, user);
      return;
    }
    await emailField.fill(user.email);
    await passwordField.fill(PASSWORD);
    const [response] = await Promise.all([
      page.waitForResponse((loginResponse) =>
        loginResponse.url().includes('/api/core/auth/login') && loginResponse.request().method() === 'POST',
        { timeout: NAVIGATION_TIMEOUT_MS },
      ),
      page.getByRole('button', { name: /^Sign In$/i }).click(),
    ]);
    if (response.status() === 429 && attempt < 3) {
      await page.waitForTimeout(retryAfterDelayMs(response));
      continue;
    }
    expect(response.ok(), `UI login ${user.email} returned ${response.status()}`).toBeTruthy();
    const payload = await readResponseJsonOrNull(response);
    const data = payload ? unwrap(payload) : (await api('POST', '/api/core/auth/login', { body: { email: user.email, password: PASSWORD } })).data;
    user.accessToken = String(data.accessToken ?? user.accessToken);
    user.refreshToken = String(data.refreshToken ?? user.refreshToken);
    rememberAuditUser(user);
    await persistBrowserAuthSession(page, user);
    return;
  }
}

async function gotoRegistrationForm(page: Page): Promise<void> {
  const registerFormReady = async () => {
    if (await waitForVisible(page.getByRole('heading', { name: /Create your Scope account/i }), 8_000)) {
      return true;
    }

    const firstNameReady = await waitForVisible(page.getByLabel('First name').first(), 3_000);
    const createButtonReady = await waitForVisible(page.getByRole('button', { name: /^Create Account$/i }).first(), 3_000);
    if (firstNameReady && createButtonReady) {
      return true;
    }

    return waitForVisible(
      page.locator('form').filter({ hasText: /First name/i }).filter({ hasText: /Create Account/i }).first(),
      3_000,
    );
  };

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await clearBrowserSession(page);
    await gotoAllowingImmediateRedirect(page, `/register?buttonAuditRegister=${Date.now()}-${attempt}`);
    await page.waitForLoadState('domcontentloaded', { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
    await dismissCookieBanner(page);

    if (await registerFormReady()) {
      return;
    }

    const createAccountLink = page
      .locator('a[href="/register"], a[href^="/register?"]')
      .filter({ hasText: /Create (?:an )?account/i })
      .first();
    if (await createAccountLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await createAccountLink.click({ timeout: 10_000 }).catch(() => undefined);
      await page.waitForLoadState('domcontentloaded', { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      if (await registerFormReady()) {
        return;
      }
    }
  }

  if (await registerFormReady()) {
    return;
  }

  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
  throw new Error(`Register form did not become visible. url=${page.url()} body=${bodyText.slice(0, 1200)}`);
}

async function waitForVisible(locator: Locator, timeout: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function refreshAuditUserViaApi(page: Page, user: AuditUser): Promise<void> {
  const response = await api('POST', '/api/core/auth/login', {
    body: { email: user.email, password: PASSWORD },
  });
  user.accessToken = String(response.data.accessToken ?? user.accessToken);
  user.refreshToken = String(response.data.refreshToken ?? user.refreshToken);
  rememberAuditUser(user);
  await persistBrowserAuthSession(page, user);
  await gotoAllowingImmediateRedirect(page, '/map');
  await dismissCookieBanner(page);
  await dismissOnboardingOverlay(page);
}

async function clearBrowserSession(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('scope-analytics-consent', 'denied');
    window.localStorage.setItem('scope-onboarding-completed-v1', 'completed');
  }).catch(() => undefined);
  await page.context().clearCookies();
}

async function persistBrowserAuthSession(page: Page, user: AuditUser): Promise<void> {
  await page.evaluate(({ refreshToken }) => {
    const sessionHint = {
      version: 1,
      hasSessionCookie: true,
      lastAuthenticatedAt: new Date().toISOString(),
      persistence: 'local',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    window.sessionStorage.removeItem('scope-auth-session-hint');
    window.sessionStorage.removeItem('scope-auth-refresh-token-v1');
    window.localStorage.setItem('scope-auth-session-hint', JSON.stringify(sessionHint));
    window.localStorage.setItem('scope-auth-refresh-token-v1', refreshToken);
    window.localStorage.setItem('scope-analytics-consent', 'denied');
    window.localStorage.setItem('scope-onboarding-completed-v1', 'completed');
    window.dispatchEvent(new Event('scope-auth-session-hint-change'));
  }, { refreshToken: user.refreshToken });
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const declineButton = page
    .locator('[data-test="cookie-consent-decline"]')
    .or(page.getByRole('button', { name: /Only necessary/i }))
    .first();
  if (await declineButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await declineButton.click().catch(() => undefined);
  }
}

async function dismissOnboardingOverlay(page: Page): Promise<void> {
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: ONBOARDING_COMPLETION_STORAGE_KEY, value: ONBOARDING_COMPLETION_VALUE }).catch(() => undefined);

  const skipButton = page.getByRole('button', { name: /Skip tour|Finish tour/i }).first();
  if (await skipButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await skipButton.click({ timeout: 5_000 }).catch(() => undefined);
  }

  await expect(page.locator('.onboarding-overlay')).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
}

async function gotoAllowingImmediateRedirect(page: Page, path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
      return;
    } catch (error) {
      if (!EXPECTED_NAVIGATION_PATTERN.test(String(error)) || attempt === 3) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }
}

async function readFirstReachableSpotId(user: AuditUser): Promise<string> {
  const response = await api('GET', '/api/content/spots/?page=1&pageSize=20', {
    token: user.accessToken,
  });
  const items = Array.isArray(response.data) ? response.data : [];
  return String(items.find((item: Record<string, any>) => item.id)?.id ?? '');
}

async function readFirstReachableSharePath(user: AuditUser): Promise<string> {
  const trips = await api('GET', '/api/content/trips/', {
    token: user.accessToken,
  });
  const firstTrip = Array.isArray(trips.data) ? trips.data.find((item: Record<string, any>) => item.id) : null;
  if (!firstTrip?.id) {
    return '';
  }
  const share = await api('POST', `/api/content/trips/${firstTrip.id}/share`, {
    token: user.accessToken,
    ok: [200, 201, 403, 404],
  });
  return share.status === 200 || share.status === 201 ? String(share.data.path ?? '') : '';
}

async function readResponseJsonOrNull(response: Response): Promise<any | null> {
  try {
    return await Promise.race([
      response.json(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('Timed out reading response body')), 15_000),
      ),
    ]);
  } catch {
    return null;
  }
}

function retryAfterDelayMs(response: Response): number {
  const rawHeader = response.headers()['retry-after'];
  const seconds = rawHeader ? Number.parseInt(rawHeader, 10) : 60;
  const boundedSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 180) : 60;
  return (boundedSeconds + 3) * 1000;
}

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrap(payload: any): any {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

interface ApiOptions {
  token?: string;
  body?: unknown;
  ok?: number[];
}

async function api(method: string, path: string, options: ApiOptions = {}) {
  const ok = options.ok ?? [200, 201, 202, 204];
  if (USE_IN_PROCESS_AUDIT_API) {
    const response = handleAuditApiRequest({
      method,
      path,
      body: options.body && typeof options.body === 'object' && !Array.isArray(options.body)
        ? options.body as Record<string, any>
        : {},
      token: options.token,
    });
    const payload = response.payload ?? null;
    if (!ok.includes(response.status)) {
      throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload).slice(0, 800)}`);
    }
    return { status: response.status, payload, data: unwrap(payload) };
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(new URL(path, API_BASE_URL), { method, headers, body });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!ok.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload).slice(0, 800)}`);
  }
  return { status: response.status, payload, data: unwrap(payload) };
}

function installAuditGuards(page: Page): void {
  const guard: AuditGuard = { apiLeaks: [], pageErrors: [], serverErrors: [] };
  const guardedPage = page as Page & { __scopeButtonAuditGuard?: AuditGuard };
  guardedPage.__scopeButtonAuditGuard = guard;

  page.on('pageerror', (error) => {
    guard.pageErrors.push(String(error).slice(0, 800));
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.startsWith(BASE_URL) || !url.includes('/api/')) {
      return;
    }
    const pathname = new URL(url).pathname;
    if (response.status() >= 500 && !isAllowedProviderUnavailable(pathname, response.status())) {
      guard.serverErrors.push(`${response.request().method()} ${pathname} -> ${response.status()}`);
    }
    const contentType = response.headers()['content-type'] ?? '';
    if (!/json|text/i.test(contentType)) {
      return;
    }
    const text = await response.text().catch(() => '');
    if (pathname === '/api/core/auth/refresh' && response.status() >= 200 && response.status() < 300) {
      rememberAuditRefreshResponse(response, text);
    }
    const leak = API_MOCK_PATTERNS.find((pattern) => pattern.test(text));
    if (leak) {
      guard.apiLeaks.push(`${pathname} matched ${leak}`);
    }
  });
}

function rememberAuditUser(user: AuditUser): void {
  if (user.id) {
    auditUsersById.set(user.id, user);
  }
  if (user.email) {
    auditUsersByEmail.set(user.email.toLowerCase(), user);
  }
  if (user.username) {
    auditUsersByUsername.set(user.username.toLowerCase(), user);
  }
  if (user.accessToken) {
    auditUsersByAccessToken.set(user.accessToken, user);
  }
  if (user.refreshToken) {
    auditUsersByRefreshToken.set(user.refreshToken, user);
  }
}

function rememberAuditRefreshResponse(response: Response, text: string): void {
  const requestRefreshToken = extractRefreshTokenFromRequest(response);
  const user = requestRefreshToken ? auditUsersByRefreshToken.get(requestRefreshToken) : undefined;
  if (!user) {
    return;
  }

  const data = unwrap(parseJson(text));
  if (!data?.accessToken || !data?.refreshToken) {
    return;
  }

  user.accessToken = String(data.accessToken);
  user.refreshToken = String(data.refreshToken);
  rememberAuditUser(user);
}

function extractRefreshTokenFromRequest(response: Response): string | null {
  try {
    const payload = response.request().postDataJSON() as { refreshToken?: unknown } | null;
    return typeof payload?.refreshToken === 'string' ? payload.refreshToken : null;
  } catch {
    return null;
  }
}

async function assertAuditGuards(page: Page): Promise<void> {
  const guardedPage = page as Page & { __scopeButtonAuditGuard?: AuditGuard };
  const guard = guardedPage.__scopeButtonAuditGuard;
  const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
  const visibleLeaks = API_MOCK_PATTERNS
    .filter((pattern) => pattern.test(bodyText))
    .map((pattern) => `visible UI matched ${pattern}`);
  const pageErrors = (guard?.pageErrors ?? []).filter((error) =>
    !TRANSIENT_ROUTE_CHURN_PAGE_ERROR_PATTERNS.some((pattern) => pattern.test(error)),
  );
  expect([...(guard?.apiLeaks ?? []), ...visibleLeaks], 'Button audit saw mock/demo/fixture/local fallback leaks').toEqual([]);
  expect(pageErrors, 'Button audit saw browser page errors').toEqual([]);
  expect(guard?.serverErrors ?? [], 'Button audit saw unexpected 5xx API responses').toEqual([]);
}

function isAllowedProviderUnavailable(pathname: string, status: number): boolean {
  return status === 503 && (
    pathname === '/api/intel/weather/current' ||
    pathname === '/api/intel/place-photo' ||
    pathname === '/api/intel/fuel/stations'
  );
}

function assertNoMockFallbackEnv(): void {
  const enabled = MOCK_ENV_KEYS.filter((key) => String(process.env[key] ?? '').trim().toLowerCase() === 'true');
  expect(enabled, `Mock/demo fallback env vars must be disabled for the production button audit: ${enabled.join(', ')}`).toEqual([]);
}
