import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import { expect, test, type Browser, type Locator, type Page, type Response } from '@playwright/test';
import { buildSpotPath } from '@/utils/spotRoutes';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const PASSWORD = process.env.PLAYWRIGHT_PRODUCTION_TEST_PASSWORD ?? `ScopePass${Date.now()}!`;
const PNG_MIME = 'image/png';
const MAX_REGISTER_ATTEMPTS = 4;
const MAX_LOGIN_ATTEMPTS = 5;
const ONBOARDING_COMPLETION_STORAGE_KEY = 'scope-onboarding-completed-v1';
const ONBOARDING_COMPLETION_VALUE = 'completed';

interface LiveUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  interests?: string[];
}

interface LiveSweepData {
  suffix: string;
  owner: LiveUser;
  collaborator: LiveUser;
  notificationActor: LiveUser;
  publicViewer: LiveUser;
  nonFriend: LiveUser;
  invitedViewer: LiveUser;
  metroSpots: LiveMetroSpot[];
  spotId: string;
  spotTitle: string;
  spotDescription: string;
  uiSpotId?: string;
  uiSpotTitle?: string;
  reviewComment: string;
  friendshipId: string;
  removableFriendshipId: string;
  declineFriendshipId: string;
  tripId: string;
  tripTitle: string;
  sharePath: string;
  commentId: string;
}

interface LiveMetroSpot {
  id: string;
  title: string;
  city: string;
  latitude: number;
  longitude: number;
}

const LIVE_COORDINATES = {
  latitude: 32.74769,
  longitude: -97.32555,
};

const METRO_SPOT_SEEDS = [
  {
    city: 'Fort Worth',
    placeName: 'Fort Worth Water Gardens',
    address: '1502 Commerce St',
    country: 'US',
    postalCode: '76102',
    category: 'scenic',
    vibe: 'photo-worthy urban water garden',
    latitude: 32.74769,
    longitude: -97.32555,
  },
  {
    city: 'Chicago',
    placeName: 'Millennium Park',
    address: '201 E Randolph St',
    country: 'US',
    postalCode: '60602',
    category: 'culture',
    vibe: 'public art city park',
    latitude: 41.88265,
    longitude: -87.62255,
  },
  {
    city: 'New York',
    placeName: 'Empire State Building',
    address: '20 W 34th St',
    country: 'US',
    postalCode: '10001',
    category: 'scenic',
    vibe: 'skyline landmark observatory',
    latitude: 40.74844,
    longitude: -73.98566,
  },
  {
    city: 'Los Angeles',
    placeName: 'Walt Disney Concert Hall',
    address: '111 S Grand Ave',
    country: 'US',
    postalCode: '90012',
    category: 'culture',
    vibe: 'landmark concert hall',
    latitude: 34.05535,
    longitude: -118.24986,
  },
  {
    city: 'Seattle',
    placeName: 'Pike Place Market',
    address: '85 Pike St',
    country: 'US',
    postalCode: '98101',
    category: 'food',
    vibe: 'market food hall',
    latitude: 47.60972,
    longitude: -122.34244,
  },
  {
    city: 'Miami',
    placeName: 'Wynwood Walls',
    address: '2516 NW 2nd Ave',
    country: 'US',
    postalCode: '33127',
    category: 'culture',
    vibe: 'street art walk',
    latitude: 25.80108,
    longitude: -80.19922,
  },
  {
    city: 'Denver',
    placeName: 'Denver Union Station',
    address: '1701 Wynkoop St',
    country: 'US',
    postalCode: '80202',
    category: 'culture',
    vibe: 'historic transit hall',
    latitude: 39.75268,
    longitude: -104.99918,
  },
  {
    city: 'New Orleans',
    placeName: 'Jackson Square',
    address: '701 Decatur St',
    country: 'US',
    postalCode: '70116',
    category: 'culture',
    vibe: 'historic music square',
    latitude: 29.95750,
    longitude: -90.06300,
  },
] as const;

const MOCK_ENV_KEYS = [
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
  /demo-access/i,
  /demo-refresh/i,
  /scope-qa-/i,
  /"source"\s*:\s*"mock"/i,
  /"provider"\s*:\s*"mock"/i,
  /Local preview user/i,
  /fixture data/i,
];

const UI_MOCK_PATTERNS = [
  /Demo mode is on/i,
  /demo@scope\.travel/i,
  /demo-access/i,
  /scope-qa-/i,
  /Local preview user/i,
  /fixture data/i,
  /fake mock data/i,
];

type NoMockGuard = {
  leaks: string[];
  serverErrors: string[];
};

const LIVE_SWEEP_TIMEOUT_MS = 45 * 60 * 1000;
const ACTION_TIMEOUT_MS = 30_000;
const NAVIGATION_TIMEOUT_MS = 45_000;
const AUTH_REFRESH_PATH = '/api/core/auth/refresh';

test.describe.configure({ mode: 'serial' });
test.setTimeout(LIVE_SWEEP_TIMEOUT_MS);
test.skip(({ browserName }) => browserName !== 'chromium', 'Live no-mock sweep is Chromium-only to avoid triplicate live data setup and auth rate limits.');
test.use({ actionTimeout: ACTION_TIMEOUT_MS, navigationTimeout: NAVIGATION_TIMEOUT_MS });

let liveData: LiveSweepData;
const liveUsersByAccessToken = new Map<string, LiveUser>();
const liveUsersByRefreshToken = new Map<string, LiveUser>();
const cleanupUsers = new Map<string, LiveUser>();
const cleanupSpotIds = new Set<string>();
const cleanupTripIds = new Set<string>();

test.beforeAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(LIVE_SWEEP_TIMEOUT_MS);
  assertNoMockFallbackEnv();
  await assertStackHealth();
  liveData = await createLiveSweepData(browser);
});

test.afterAll(async ({ browser: _browser }, testInfo) => {
  testInfo.setTimeout(LIVE_SWEEP_TIMEOUT_MS);
  await cleanupLiveSweepData();
});

test.describe('live production sweep without route mocks', () => {
  test.beforeEach(async ({ page }) => {
    installNoMockGuards(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoMockLeaks(page);
  });

  test('auth/session redirects, refresh persistence, logout, and vibes/settings stay live', async ({ page }) => {
    await gotoAllowingImmediateRedirect(page, '/trips');
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Sign in to Scope/i })).toBeVisible();

    await seedSession(page, liveData.owner);

    await gotoAllowingImmediateRedirect(page, '/login');
    await expect(page).toHaveURL(/\/map$/);
    await expect(appHeader(page)).toContainText(liveData.owner.displayName);

    await gotoProtectedPath(page, liveData.owner, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: /Shape how Scope looks/i })).toBeVisible();
    await expect(page.locator('[data-test="preference-pill-food"]')).toHaveClass(/is-active/);
    await expect(page.locator('[data-test="preference-pill-scenic"]')).toHaveClass(/is-active/);

    await gotoProtectedPath(page, liveData.owner, `/profile/${liveData.owner.id}`);
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Food');
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Scenic');

    await gotoAllowingImmediateRedirect(page, '/explore');
    await selectExploreVibe(page, /Photo[- ]Worthy/i);
    await expect(page.locator('[data-test="explore-results"]')).toContainText(liveData.spotTitle);

    await assertBrowserSessionHint(page, liveData.owner, 'before explore reload persistence check');
    const refreshAfterReload = waitForOptionalAuthRefresh(page);
    await reloadAllowingImmediateRedirect(page);
    await assertAuthRefreshSucceeded(refreshAfterReload, 'explore reload persistence check');
    await expectAuthenticatedHeader(page, liveData.owner, 'after explore reload persistence check');

    await openProfileMenu(page, liveData.owner.displayName);
    const logoutResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/core/auth/logout') && response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('menuitem', { name: /Log out/i }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.ok(), `logout returned ${logoutResponse.status()}`).toBeTruthy();
    await page.waitForFunction(() =>
      !window.localStorage.getItem('scope-auth-session-hint') &&
      !window.sessionStorage.getItem('scope-auth-session-hint'),
    undefined, { timeout: 30_000 }).catch(() => undefined);

    await gotoAllowingImmediateRedirect(page, '/friends');
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  });

  test('settings autosave location and avatar globally while theme and tour state remain truthful', async ({ page }) => {
    await seedSession(page, liveData.owner);
    await gotoProtectedPath(page, liveData.owner, '/settings');

    const profileChip = page.locator('button.profile-chip').first();
    await expect(profileChip.locator('strong')).toHaveText(liveData.owner.displayName);
    await expect(page.locator('[data-test="settings-tutorial-card"]')).toContainText('Completed');
    await expect.poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), ONBOARDING_COMPLETION_STORAGE_KEY),
    ).toBe(ONBOARDING_COMPLETION_VALUE);

    const locationInput = page.getByPlaceholder('City, neighborhood, or address');
    await locationInput.fill('1502 Commerce St Fort Worth TX');
    const locationList = page.getByRole('listbox', { name: 'Location suggestions' });
    await expect(locationList).toBeVisible({ timeout: 30_000 });
    const locationOption = locationList.getByRole('option').filter({ hasText: /Fort Worth/i }).first();
    await expect(locationOption).toContainText(/Fort Worth/i);

    const locationSavePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/core/users/${liveData.owner.id}`) && response.request().method() === 'PUT',
    );
    await locationOption.click();
    const locationSave = await locationSavePromise;
    expect(locationSave.ok(), `location autosave returned ${locationSave.status()}`).toBeTruthy();

    const selectedLocation = await locationInput.inputValue();
    expect(selectedLocation).toMatch(/Fort Worth/i);
    expect(selectedLocation).toMatch(/\b(?:TX|Texas|USA|United States)\b/i);
    await expect(profileChip.locator('strong')).toHaveText(liveData.owner.displayName);

    const locationReadback = await api('GET', `/api/core/users/${liveData.owner.id}`, {
      token: liveData.owner.accessToken,
    });
    expect(locationReadback.data.displayName).toBe(liveData.owner.displayName);
    expect(locationReadback.data.homeBase).toBe(selectedLocation);

    await reloadAllowingImmediateRedirect(page);
    await expectAuthenticatedHeader(page, liveData.owner, 'after settings location reload');
    await expect(page.getByPlaceholder('City, neighborhood, or address')).toHaveValue(selectedLocation);
    await expect(page.locator('button.profile-chip').first().locator('strong')).toHaveText(liveData.owner.displayName);

    const avatarSavePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/core/users/${liveData.owner.id}`) && response.request().method() === 'PUT',
    );
    await page.locator('[data-test="settings-avatar-input"]').setInputFiles({
      name: `scope-live-avatar-${liveData.suffix}.png`,
      mimeType: PNG_MIME,
      buffer: makePng(),
    });
    const avatarSave = await avatarSavePromise;
    expect(avatarSave.ok(), `avatar autosave returned ${avatarSave.status()}`).toBeTruthy();
    const avatarPayload = await avatarSave.text()
      .then((text) => unwrap(parseJson(text)))
      .catch(async () => {
        const avatarReadback = await api('GET', `/api/core/users/${liveData.owner.id}`, {
          token: liveData.owner.accessToken,
        });
        return avatarReadback.data;
      });
    expect(String(avatarPayload.avatarUrl ?? '')).toBeTruthy();

    await expect(page.locator('button.profile-chip').first().locator('.avatar img')).toBeVisible();
    await reloadAllowingImmediateRedirect(page);
    await expect(page.locator('button.profile-chip').first().locator('.avatar img')).toBeVisible();
    await gotoProtectedPath(page, liveData.owner, `/profile/${liveData.owner.id}`);
    await expect(page.locator('[data-test="profile-header"]')).toContainText(liveData.owner.displayName);
    await expect(page.locator('[data-test="profile-avatar"] img').first()).toBeVisible();

    await gotoProtectedPath(page, liveData.owner, '/settings');
    const scenicPreference = page.locator('[data-test="preference-pill-scenic"]');
    if (!((await scenicPreference.getAttribute('class')) ?? '').includes('is-active')) {
      const interestsSavePromise = page.waitForResponse((response) =>
        response.url().includes(`/api/core/users/${liveData.owner.id}`) && response.request().method() === 'PUT',
      );
      await scenicPreference.click();
      const interestsSave = await interestsSavePromise;
      expect(interestsSave.ok(), `scenic preference autosave returned ${interestsSave.status()}`).toBeTruthy();
    }
    const preferenceReadback = await api('GET', `/api/core/users/${liveData.owner.id}`, {
      token: liveData.owner.accessToken,
    });
    expect(preferenceReadback.data.interests).toContain('scenic');
    liveData.owner.interests = Array.isArray(preferenceReadback.data.interests)
      ? [...preferenceReadback.data.interests]
      : liveData.owner.interests;

    await page.locator('[data-test="theme-option-light"]').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('scope-theme'))).toBe('light');
    await reloadAllowingImmediateRedirect(page);
    await expect(page.locator('[data-test="theme-option-light"].is-active')).toBeVisible();

    await page.locator('[data-test="settings-replay-tutorial"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toContainText('Step 1 of 3');
    await expect(page.getByRole('dialog')).toContainText('Plan the day before you go');
    await page.getByRole('button', { name: 'Skip tour' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('owner creates a verified public spot through UI and other users see it on explore, search, map, and detail', async ({ page }) => {
    await seedSession(page, liveData.owner);
    const created = await createPublicSpotThroughUi(page, liveData.suffix, liveData.owner);
    liveData.uiSpotId = created.id;
    liveData.uiSpotTitle = created.title;

    await poll('UI spot search indexing', async () => {
      const search = await api('GET', `/api/content/search?q=${encodeURIComponent(created.title)}&type=spots&limit=50`, {
        token: liveData.publicViewer.accessToken,
        ok: [200, 503],
      });
      if (search.status === 503) {
        return false;
      }
      return JSON.stringify(search.payload).includes(created.id);
    }, 45_000);

    await seedSession(page, liveData.publicViewer);

    await gotoAuthenticatedPublicPath(page, liveData.publicViewer, '/explore');
    await page.getByLabel('Search spots').fill(created.title);
    await expect(page.locator('[data-test="explore-card"]').filter({ hasText: created.title }).first()).toBeVisible();

    const quickSearch = page.locator('.quick-search-shell--desktop').getByLabel('Search Scope');
    await expect(quickSearch).toBeVisible();
    await quickSearch.fill(created.title);
    await expect(page.locator('[data-test="quick-search-result"]').filter({ hasText: created.title }).first()).toBeVisible();

    await openLiveSpotOnMap(page, created);

    await gotoAllowingImmediateRedirect(page, `/spots/${created.id}`);
    await expect(page.getByRole('heading', { level: 1, name: created.title })).toBeVisible();
    await expect(page.getByText(/photo[- ]worthy urban water garden/i).first()).toBeVisible();
    await expect(page.locator('.review-list')).toContainText(created.reviewComment);
  });

  test('eight overnight metro spots are verified, searchable, explorable, mapped, and durable from a fresh user', async ({ page }) => {
    await seedSession(page, liveData.publicViewer);

    for (const metroSpot of liveData.metroSpots) {
      await test.step(`${metroSpot.city} live spot readback`, async () => {
        const detail = await api('GET', `/api/content/spots/${metroSpot.id}`, {
          token: liveData.publicViewer.accessToken,
        });
        assertNoMockPayload(detail.payload, `${metroSpot.city} spot detail`);
        expect(detail.data.id).toBe(metroSpot.id);
        expect(detail.data.title).toBe(metroSpot.title);
        expect(detail.data.verificationStatus).toBe('verified');
        expect(detail.data.safetyStatus).toBe('clean');
        expect(detail.data.providerPlaceId).toBeTruthy();

        await poll(`${metroSpot.city} search indexing`, async () => {
          const search = await api('GET', `/api/content/search?q=${encodeURIComponent(metroSpot.title)}&type=spots&limit=20`, {
            token: liveData.publicViewer.accessToken,
            ok: [200, 503],
          });
          if (search.status === 503) {
            return false;
          }
          return JSON.stringify(search.payload).includes(metroSpot.id);
        }, 60_000);

        await gotoAllowingImmediateRedirect(page, '/explore');
        await fillExploreSearch(page, metroSpot.title);
        await expect(page.locator('[data-test="explore-card"]').filter({ hasText: metroSpot.title }).first()).toBeVisible();

        await gotoAllowingImmediateRedirect(page, `/spots/${metroSpot.id}`);
        await expect(page.getByRole('heading', { level: 1, name: metroSpot.title })).toBeVisible();
        await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();
      });
    }

    await gotoAllowingImmediateRedirect(page, '/map');
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);
    await expect(page.locator('[data-test="map-summary-pins"]')).toContainText(/pins in view/i);

    const mapCollection = await api('GET', `/api/content/spots/?page=1&pageSize=200&search=${encodeURIComponent(liveData.suffix)}`, {
      token: liveData.publicViewer.accessToken,
    });
    const mapCollectionIds = new Set((Array.isArray(mapCollection.data) ? mapCollection.data : []).map((spot: Record<string, any>) => spot.id));
    expect(Array.from(mapCollectionIds), 'All eight current overnight metro spots should be in the live map spot collection.').toEqual(
      expect.arrayContaining(liveData.metroSpots.map((spot) => spot.id)),
    );

    await selectLiveMapFeature(page, liveData.uiSpotTitle ?? liveData.spotTitle);
    await expect(page.locator('[data-test="map-summary-pins"]')).toContainText(/pins in view/i);
  });

  test('spots, explore/search, reviews, pinned profile, wishlist profile, and quick navigation use live data', async ({ page }) => {
    await seedSession(page, liveData.collaborator);

    await gotoAuthenticatedPublicPath(page, liveData.collaborator, '/explore');
    await expect(page.getByRole('heading', { level: 1, name: 'Explore standout places' })).toBeVisible();
    await fillExploreSearch(page, liveData.spotTitle);
    await expect(page.getByText(liveData.spotTitle).first()).toBeVisible();

    const quickSearch = page.locator('.quick-search-shell--desktop').getByLabel('Search Scope');
    await expect(quickSearch).toBeVisible();
    await quickSearch.fill(liveData.spotTitle);
    await expect(page.locator('[data-test="quick-search-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-test="quick-search-result"]').filter({ hasText: liveData.spotTitle }).first()).toBeVisible();

    await gotoAllowingImmediateRedirect(page, `/spots/${liveData.spotId}`);
    await expect(page.getByRole('heading', { level: 1, name: liveData.spotTitle })).toBeVisible();
    await expect(page.getByText(liveData.reviewComment)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`Remove ${escapeRegExp(liveData.spotTitle)} from saved spots`) })).toBeVisible();

    await gotoAllowingImmediateRedirect(page, '/map');
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);
    await selectLiveMapFeature(page, liveData.spotTitle);

    await gotoProtectedPath(page, liveData.collaborator, `/profile/${liveData.collaborator.id}`);
    await page.locator('[data-test="profile-collection-section"]').getByRole('button', { name: /Wishlist/ }).click();
    await expect(page.locator('[data-test="profile-collection-rail"]')).toHaveAttribute('data-active-collection', 'wishlist');
    await expect(page.locator('[data-test="profile-collection-rail"]')).toContainText(liveData.spotTitle);

    await gotoProtectedPath(page, liveData.collaborator, `/profile/${liveData.owner.id}`);
    await page.locator('[data-test="profile-collection-section"]').getByRole('button', { name: /Pinned/ }).click();
    await expect(page.locator('[data-test="profile-collection-rail"]')).toHaveAttribute('data-active-collection', 'pinned');
    await expect(page.locator('[data-test="profile-collection-rail"]')).toContainText(liveData.spotTitle);
  });

  test('friends, online status, users/profile, and notifications render live multi-user state', async ({ page }) => {
    await seedSession(page, liveData.owner);

    await gotoProtectedPath(page, liveData.owner, '/friends');
    await expect(page.getByText('Scope Live Beta Explorer')).toBeVisible();
    await expect(page.locator('[data-test="friends-online-rail"]')).toContainText(/Planning|Online/);

    const peopleSearch = page
      .locator('[data-test="main-people-search"]')
      .getByRole('searchbox', { name: /Search friends and Scope members/i });

    await peopleSearch.fill(liveData.publicViewer.email);
    await expect(page.locator('[data-test="find-people-results"]')).toContainText('Scope Live Delta Public');
    await page.locator(`[data-test="send-request-${liveData.publicViewer.id}"]`).click();
    await expect(page.locator('[data-test="find-people-results"]')).toContainText(/Request sent|Pending/i);
    await peopleSearch.fill('');
    await expect(page.locator('[data-test="main-search-results"]')).toHaveCount(0);

    await page.locator('[data-test="tab-requests"]').click();
    await expect(page.locator('[data-test="requests-grid"]')).toContainText('Scope Live Epsilon Nonfriend');
    await page.locator(`[data-test="decline-request-${liveData.declineFriendshipId}"]`).click();
    await expect(page.locator(`[data-test="decline-request-${liveData.declineFriendshipId}"]`)).toHaveCount(0);

    await page.locator('[data-test="tab-all"]').click();
    await expect(page.locator('[data-test="friends-grid"]')).toContainText('Scope Live Gamma Notifications');
    await page.locator(`[data-test="remove-friend-${liveData.removableFriendshipId}"]`).click();
    await expect(page.locator('[data-test="friends-grid"]')).not.toContainText('Scope Live Gamma Notifications');

    await gotoProtectedPath(page, liveData.owner, `/profile/${liveData.collaborator.id}`);
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Scope Live Beta Explorer');
    await expect(page.locator('[data-test="profile-header"]')).toContainText(/Planning now|Online now/);

    await page.locator('[data-test="notification-toggle"]').click();
    await expect(page.locator('[data-test="notification-menu"]')).toContainText(/Spot liked|New review posted|New comment|mentioned|accepted/i);

    await gotoProtectedPath(page, liveData.owner, '/notifications');
    await expect(page.getByRole('heading', { name: 'Scope inbox' })).toBeVisible();
    await expect(page.getByText('Spot liked')).toBeVisible();
    await expect(page.getByText('New review posted')).toBeVisible();
    await expect(page.getByText('New comment')).toBeVisible();
    await expect(page.getByText('You were mentioned')).toBeVisible();
    await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(page.getByText('0 unread')).toBeVisible();
  });

  test('trips/new sharing validates invite conditions and persists real navigation state', async ({ page, browser }) => {
    await seedSession(page, liveData.owner);

    const tripTitle = `Scope UI Shareable Weekend ${liveData.suffix}`;
    await gotoProtectedPath(page, liveData.owner, '/trips/new');
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();
    const ownerProfile = await api('GET', `/api/core/users/${liveData.owner.id}`, {
      token: liveData.owner.accessToken,
    });
    const expectedInterests = Array.isArray(ownerProfile.data.interests)
      ? ownerProfile.data.interests.filter((interest: unknown): interest is string => typeof interest === 'string')
      : liveData.owner.interests ?? [];
    expect(expectedInterests).toContain('food');
    expect(expectedInterests).toContain('scenic');
    for (const interest of expectedInterests) {
      await expect(planner.locator(`[data-test="trip-interest-${interest}"]`)).toHaveClass(/active/);
    }

    await planner.locator('[data-test="trip-title-input"]').fill(tripTitle);
    await planner.getByLabel('Start date').fill('2026-06-05');
    await planner.getByLabel('End date').fill('2026-06-07');
    await planner.locator('[data-test="destination-input"]').fill('Fort Worth, TX');
    await planner.locator('[data-test="end-destination-input"]').fill('Dallas, TX');
    await planner.locator('[data-test="budget-floor-input"]').fill('100');
    await planner.locator('[data-test="budget-ceiling-input"]').fill('650');

    const saveResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/content/trips') && ['POST', 'PUT'].includes(response.request().method()),
    );
    await page.locator('[data-test="trip-save-draft"]').click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();
    const savePayload = await saveResponse.json();
    const createdTripId = String((savePayload.data ?? savePayload).id);
    expect(createdTripId).toBeTruthy();
    cleanupTripIds.add(createdTripId);
    await expect(page.locator('[data-test="trip-autosave-status"]')).toContainText(/Autosaved|Saved/i);

    await page.locator('[data-test="trip-visibility-public"]').click();
    await expect(page.locator('[data-test="trip-visibility-public"]')).toHaveAttribute('aria-pressed', 'true');

    await expect(page.locator('[data-test="trip-share-button"]')).toBeEnabled();
    const shareResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/content/trips/${createdTripId}/share`) && response.request().method() === 'POST',
    );
    await page.locator('[data-test="trip-share-button"]').click();
    const shareResponse = await shareResponsePromise;
    expect(shareResponse.ok()).toBeTruthy();
    const sharePayload = await shareResponse.json();
    assertNoMockPayload(sharePayload, 'trips/new share link response');
    const shareData = unwrap(sharePayload);
    expect(String(shareData.token ?? '')).toBeTruthy();
    expect(String(shareData.path ?? '')).toContain('/trips/shared/');
    await expect(page.locator('[data-test="trip-share-form"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-share-link-input"]')).toHaveValue(/\/trips\/shared\//);
    await expect(page.locator('[data-test="copy-trip-link"]')).toBeEnabled();

    const uiShareUrl = await page.locator('[data-test="trip-share-link-input"]').inputValue();
    const anonymousContext = await browser.newContext({ baseURL: BASE_URL });
    try {
      const anonymousPage = await anonymousContext.newPage();
      installNoMockGuards(anonymousPage);
      await anonymousPage.goto(new URL(uiShareUrl).pathname, { waitUntil: 'domcontentloaded' });
      await expect(anonymousPage.getByText(tripTitle).first()).toBeVisible();
      await expect(anonymousPage.locator('[data-test="trip-save-draft"]')).toHaveCount(0);
      await assertNoMockLeaks(anonymousPage);
    } finally {
      await anonymousContext.close();
    }

    await page.locator('[data-test="trip-share-recipient"]').fill('555-1212');
    await page.locator('[data-test="trip-share-submit"]').click();
    await expect(page.getByText('Phone-only invites are not supported.')).toBeVisible();

    await page.locator('[data-test="trip-share-recipient"]').fill(liveData.nonFriend.email);
    await page.locator('[data-test="trip-share-role"]').getByRole('radio', { name: /Can view/i }).click();
    const inviteResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/content/trips/${createdTripId}/members`) && response.request().method() === 'POST',
    );
    await page.locator('[data-test="trip-share-submit"]').click();
    const inviteResponse = await inviteResponsePromise;
    expect(inviteResponse.ok()).toBeTruthy();
    await expect(page.getByRole('region', { name: 'Current trip crew' })).toContainText(liveData.nonFriend.displayName);
    await expect(page.getByRole('region', { name: 'Current trip crew' })).toContainText(/Viewer invite pending|Viewer/);

    await gotoProtectedPath(page, liveData.owner, '/trips');
    await expect(page.getByRole('heading', { name: 'Trip workspace' })).toBeVisible();
    await expect(page.getByText(tripTitle)).toBeVisible();

    const createdTripCard = page.locator('article').filter({ hasText: tripTitle });
    await createdTripCard.getByRole('link', { name: /Edit|Open/i }).click();
    await expect(page).toHaveURL(new RegExp(`/trips/${createdTripId}/edit$`));
    await expect(page.locator('[data-test="trip-title-input"]')).toHaveValue(tripTitle);

    await goBackExpectingPath(page, '/trips');
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText(tripTitle)).toBeVisible();
  });

  test('trips, sharing roles, anonymous links, and back navigation persistence use real routes', async ({ page }) => {
    await seedSession(page, liveData.collaborator);

    await gotoProtectedPath(page, liveData.collaborator, '/trips');
    await expect(page.getByRole('heading', { name: 'Trip workspace' })).toBeVisible();
    await expect(page.getByText(liveData.tripTitle)).toBeVisible();

    const sharedTripCard = page.locator('article.trip-document').filter({ hasText: liveData.tripTitle }).first();
    await expect(sharedTripCard).toBeVisible();
    await sharedTripCard.getByRole('link', { name: /Edit|Open|View/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/trips/${liveData.tripId}(?:/edit)?$`));
    await expect(page.getByText(liveData.tripTitle).or(page.locator('[data-test="trip-title-input"]')).first()).toBeVisible();
    await goBackExpectingPath(page, '/trips');
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText(liveData.tripTitle)).toBeVisible();

    await gotoProtectedPath(page, liveData.collaborator, `/trips/${liveData.tripId}`);
    await expect(page.getByText(liveData.tripTitle).first()).toBeVisible();
    await expect(page.getByText(liveData.spotTitle).first()).toBeVisible();

    await gotoAllowingImmediateRedirect(page, liveData.sharePath);
    await expect(page.getByText(liveData.tripTitle).first()).toBeVisible();
    await expect(page.getByText(liveData.spotTitle).first()).toBeVisible();

    await seedSession(page, liveData.invitedViewer);
    await gotoProtectedPath(page, liveData.invitedViewer, '/trips');
    await expect(page.getByText(liveData.tripTitle)).toBeVisible();
    await gotoProtectedPath(page, liveData.invitedViewer, `/trips/${liveData.tripId}/edit`);
    await expect(page.getByText(liveData.tripTitle).first()).toBeVisible();
    await expect(page.locator('[data-test="trip-save-draft"]')).toHaveCount(0);

    await seedSession(page, liveData.nonFriend);
    await gotoProtectedPath(page, liveData.nonFriend, `/trips/${liveData.tripId}`);
    await expect(page.getByText(liveData.tripTitle).first()).toBeVisible();
    await gotoProtectedPath(page, liveData.nonFriend, `/trips/${liveData.tripId}/edit`);
    await expect(page.locator('[data-test="trip-save-draft"]')).toHaveCount(0);

    await clearBrowserSession(page);
    await gotoAllowingImmediateRedirect(page, liveData.sharePath);
    await expect(page.getByText(liveData.tripTitle).first()).toBeVisible();
    await expect(page.getByText(liveData.spotTitle).first()).toBeVisible();
  });
});

async function createLiveSweepData(browser: Browser): Promise<LiveSweepData> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const owner = await registerUser(browser, 'a', 'Scope Live Alpha', suffix);
  const collaborator = await registerUser(browser, 'b', 'Scope Live Beta', suffix);
  const notificationActor = await registerUser(browser, 'c', 'Scope Live Gamma', suffix);
  const publicViewer = await registerUser(browser, 'd', 'Scope Live Delta', suffix);
  const nonFriend = await registerUser(browser, 'e', 'Scope Live Epsilon', suffix);
  const invitedViewer = await registerUser(browser, 'f', 'Scope Live Zeta', suffix);

  await api('PUT', `/api/core/users/${owner.id}`, {
    token: owner.accessToken,
    body: {
      displayName: 'Scope Live Alpha Producer',
      bio: 'Production E2E owner profile.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'scenic', 'hidden-gem'],
      showActivityStatus: true,
    },
  });
  owner.displayName = 'Scope Live Alpha Producer';
  await api('PUT', `/api/core/users/${collaborator.id}`, {
    token: collaborator.accessToken,
    body: {
      displayName: 'Scope Live Beta Explorer',
      bio: 'Production E2E collaborator profile.',
      homeBase: 'Dallas, TX',
      interests: ['culture', 'group-friendly', 'photo-worthy'],
      showActivityStatus: true,
    },
  });
  collaborator.displayName = 'Scope Live Beta Explorer';
  await api('PUT', `/api/core/users/${notificationActor.id}`, {
    token: notificationActor.accessToken,
    body: {
      displayName: 'Scope Live Gamma Notifications',
      bio: 'Production E2E notification actor profile.',
      homeBase: 'Austin, TX',
      interests: ['nightlife', 'culture'],
      showActivityStatus: true,
    },
  });
  notificationActor.displayName = 'Scope Live Gamma Notifications';
  await api('PUT', `/api/core/users/${publicViewer.id}`, {
    token: publicViewer.accessToken,
    body: {
      displayName: 'Scope Live Delta Public',
      bio: 'Production E2E public viewer profile.',
      homeBase: 'Fort Worth, TX',
      interests: ['scenic', 'photo-worthy'],
      showActivityStatus: true,
    },
  });
  publicViewer.displayName = 'Scope Live Delta Public';
  await api('PUT', `/api/core/users/${nonFriend.id}`, {
    token: nonFriend.accessToken,
    body: {
      displayName: 'Scope Live Epsilon Nonfriend',
      bio: 'Production E2E non-friend profile.',
      homeBase: 'Denton, TX',
      interests: ['food', 'adventure'],
      showActivityStatus: false,
    },
  });
  nonFriend.displayName = 'Scope Live Epsilon Nonfriend';
  await api('PUT', `/api/core/users/${invitedViewer.id}`, {
    token: invitedViewer.accessToken,
    body: {
      displayName: 'Scope Live Zeta Viewer',
      bio: 'Production E2E viewer-only trip collaborator.',
      homeBase: 'Plano, TX',
      interests: ['shopping', 'scenic'],
      showActivityStatus: true,
    },
  });
  invitedViewer.displayName = 'Scope Live Zeta Viewer';

  await api('PUT', '/api/core/presence/heartbeat', {
    token: owner.accessToken,
    body: { status: 'online', routeContext: 'Live E2E owner session', isPlanning: false },
  });
  await api('PUT', '/api/core/presence/heartbeat', {
    token: collaborator.accessToken,
    body: { status: 'planning', routeContext: 'Live E2E shared route', isPlanning: true },
  });
  await api('PUT', '/api/core/presence/heartbeat', {
    token: notificationActor.accessToken,
    body: { status: 'online', routeContext: 'Live E2E notifications', isPlanning: false },
  });
  await api('PUT', '/api/core/presence/heartbeat', {
    token: invitedViewer.accessToken,
    body: { status: 'online', routeContext: 'Live E2E viewer route', isPlanning: false },
  });

  await assertProviderSourceDisclosure(owner);

  const metroSpots = await createVerifiedMetroSpots(owner, suffix);
  const spot = metroSpots.find((entry) => entry.city === 'Fort Worth') ?? metroSpots[0];
  const spotDescription = `Live public spot from production sweep ${suffix}. Search, reviews, saves, profile collections, and trips must use this row.`;
  const spotTitle = String(spot.title);
  expect(spotTitle).toContain(`Scope Overnight ${suffix}`);

  await api('GET', `/api/content/spots/explore?q=${encodeURIComponent(spotTitle)}&pageSize=50`, {
    token: collaborator.accessToken,
    assert: (data, payload) => {
      expect(JSON.stringify(payload)).toContain(spot.id);
      return data;
    },
  });
  await poll('Elasticsearch search indexing', async () => {
    const search = await api('GET', `/api/content/search?q=${encodeURIComponent(spotTitle)}&type=spots&limit=50`, {
      ok: [200, 503],
    });
    if (search.status === 503) {
      return false;
    }
    const results = search.payload?.results ?? [];
    return results.some((entry: Record<string, unknown>) => String(entry.id ?? entry.spotId ?? '').toLowerCase() === spot.id.toLowerCase());
  });

  await api('POST', `/api/content/spots/${spot.id}/like`, { token: collaborator.accessToken });
  await api('GET', '/api/content/spots/saved?pageSize=50', {
    token: collaborator.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(spot.id);
    },
  });

  const reviewComment = `Review from live production E2E ${suffix}`;
  const review = await api('POST', `/api/content/reviews/spot/${spot.id}`, {
    token: collaborator.accessToken,
    body: { rating: '4.6', comment: reviewComment },
  });
  await loginUser(owner);
  await api('GET', `/api/content/reviews/spot/${spot.id}`, {
    token: owner.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(review.data.id);
    },
  });

  const friendRequest = await api('POST', `/api/core/friends/request/${collaborator.id}`, { token: owner.accessToken });
  const friendshipId = friendRequest.data.friendshipId;
  await api('GET', '/api/core/friends/pending', {
    token: collaborator.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(friendshipId);
    },
  });
  await poll('friend request notification', () =>
    findNotification(collaborator, (notification) =>
      notification.type === 'friend.request' && String(notification.referenceId) === String(friendshipId),
    ),
  );
  await api('PUT', `/api/core/friends/${friendshipId}/accept`, {
    token: collaborator.accessToken,
    assert: (data) => {
      expect(['online', 'planning']).toContain(data.presence);
    },
  });
  await api('GET', '/api/core/friends?pageSize=20', {
    token: owner.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(collaborator.id);
      expect(JSON.stringify(payload)).toContain('planning');
    },
  });
  await poll('friend accepted notification', () =>
    findNotification(owner, (notification) =>
      notification.type === 'friend.accepted' && String(notification.referenceId) === String(friendshipId),
    ),
  );

  const friendRequestFromNotification = await api('POST', `/api/core/friends/request/${owner.id}`, {
    token: notificationActor.accessToken,
  });
  const removableFriendshipId = String(friendRequestFromNotification.data.friendshipId);
  const notificationToAccept = await poll('notification action friend request', () =>
    findNotification(owner, (notification) =>
      notification.type === 'friend.request' &&
      String(notification.referenceId) === String(friendRequestFromNotification.data.friendshipId),
    ),
  );
  await api('POST', `/api/core/notifications/${notificationToAccept.id}/actions`, {
    token: owner.accessToken,
    body: { action: 'accept_friend_request' },
  });
  await api('GET', '/api/core/friends?pageSize=20', {
    token: owner.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(notificationActor.id);
      expect(JSON.stringify(payload)).toContain(removableFriendshipId);
    },
  });

  const declineFriendship = await api('POST', `/api/core/friends/request/${owner.id}`, {
    token: nonFriend.accessToken,
  });
  const declineFriendshipId = String(declineFriendship.data.friendshipId);
  await api('GET', '/api/core/friends/pending', {
    token: owner.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(declineFriendshipId);
      expect(JSON.stringify(payload)).toContain(nonFriend.id);
    },
  });

  const tripTitle = `Scope Shared Production Trip ${suffix}`;
  const trip = await api('POST', '/api/content/trips/', {
    token: owner.accessToken,
    body: {
      title: tripTitle,
      destination: 'Fort Worth, TX',
      description: 'Live shared trip from production sweep.',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      budget: '650.00',
      currency: 'USD',
      status: 'planning',
      isPublic: true,
      spots: [{ spotId: spot.id, dayNumber: 1, sortOrder: 0, notes: 'Anchor stop from live public spot.' }],
    },
  });
  cleanupTripIds.add(String(trip.data.id));
  await api('POST', `/api/content/trips/${trip.data.id}/members`, {
    token: owner.accessToken,
    body: { user_id: collaborator.id, role: 'editor' },
  });
  await api('POST', `/api/content/trips/${trip.data.id}/members`, {
    token: owner.accessToken,
    body: { user_id: invitedViewer.id, role: 'viewer' },
  });
  await api('GET', '/api/content/trips/', {
    token: collaborator.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(trip.data.id);
    },
  });
  await api('GET', '/api/content/trips/', {
    token: invitedViewer.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(trip.data.id);
    },
  });
  await poll('trip invite notification', () =>
    findNotification(collaborator, (notification) =>
      notification.type === 'trip.member.added' && String(notification.referenceId) === String(trip.data.id),
    ),
  );
  await poll('viewer trip invite notification', () =>
    findNotification(invitedViewer, (notification) =>
      notification.type === 'trip.member.added' && String(notification.referenceId) === String(trip.data.id),
    ),
  );
  const share = await api('POST', `/api/content/trips/${trip.data.id}/share`, { token: owner.accessToken });
  await api('GET', `/api/content/trips/share/${share.data.token}`, {
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(tripTitle);
    },
  });
  await api('PUT', `/api/content/trips/${trip.data.id}/spots/reorder`, {
    token: collaborator.accessToken,
    body: { spots: [{ spotId: spot.id, sortOrder: 1, dayNumber: 2 }] },
  });

  const comment = await api('POST', '/api/content/comments/', {
    token: collaborator.accessToken,
    body: {
      targetType: 'spot',
      targetId: spot.id,
      body: `@${owner.username} live comment mention ${suffix}`,
      mentionedUserIds: [owner.id],
    },
  });
  await poll('comment notification', () =>
    findNotification(owner, (notification) =>
      notification.type === 'comment.created' && String(notification.referenceId) === String(comment.data.id),
    ),
  );
  await poll('mention notification', () =>
    findNotification(owner, (notification) =>
      notification.type === 'mention.created' && String(notification.referenceId) === String(comment.data.id),
    ),
  );
  await poll('spot like notification', () =>
    findNotification(owner, (notification) =>
      notification.type === 'spot.liked' && String(notification.referenceId) === String(spot.id),
    ),
  );
  await poll('review notification', () =>
    findNotification(owner, (notification) =>
      notification.type === 'review.created' && String(notification.referenceId) === String(spot.id),
    ),
  );

  const vibe = await api('POST', '/api/intel/vibe-match', {
    token: collaborator.accessToken,
    body: { description: 'photo-worthy scenic water garden for a group weekend', limit: 5 },
  });
  expect(Array.isArray(vibe.data.matches ?? vibe.data.recommendations ?? [])).toBeTruthy();

  const preference = await api('PUT', '/api/core/notifications/preferences', {
    token: collaborator.accessToken,
    body: {
      category: 'trip',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'daily',
      quietHoursStartMinutes: 1320,
      quietHoursEndMinutes: 420,
      timeZoneId: 'America/Chicago',
    },
  });
  expect(preference.data.category).toBe('trip');
  const push = await api('POST', '/api/core/notifications/push-subscriptions', {
    token: collaborator.accessToken,
    body: {
      endpoint: `https://updates.push.services.mozilla.com/wpush/v2/scope-live-${suffix}`,
      p256dh: 'p256dh-live-e2e',
      auth: 'auth-live-e2e',
      userAgent: 'Scope Playwright Real Stack',
    },
  });
  expect(push.data.isEnabled).toBe(true);
  await api('DELETE', `/api/core/notifications/push-subscriptions/${push.data.id}`, {
    token: collaborator.accessToken,
    ok: [204],
  });
  await api('GET', '/api/core/notifications/unread-count', {
    token: collaborator.accessToken,
    assert: (data) => {
      expect(typeof data.count).toBe('number');
    },
  });

  await api('GET', `/api/core/users/${owner.id}`, {
    token: collaborator.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain('Fort Worth');
    },
  });
  await api('GET', `/api/core/users/search?q=${encodeURIComponent(owner.username)}`, {
    token: collaborator.accessToken,
    assert: (_data, payload) => {
      expect(JSON.stringify(payload)).toContain(owner.id);
    },
  });
  await api('GET', `/api/core/users/${owner.id}/stats`, {
    token: collaborator.accessToken,
    assert: (data) => {
      expect(typeof data.friends).toBe('number');
    },
  });

  return {
    suffix,
    owner,
    collaborator,
    notificationActor,
    publicViewer,
    nonFriend,
    invitedViewer,
    metroSpots,
    spotId: spot.id,
    spotTitle,
    spotDescription,
    reviewComment,
    friendshipId,
    removableFriendshipId,
    declineFriendshipId,
    tripId: trip.data.id,
    tripTitle,
    sharePath: share.data.path,
    commentId: comment.data.id,
  };
}

async function createPublicSpotThroughUi(
  page: Page,
  suffix: string,
  owner: LiveUser,
): Promise<{ id: string; title: string; submittedTitle: string; reviewComment: string; city: string; country: string }> {
  const title = `Fort Worth Water Gardens UI Scope ${suffix}`;
  const form = page.locator('[data-test="spot-form"]');

  await gotoProtectedPath(page, owner, '/spots/new');
  await dismissCookieBanner(page);
  await expect(page).toHaveURL(/\/spots\/new$/);
  await expect(page.getByRole('heading', { name: 'New spot' })).toBeVisible();
  await expect(form).toBeVisible();

  await form.locator('[data-test="photo-upload-input"]').setInputFiles({
    name: 'scope-live-ui-water-gardens.png',
    mimeType: PNG_MIME,
    buffer: makePng(),
  });
  await expect(form.locator('[data-test="photo-preview-card"]')).toHaveCount(1);

  await form.getByRole('textbox', { name: 'Place' }).fill(title);
  await form.getByLabel('Description').fill(`Live UI-created public spot ${suffix} with provider-backed verification and real search fanout.`);
  await form.getByLabel('Address').fill('1502 Commerce St');
  await form.getByLabel('City').fill('Fort Worth');
  await form.getByLabel('Country').fill('US');
  await form.getByLabel('ZIP code').fill('76102');
  await form.getByLabel('Spot category').selectOption('scenic');
  await form.getByLabel('Optional vibe').fill('photo-worthy urban water garden');
  await form.getByLabel('Rating').fill('4.9');
  await form.getByLabel('Visited at').fill('2026-05-21');
  await form.getByLabel('Latitude').fill(String(LIVE_COORDINATES.latitude));
  await form.getByLabel('Longitude').fill(String(LIVE_COORDINATES.longitude));

  const pillarOptions = form.locator('[data-test="pillar-options"]');
  await pillarOptions.getByRole('button', { name: /Photo-worthy/i }).click();
  await pillarOptions.getByRole('button', { name: /Group-friendly/i }).click();
  await expect(pillarOptions.getByRole('button', { name: /Photo-worthy/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(pillarOptions.getByRole('button', { name: /Group-friendly/i })).toHaveAttribute('aria-pressed', 'true');

  await form.locator('[data-test="visibility-control"]').getByRole('button', { name: /^Public$/ }).click();
  await expect(form.locator('[data-test="visibility-control"]').getByRole('button', { name: /^Public$/ })).toHaveAttribute('aria-pressed', 'true');

  let payload: unknown;
  let composed = false;
  const submitButton = form.locator('[data-test="spot-submit"]');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await submitButton.scrollIntoViewIfNeeded();
    await expect(submitButton, `UI spot submit should be enabled before compose attempt ${attempt + 1}`).toBeEnabled({ timeout: 30_000 });
    const composeResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/content/spots/compose') && response.request().method() === 'POST',
      { timeout: 120_000 },
    );
    console.log(`[live-sweep] UI spot submit attempt ${attempt + 1} ${title}`);
    await submitButton.click({ timeout: 30_000 });

    let composeResponse = await composeResponsePromise;
    if (composeResponse.status() === 401) {
      const retriedComposeResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/content/spots/compose') &&
          response.request().method() === 'POST' &&
          response.status() !== 401,
        { timeout: 90_000 },
      ).catch(() => null);
      if (retriedComposeResponse) {
        composeResponse = retriedComposeResponse;
      }
    }
    console.log(`[live-sweep] UI spot compose response ${composeResponse.status()} ${title}`);
    payload = await readResponseJsonOrNull(composeResponse, `UI spot compose ${title}`);
    if (!payload && composeResponse.ok()) {
      payload = { data: await readSpotByExactTitle(owner, title) };
    }
    if (!payload) {
      throw new Error(`UI spot compose returned unreadable JSON with ${composeResponse.status()}`);
    }
    if (composeResponse.ok()) {
      composed = true;
      break;
    }
    if (composeResponse.status() === 400 && /Place verification is unavailable right now/i.test(JSON.stringify(payload))) {
      await delay(Math.min(15_000, 2_000 + attempt * 2_000));
      continue;
    }
    throw new Error(`UI spot compose failed with ${composeResponse.status()}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  if (!composed) {
    throw new Error(`UI spot compose never returned success: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  assertNoMockPayload(payload, 'UI spot compose response');
  const spot = unwrap(payload);
  expect(spot.id).toBeTruthy();
  expect(spot.verificationStatus).toBe('verified');
  expect(spot.safetyStatus).toBe('clean');
  expect(spot.providerPlaceId).toBeTruthy();
  cleanupSpotIds.add(String(spot.id));

  const canonicalTitle = String(spot.title ?? title);
  const reviewComment = `Live UI-created public spot ${suffix} with provider-backed verification and real search fanout`;

  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(buildSpotPath(spot))}$`));
  await expect(page.getByRole('heading', { level: 1, name: canonicalTitle })).toBeVisible();
  await expect(page.locator('.review-list')).toContainText(reviewComment);

  return {
    id: String(spot.id),
    title: canonicalTitle,
    submittedTitle: title,
    reviewComment,
    city: String(spot.city ?? 'Fort Worth'),
    country: String(spot.country ?? 'US'),
  };
}

async function assertProviderSourceDisclosure(owner: LiveUser): Promise<void> {
  await verifyProviderPlace(owner, {
    title: 'Fort Worth Water Gardens',
    address: '1502 Commerce St',
    city: 'Fort Worth',
    country: 'US',
    postalCode: '76102',
    latitude: LIVE_COORDINATES.latitude,
    longitude: LIVE_COORDINATES.longitude,
  }, 'Fort Worth Water Gardens place verification');

  const weather = await api('GET', `/api/intel/weather/current?lat=${LIVE_COORDINATES.latitude}&lng=${LIVE_COORDINATES.longitude}`, {
    token: owner.accessToken,
    ok: [200, 503],
  });
  if (weather.status === 503) {
    assertClearProviderUnavailable(weather.payload, 'weather provider');
  } else {
    assertNoMockPayload(weather.payload, 'weather provider payload');
    expect(String(weather.data.provider ?? weather.data.source ?? '')).not.toMatch(/mock|demo|fallback/i);
  }

  const fuel = await api('GET', `/api/intel/fuel/stations?lat=${LIVE_COORDINATES.latitude}&lng=${LIVE_COORDINATES.longitude}&limit=3`, {
    token: owner.accessToken,
  });
  assertNoMockPayload(fuel.payload, 'fuel provider payload');
  expect(Array.isArray(fuel.data.stations)).toBeTruthy();
  if (fuel.data.configured === false || !fuel.data.stations.length) {
    expect(JSON.stringify(fuel.payload)).toMatch(/GOOGLE_PLACES_API_KEY|configured|coverage|unavailable/i);
  } else {
    expect(String(fuel.data.source ?? '')).not.toMatch(/mock|demo|fallback/i);
  }

  const photo = await api('GET', `/api/intel/place-photo?q=${encodeURIComponent('Fort Worth Water Gardens')}&address=${encodeURIComponent('1502 Commerce St, Fort Worth, TX')}&lat=${LIVE_COORDINATES.latitude}&lng=${LIVE_COORDINATES.longitude}&maxWidthPx=512`, {
    token: owner.accessToken,
  });
  assertNoMockPayload(photo.payload, 'place photo payload');
  if (!photo.data.photoUrl) {
    expect(JSON.stringify(photo.payload)).toMatch(/GOOGLE_PLACES_API_KEY|configured|coverage|unavailable|No Google Places photo/i);
  } else {
    expect(String(photo.data.photoUrl)).toMatch(/^https:\/\//);
    expect(String(photo.data.source ?? '')).not.toMatch(/mock|demo|fallback/i);
  }
}

async function registerUser(browser: Browser, label: string, displayName: string, suffix: string): Promise<LiveUser> {
  const username = `scope${label}${suffix}`.slice(0, 30);
  const email = `scope-live-${label}-${suffix}@example.com`;
  const [firstName, ...lastNameParts] = displayName.split(/\s+/).filter(Boolean);
  const lastName = lastNameParts.join(' ') || 'Traveler';
  const context = await browser.newContext({ baseURL: BASE_URL });

  try {
    const page = await context.newPage();
    installNoMockGuards(page);
    console.log(`[live-sweep] register UI start ${email}`);
    await gotoRegistrationForm(page);
    await page.getByLabel('First name').fill(firstName || 'Scope');
    await page.getByLabel('Last name').fill(lastName);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Birthday').fill('1995-06-15');
    await page.getByPlaceholder('Create a strong password').fill(PASSWORD);
    await page.getByPlaceholder('Re-enter your password').fill(PASSWORD);
    await page.locator('#register-accept-terms').check();

    let registerResponse: Response | undefined;
    let registerPayload: any;
    for (let attempt = 1; attempt <= MAX_REGISTER_ATTEMPTS; attempt += 1) {
      const registerResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/core/auth/register') && response.request().method() === 'POST',
        { timeout: 60_000 },
      );
      await page.getByRole('button', { name: /^Create Account$/i }).click();
      registerResponse = await registerResponsePromise.catch(async (error) => {
        if (attempt < MAX_REGISTER_ATTEMPTS) {
          const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
          console.log(`[live-sweep] UI register ${email} did not produce a response on attempt ${attempt}/${MAX_REGISTER_ATTEMPTS}; retrying. url=${page.url()} body=${bodyText.slice(0, 240).replace(/\s+/g, ' ')}`);
          await page.waitForTimeout(Math.min(20_000, 3_000 + attempt * 4_000));
          return null as unknown as Response;
        }
        const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
        throw new Error(`UI register ${email} did not submit. url=${page.url()} body=${bodyText.slice(0, 1600)} cause=${String(error)}`);
      });
      if (!registerResponse) {
        continue;
      }
      registerPayload = await readResponseJsonOrNull(registerResponse, `UI register ${email}`);
      if (registerPayload !== null) {
        assertNoMockPayload(registerPayload, `UI register ${email}`);
      }

      if (registerResponse.status() !== 429 || attempt === MAX_REGISTER_ATTEMPTS) {
        break;
      }

      const waitMs = retryAfterDelayMs(registerResponse);
      console.log(`[live-sweep] register UI rate-limited ${email}; waiting ${Math.ceil(waitMs / 1000)}s before retry ${attempt + 1}/${MAX_REGISTER_ATTEMPTS}`);
      await page.waitForTimeout(waitMs);
    }

    expect(registerResponse, `UI register ${email} never produced a response`).toBeTruthy();
    if (registerPayload !== null) {
      assertNoMockPayload(registerPayload, `UI register ${email}`);
    }
    if (registerResponse!.status() === 409) {
      console.log(`[live-sweep] UI register ${email} already completed before the retry response; recovering through login.`);
      const recoveredUser = (await api('POST', '/api/core/auth/login', {
        body: { email, password: PASSWORD },
      })).data as LiveUser;
      assertNoMockPayload(recoveredUser, `UI register conflict login recovery ${email}`);
      expect(recoveredUser.id).toBeTruthy();
      expect(recoveredUser.accessToken).toBeTruthy();
      expect(recoveredUser.refreshToken).toBeTruthy();
      const liveUser = {
        ...recoveredUser,
        username,
        email,
        displayName,
      };
      rememberLiveUser(liveUser);
      cleanupUsers.set(liveUser.id, liveUser);
      return liveUser;
    }
    expect(registerResponse!.ok(), `UI register ${email} returned ${registerResponse!.status()}: ${JSON.stringify(registerPayload ?? { bodyUnavailable: true }).slice(0, 800)}`).toBeTruthy();
    await expect(page).toHaveURL(/\/(?:onboarding\/preferences|map)(?:\?.*)?$/, { timeout: 30_000 });
    await assertNoMockLeaks(page);

    const registeredUser = registerPayload !== null
      ? unwrap(registerPayload) as LiveUser
      : (await api('POST', '/api/core/auth/login', {
        body: { email, password: PASSWORD },
      })).data as LiveUser;
    assertNoMockPayload(registeredUser, `UI register readback ${email}`);
    expect(registeredUser.id).toBeTruthy();
    expect(registeredUser.accessToken).toBeTruthy();
    expect(registeredUser.refreshToken).toBeTruthy();
    const liveUser = {
      ...registeredUser,
      username,
      email,
      displayName,
    };
    rememberLiveUser(liveUser);
    cleanupUsers.set(liveUser.id, liveUser);
    return liveUser;
  } finally {
    console.log(`[live-sweep] register UI done ${email}`);
    await context.close();
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const declineButton = page
    .locator('[data-test="cookie-consent-decline"]')
    .or(page.getByRole('button', { name: /Only necessary/i }))
    .first();
  if (await declineButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await declineButton.click();
    await page.getByRole('region', { name: /optional analytics cookies/i }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }
}

async function readResponseJsonOrNull(response: Response, label: string): Promise<any | null> {
  try {
    return await Promise.race([
      response.json(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Timed out reading ${label} response body`)), 15_000),
      ),
    ]);
  } catch (error) {
    console.log(`[live-sweep] ${label} response body unavailable after navigation; using live API readback. ${String(error).slice(0, 240)}`);
    return null;
  }
}

function retryAfterDelayMs(response: Response): number {
  const rawHeader = response.headers()['retry-after'];
  const seconds = rawHeader ? Number.parseInt(rawHeader, 10) : 60;
  const boundedSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 180) : 60;
  return (boundedSeconds + 3) * 1000;
}

async function loginUser(user: LiveUser): Promise<void> {
  const response = await api('POST', '/api/core/auth/login', {
    body: { email: user.email, password: PASSWORD },
  });
  expect(response.data.id).toBe(user.id);
  expect(response.data.accessToken).toBeTruthy();
  expect(response.data.refreshToken).toBeTruthy();
  user.accessToken = response.data.accessToken;
  user.refreshToken = response.data.refreshToken;
  rememberLiveUser(user);
}

function rememberLiveUser(user: LiveUser): void {
  if (user.accessToken) {
    liveUsersByAccessToken.set(user.accessToken, user);
  }
  if (user.refreshToken) {
    liveUsersByRefreshToken.set(user.refreshToken, user);
  }
}

async function createVerifiedMetroSpots(owner: LiveUser, suffix: string): Promise<LiveMetroSpot[]> {
  const createdSpots: LiveMetroSpot[] = [];
  for (const seed of METRO_SPOT_SEEDS) {
    createdSpots.push(await createVerifiedMetroSpot(owner, suffix, seed));
  }
  return createdSpots;
}

async function readSpotByExactTitle(user: LiveUser, title: string): Promise<Record<string, any>> {
  return poll(`live spot readback ${title}`, async () => {
    const response = await api('GET', `/api/content/spots/?page=1&pageSize=20&search=${encodeURIComponent(title)}`, {
      token: user.accessToken,
    });
    assertNoMockPayload(response.payload, `live spot readback ${title}`);
    const items = Array.isArray(response.data) ? response.data : [];
    const exact = items.find((spot: Record<string, any>) => spot.title === title);
    return exact;
  }, 60_000);
}

async function createVerifiedMetroSpot(
  owner: LiveUser,
  suffix: string,
  seed: typeof METRO_SPOT_SEEDS[number],
): Promise<LiveMetroSpot> {
  const verification = await verifyProviderPlace(owner, {
    title: seed.placeName,
    address: seed.address,
    city: seed.city,
    country: seed.country,
    postalCode: seed.postalCode,
    latitude: seed.latitude,
    longitude: seed.longitude,
  }, `${seed.city} place verification`);

  const expectedTitle = `${seed.placeName} Scope Overnight ${suffix}`;
  const description = `Scope Overnight ${suffix} verified public spot for ${seed.city}. Search, explore, map, reviews, trips, and profiles must read this live database row.`;
  const form = () => {
    const formData = new FormData();
    formData.append('spot', JSON.stringify({
      title: expectedTitle,
      description,
      address: seed.address,
      city: seed.city,
      country: seed.country,
      postalCode: seed.postalCode,
      category: seed.category,
      vibe: seed.vibe,
      pillars: ['photo-worthy', 'group-friendly'],
      rating: '4.8',
      visitedAt: '2026-05-21',
      latitude: seed.latitude,
      longitude: seed.longitude,
      providerPlaceId: verification.data.providerPlaceId,
      providerPlaceName: verification.data.providerPlaceName,
      providerPlaceAddress: verification.data.providerPlaceAddress,
      isPublic: true,
    }));
    formData.append('photos', new Blob([makePng()], { type: PNG_MIME }), `scope-live-${seed.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
    formData.append('captions', `${seed.city} production E2E proof image`);
    formData.append('sortOrders', '0');
    return formData;
  };

  const response = await api('POST', '/api/content/spots/compose', {
    token: owner.accessToken,
    form,
  });
  expect(response.data.id).toBeTruthy();
  cleanupSpotIds.add(String(response.data.id));
  expect(response.data.verificationStatus).toBe('verified');
  expect(response.data.safetyStatus).toBe('clean');
  expect(response.data.providerPlaceId).toBeTruthy();
  const detail = await api('GET', `/api/content/spots/${response.data.id}`, {
    token: owner.accessToken,
    assert: (data) => {
      expect(data.id).toBe(response.data.id);
      expect(data.title).toBe(expectedTitle);
      expect(data.city).toBe(seed.city);
      expect(data.verificationStatus).toBe('verified');
      expect(data.safetyStatus).toBe('clean');
    },
  });
  return {
    id: response.data.id,
    title: detail.data.title,
    city: seed.city,
    latitude: seed.latitude,
    longitude: seed.longitude,
  };
}

async function cleanupLiveSweepData(): Promise<void> {
  const errors: string[] = [];
  const owner = liveData?.owner ?? Array.from(cleanupUsers.values())[0];

  if (owner) {
    for (const tripId of Array.from(cleanupTripIds).reverse()) {
      try {
        await api('DELETE', `/api/content/trips/${tripId}`, {
          token: owner.accessToken,
          ok: [204, 404],
        });
      } catch (error) {
        errors.push(`trip ${tripId}: ${String(error)}`);
      }
    }

    for (const spotId of Array.from(cleanupSpotIds).reverse()) {
      try {
        await api('DELETE', `/api/content/spots/${spotId}`, {
          token: owner.accessToken,
          ok: [204, 404],
        });
      } catch (error) {
        errors.push(`spot ${spotId}: ${String(error)}`);
      }
    }
  } else if (cleanupSpotIds.size || cleanupTripIds.size) {
    errors.push('content cleanup had no registered owner token');
  }

  for (const user of Array.from(cleanupUsers.values()).reverse()) {
    try {
      await api('DELETE', '/api/content/users/me', {
        token: user.accessToken,
        headers: {
          'X-Scope-Account-Deletion': 'confirm',
        },
        ok: [204],
      });
    } catch (error) {
      errors.push(`content user ${user.id}: ${String(error)}`);
    }

    try {
      await api('DELETE', `/api/core/users/${user.id}`, {
        token: user.accessToken,
        ok: [204, 404],
      });
    } catch (error) {
      errors.push(`user ${user.id}: ${String(error)}`);
    }
  }

  if (errors.length) {
    throw new Error(`Live sweep cleanup failed:\n${errors.join('\n')}`);
  }
}

async function seedSession(page: Page, user: LiveUser): Promise<void> {
  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt += 1) {
    await clearBrowserSession(page);
    await gotoLoginForm(page);
    await dismissCookieBanner(page);

    const emailField = loginEmailField(page);
    const passwordField = loginPasswordField(page);
    if (!(await emailField.isVisible({ timeout: 30_000 }).catch(() => false))) {
      if (await appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout: 1_000 }).catch(() => false)) {
        await persistBrowserAuthSession(page, user);
        return;
      }
      if (attempt < MAX_LOGIN_ATTEMPTS) {
        continue;
      }
      await loginUser(user);
      await hydrateBrowserSessionOnMap(page, user, `seed session API fallback ${user.email}`);
      return;
    }

    await emailField.fill(user.email);
    await passwordField.fill(PASSWORD);

    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/core/auth/login') && response.request().method() === 'POST'),
      page.getByRole('button', { name: /^Sign In$/i }).click(),
    ]);

    if (loginResponse.status() === 429 && attempt < MAX_LOGIN_ATTEMPTS) {
      await delay(retryAfterDelayMs(loginResponse));
      continue;
    }
    if (!loginResponse.ok()) {
      throw new Error(`UI login for ${user.email} returned ${loginResponse.status()}`);
    }

    const loginPayload = await readResponseJsonOrNull(loginResponse, `UI login ${user.email}`);
    const loginData = loginPayload ? unwrap(loginPayload) : null;
    if (loginData?.accessToken && loginData?.refreshToken) {
      user.accessToken = loginData.accessToken;
      user.refreshToken = loginData.refreshToken;
      rememberLiveUser(user);
    } else {
      const browserRefreshToken = await readBrowserRefreshToken(page);
      if (browserRefreshToken) {
        user.refreshToken = browserRefreshToken;
        rememberLiveUser(user);
      } else {
        await loginUser(user);
        await persistBrowserAuthSession(page, user);
        await reloadAllowingImmediateRedirect(page);
      }
    }
    await persistBrowserAuthSession(page, user);

    if (await hasAuthenticatedHeader(page, user, 30_000)) {
      await assertBrowserSessionHint(page, user, `seed session authenticated header ${user.email}`);
      await hydrateBrowserSessionOnMap(page, user, `seed session hydrated route ${user.email}`);
      return;
    }

    await loginUser(user);
    await hydrateBrowserSessionOnMap(page, user, `seed session post-login fallback ${user.email}`);
    return;
  }

  throw new Error(`UI login for ${user.email} did not complete after retries.`);
}

async function hydrateBrowserSessionOnMap(page: Page, user: LiveUser, label: string): Promise<void> {
  // Seed storage from a static same-origin document so the SPA cannot start a
  // refresh and rotate the token before the authenticated route boots.
  await gotoAllowingImmediateRedirect(page, '/robots.txt');
  await persistBrowserAuthSession(page, user);
  const refreshResponse = waitForOptionalAuthRefresh(page);
  await gotoAllowingImmediateRedirect(page, '/map');
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
  await expectAuthenticatedHeader(page, user, label);
  await assertBrowserSessionHint(page, user, label);
  const response = await refreshResponse;
  if (response && !response.ok()) {
    console.log(`[live-sweep] ${label} ignored stale auth refresh response ${response.status()} after authenticated hydration.`);
  }
}

function appHeader(page: Page) {
  return page.locator('header.navbar').first();
}

async function gotoRegistrationForm(page: Page): Promise<void> {
  const registerFormReady = async () => {
    if (await page.getByRole('heading', { name: /Create your Scope account/i }).isVisible({ timeout: 8_000 }).catch(() => false)) {
      return true;
    }
    if (
      await page.getByLabel('First name').isVisible({ timeout: 1_000 }).catch(() => false) &&
      await page.getByRole('button', { name: /^Create Account$/i }).isVisible({ timeout: 1_000 }).catch(() => false)
    ) {
      return true;
    }
    if (
      await page.locator('form').filter({ hasText: /First name/i }).filter({ hasText: /Create Account/i }).first()
        .isVisible({ timeout: 1_000 }).catch(() => false)
    ) {
      return true;
    }
    const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
    return /First name/i.test(bodyText) && /Email address/i.test(bodyText) && /Create Account/i.test(bodyText);
  };

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await gotoAllowingImmediateRedirect(page, `/register?productionSweepRegister=${Date.now()}-${attempt}`);
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await dismissCookieBanner(page);

    if (await registerFormReady()) {
      return;
    }

    const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
    if (!bodyText.trim()) {
      await reloadAllowingImmediateRedirect(page);
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      if (await registerFormReady()) {
        return;
      }
    }

    const createAccountLink = page.getByRole('link', { name: /Create an account/i }).first();
    if (await createAccountLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await createAccountLink.click({ timeout: 10_000 }).catch(() => undefined);
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      if (await registerFormReady()) {
        return;
      }
    }

    await clearBrowserSession(page);
  }

  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
  if (/First name/i.test(bodyText) && /Email address/i.test(bodyText) && /Create Account/i.test(bodyText)) {
    return;
  }
  throw new Error(`Register form did not become visible. url=${page.url()} body=${bodyText.slice(0, 1200)}`);
}

async function persistBrowserAuthSession(page: Page, user: LiveUser): Promise<void> {
  await page.evaluate(({ refreshToken, onboardingKey, onboardingValue }) => {
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
    window.localStorage.setItem(onboardingKey, onboardingValue);
    window.dispatchEvent(new Event('scope-auth-session-hint-change'));
  }, {
    refreshToken: user.refreshToken,
    onboardingKey: ONBOARDING_COMPLETION_STORAGE_KEY,
    onboardingValue: ONBOARDING_COMPLETION_VALUE,
  });
}

async function readBrowserRefreshToken(page: Page): Promise<string> {
  return page.evaluate(() =>
    window.localStorage.getItem('scope-auth-refresh-token-v1')?.trim() ||
    window.sessionStorage.getItem('scope-auth-refresh-token-v1')?.trim() ||
    '',
  ).catch(() => '');
}

async function readBrowserAuthState(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => ({
    url: window.location.href,
    localHint: window.localStorage.getItem('scope-auth-session-hint'),
    localRefreshLength: window.localStorage.getItem('scope-auth-refresh-token-v1')?.length ?? 0,
    sessionHint: window.sessionStorage.getItem('scope-auth-session-hint'),
    sessionRefreshLength: window.sessionStorage.getItem('scope-auth-refresh-token-v1')?.length ?? 0,
    headerText: document.querySelector('header.navbar')?.textContent ?? document.querySelector('header')?.textContent ?? '',
  }));
}

async function assertBrowserSessionHint(page: Page, user: LiveUser, label: string): Promise<void> {
  const state = await readBrowserAuthState(page);
  expect(
    Boolean(state.localHint || state.sessionHint),
    `${label} should keep an auth session hint for ${user.email}: ${JSON.stringify(state).slice(0, 1200)}`,
  ).toBeTruthy();
  expect(
    Number(state.localRefreshLength || state.sessionRefreshLength),
    `${label} should keep a refresh token for ${user.email}: ${JSON.stringify(state).slice(0, 1200)}`,
  ).toBeGreaterThan(0);
}

async function waitForOptionalAuthRefresh(page: Page): Promise<Response | null> {
  return page.waitForResponse(
    (response) => response.url().includes('/api/core/auth/refresh') && response.request().method() === 'POST',
    { timeout: 20_000 },
  ).catch(() => null);
}

async function assertAuthRefreshSucceeded(refreshPromise: Promise<Response | null>, label: string): Promise<void> {
  const refreshResponse = await refreshPromise;
  if (!refreshResponse) {
    return;
  }
  expect(refreshResponse.ok(), `${label} auth refresh returned ${refreshResponse.status()}`).toBeTruthy();
}

async function expectAuthenticatedHeader(page: Page, user: LiveUser, label: string): Promise<void> {
  try {
    await expect(appHeader(page)).toContainText(user.displayName);
  } catch (error) {
    const state = await readBrowserAuthState(page).catch((stateError) => ({ error: String(stateError) }));
    throw new Error(`${label} lost authenticated header for ${user.email}: ${JSON.stringify(state).slice(0, 1200)}\n${String(error)}`);
  }
}

async function hasAuthenticatedHeader(page: Page, user: LiveUser, timeout = 5_000): Promise<boolean> {
  return appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout }).catch(() => false);
}

const NAVIGATION_INTERRUPTION_PATTERN = /Frame load interrupted|NS_ERROR_FAILURE|NS_BINDING_ABORTED|interrupted by another navigation|Timeout/i;

async function gotoAllowingImmediateRedirect(page: Page, path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
      return;
    } catch (error) {
      if (!NAVIGATION_INTERRUPTION_PATTERN.test(String(error))) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      if (isAcceptedRedirect(path, page.url())) {
        return;
      }
      if (attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(750);
    }
  }
}

async function gotoProtectedPath(page: Page, user: LiveUser, path: string): Promise<void> {
  const expectedPathname = new URL(path, BASE_URL).pathname;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (attempt > 1) {
      await loginUser(user);
      await persistBrowserAuthSession(page, user);
    }
    await gotoAllowingImmediateRedirect(page, path);
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(750);
    const currentPathname = new URL(page.url()).pathname;
    const hasAuthenticatedHeader = await appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout: 5_000 }).catch(() => false);
    if (currentPathname === expectedPathname && hasAuthenticatedHeader) {
      return;
    }
    await seedSession(page, user);
  }

  await loginUser(user);
  await persistBrowserAuthSession(page, user);
  await gotoAllowingImmediateRedirect(page, path);
  await expectAuthenticatedHeader(page, user, `protected route ${path}`);
  expect(new URL(page.url()).pathname, `protected route should stay on ${path}`).toBe(expectedPathname);
}

async function gotoAuthenticatedPublicPath(page: Page, user: LiveUser, path: string): Promise<void> {
  const expectedPathname = new URL(path, BASE_URL).pathname;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (attempt > 1) {
      await loginUser(user);
    }
    await persistBrowserAuthSession(page, user);
    await gotoAllowingImmediateRedirect(page, path);
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const currentPathname = new URL(page.url()).pathname;
    if (currentPathname === '/login' || currentPathname !== expectedPathname) {
      await seedSession(page, user);
      continue;
    }
    if (await appHeader(page).filter({ hasText: user.displayName }).isVisible({ timeout: 10_000 }).catch(() => false)) {
      return;
    }
    if (attempt >= 2) {
      await seedSession(page, user);
    }
  }

  await loginUser(user);
  await persistBrowserAuthSession(page, user);
  await gotoAllowingImmediateRedirect(page, path);
  await expectAuthenticatedHeader(page, user, `authenticated public route ${path}`);
  expect(new URL(page.url()).pathname, `authenticated public route should stay on ${path}`).toBe(expectedPathname);
}

function isAcceptedRedirect(requestedPath: string, currentUrl: string): boolean {
  const currentPath = new URL(currentUrl).pathname;
  if (currentPath === requestedPath) {
    return true;
  }
  if (requestedPath === '/login' && currentPath === '/map') {
    return true;
  }
  if (requestedPath === '/trips' && currentPath === '/login') {
    return true;
  }
  return false;
}

async function goBackExpectingPath(page: Page, expectedPath: string): Promise<void> {
  try {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  } catch (error) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    if (new URL(page.url()).pathname !== expectedPath) {
      throw error;
    }
  }
  expect(new URL(page.url()).pathname).toBe(expectedPath);
}

async function fillExploreSearch(page: Page, query: string): Promise<void> {
  const exploreSearch = page.locator('.discover-search').getByRole('searchbox', { name: 'Search spots' });
  await expect(exploreSearch).toBeVisible();
  await exploreSearch.fill(query);
}

async function openLiveSpotOnMap(
  page: Page,
  spot: { id: string; title: string; city?: string; country?: string },
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoAllowingImmediateRedirect(page, `/map?spotId=${spot.id}&e2eMapFocus=${attempt}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);

    const mapResult = page.getByRole('button', { name: new RegExp(escapeRegExp(spot.title)) }).first();
    if (await mapResult.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await mapResult.click();
    }

    try {
      await expect(page.locator('[data-test="map-selected-spot-card"]')).toContainText(spot.title, { timeout: 30_000 });
      await expect(page.locator('[data-test="map-selected-spot-detail-link"]')).toHaveAttribute('href', buildSpotPath(spot));
      return;
    } catch (error) {
      lastError = error;
      await reloadAllowingImmediateRedirect(page);
      await page.waitForTimeout(1_000);
    }
  }

  throw new Error(`Live map never selected ${spot.title} (${spot.id}): ${String(lastError)}`);
}

async function selectLiveMapFeature(page: Page, preferredTitle: string): Promise<void> {
  await waitForMapRenderable(page);

  const clusterMarker = page.locator('[data-test^="map-cluster-marker-"]').first();
  if (await clusterMarker.isVisible({ timeout: 1_000 }).catch(() => false)) {
    try {
      await clusterMarker.click({ timeout: 5_000 });
      await expect(page.locator('[data-test="map-summary-pins"]')).toContainText(/pins in view/i);
      return;
    } catch {
      // Mapbox can re-render clusters into spot markers between visibility and click.
    }
  }

  const preferredMarker = page.getByRole('button', { name: new RegExp(`^Open ${escapeRegExp(preferredTitle)}$`) }).first();
  if (await preferredMarker.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (await activateMapMarker(page, preferredMarker, `preferred marker ${preferredTitle}`).catch(() => false)) {
      return;
    }
  }

  const currentRunMarker = page.getByRole('button', { name: new RegExp(`^Open .*${escapeRegExp(liveData.suffix)}`) }).first();
  const marker = await currentRunMarker.isVisible({ timeout: 5_000 }).catch(() => false)
    ? currentRunMarker
    : page.locator('.spot-marker').first();
  const activated = await activateMapMarker(page, marker, 'fallback live marker');
  expect(activated, 'Expected the live map to activate at least one visible marker.').toBe(true);
}

async function activateMapMarker(page: Page, marker: Locator, label: string): Promise<boolean> {
  await expect(marker, `${label} should be visible before activation`).toBeVisible();
  try {
    await marker.click({ timeout: 10_000 });
  } catch {
    await marker.focus();
    await marker.press('Enter', { timeout: 10_000 });
  }

  await expect(page.locator('[data-test="map-selected-spot-card"]'), `${label} should open a selected spot card`).toBeVisible();
  return true;
}

async function waitForMapRenderable(page: Page): Promise<'cluster' | 'marker'> {
  const clusterMarker = page.locator('[data-test^="map-cluster-marker-"]').first();
  const spotMarker = page.locator('.spot-marker').first();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await clusterMarker.isVisible().catch(() => false)) {
      return 'cluster';
    }
    if (await spotMarker.isVisible().catch(() => false)) {
      return 'marker';
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Timed out waiting for the live map to render a cluster or spot marker.');
}

async function reloadAllowingImmediateRedirect(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      if (!NAVIGATION_INTERRUPTION_PATTERN.test(String(error))) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      if (attempt === 3) {
        return;
      }
      await page.waitForTimeout(750);
    }
  }
}

async function clearBrowserSession(page: Page): Promise<void> {
  await logoutVisibleSession(page);
  await page.evaluate(({ onboardingKey, onboardingValue }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('scope-analytics-consent', 'denied');
    window.localStorage.setItem(onboardingKey, onboardingValue);
  }, {
    onboardingKey: ONBOARDING_COMPLETION_STORAGE_KEY,
    onboardingValue: ONBOARDING_COMPLETION_VALUE,
  }).catch(() => undefined);
  await page.context().clearCookies();
}

async function gotoLoginForm(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(`/login?e2eLogin=${Date.now()}-${attempt}`, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      if (!NAVIGATION_INTERRUPTION_PATTERN.test(String(error)) || attempt === 3) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      if (new URL(page.url()).pathname !== '/login') {
        await page.waitForTimeout(750);
        continue;
      }
    }
    await dismissCookieBanner(page);
    if (new URL(page.url()).pathname === '/login') {
      return;
    }
    await clearBrowserSession(page);
  }

  if (new URL(page.url()).pathname === '/login') {
    return;
  }

  throw new Error(`Expected /login before filling the login form, but current page is ${page.url()}`);
}

function loginEmailField(page: Page) {
  return page.getByRole('textbox', { name: /Email, phone, or display name/i }).first();
}

function loginPasswordField(page: Page) {
  return page.getByPlaceholder('Enter your password').first();
}

async function logoutVisibleSession(page: Page): Promise<void> {
  const profileButton = page.getByRole('button', { name: /^Scope Live / }).first();
  if (!(await profileButton.isVisible({ timeout: 1_000 }).catch(() => false))) {
    return;
  }

  try {
    await profileButton.click({ timeout: 5_000 });
  } catch {
    return;
  }
  const logoutItem = page.getByRole('menuitem', { name: /Log out/i }).first();
  if (await logoutItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await logoutItem.click({ timeout: 5_000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
  }
}

async function openProfileMenu(page: Page, displayName: string): Promise<void> {
  const profileButton = page.getByRole('button', { name: new RegExp(escapeRegExp(displayName)) }).first();
  await expect(profileButton).toBeVisible();
  await profileButton.click();
  await expect(page.getByRole('menu')).toContainText('Log out');
}

async function selectExploreVibe(page: Page, label: RegExp): Promise<void> {
  const vibeRow = page.locator('[data-test="vibe-chip-row"]');
  const matchingChip = vibeRow.locator('[data-test="vibe-chip"]').filter({ hasText: label }).first();
  const expandButton = vibeRow.locator('[data-test="vibe-chip-more"]').first();

  await expect(vibeRow).toBeVisible();
  await expect.poll(async () => (
    await matchingChip.isVisible().catch(() => false)
    || await expandButton.isVisible().catch(() => false)
  ), {
    message: `Expected the ${label} vibe or the overflow control after Explore finished loading`,
    timeout: 60_000,
  }).toBe(true);

  if (!await matchingChip.isVisible().catch(() => false)) {
    await expandButton.click();
  }

  await expect(matchingChip).toBeVisible({ timeout: 30_000 });
  await matchingChip.click();
  await expect(matchingChip).toHaveClass(/active/);
}

function installNoMockGuards(page: Page): void {
  const guard: NoMockGuard = { leaks: [], serverErrors: [] };
  const guardedPage = page as Page & { __scopeLiveNoMockGuard?: NoMockGuard; route: any };
  guardedPage.__scopeLiveNoMockGuard = guard;
  const originalRoute = page.route.bind(page);
  guardedPage.route = async (url: unknown, handler: unknown, options?: unknown) => {
    const pattern = typeof url === 'string'
      ? url
      : url instanceof RegExp
        ? url.source
        : String(url);
    if (/\/api\//i.test(pattern)) {
      throw new Error(`Live production sweep cannot install Playwright route interception for Scope APIs: ${pattern}`);
    }
    return (originalRoute as any)(url, handler, options);
  };

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.startsWith(BASE_URL) || !url.includes('/api/')) {
      return;
    }

    const status = response.status();
    const pathname = new URL(url).pathname;
    if (status >= 500 && !isAllowedProviderUnavailable(pathname, status)) {
      guard.serverErrors.push(`${response.request().method()} ${pathname} -> ${status}`);
    }

    const contentType = response.headers()['content-type'] ?? '';
    if (!/json|text/i.test(contentType)) {
      return;
    }

    const text = await response.text().catch(() => '');
    if (pathname === AUTH_REFRESH_PATH && status >= 200 && status < 300) {
      rememberLiveRefreshResponse(response, text);
    }
    for (const pattern of API_MOCK_PATTERNS) {
      if (pattern.test(text)) {
        guard.leaks.push(`${pathname} matched ${pattern}`);
      }
    }
  });
}

function rememberLiveRefreshResponse(response: Response, text: string): void {
  const requestRefreshToken = extractRefreshTokenFromRequest(response);
  const user = requestRefreshToken ? liveUsersByRefreshToken.get(requestRefreshToken) : undefined;
  if (!user) {
    return;
  }

  const data = unwrap(parseJson(text));
  if (!data?.accessToken || !data?.refreshToken) {
    return;
  }

  user.accessToken = String(data.accessToken);
  user.refreshToken = String(data.refreshToken);
  rememberLiveUser(user);
}

function extractRefreshTokenFromRequest(response: Response): string | null {
  try {
    const payload = response.request().postDataJSON() as { refreshToken?: unknown } | null;
    return typeof payload?.refreshToken === 'string' ? payload.refreshToken : null;
  } catch {
    return null;
  }
}

async function assertNoMockLeaks(page: Page): Promise<void> {
  const guardedPage = page as Page & { __scopeLiveNoMockGuard?: NoMockGuard };
  const guard = guardedPage.__scopeLiveNoMockGuard;
  const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
  const visibleLeaks = UI_MOCK_PATTERNS
    .filter((pattern) => pattern.test(bodyText))
    .map((pattern) => `visible UI matched ${pattern}`);
  const leaks = [...(guard?.leaks ?? []), ...visibleLeaks];
  expect(leaks, `Live sweep saw mock/demo payloads or fixture UI: ${leaks.join('\n')}`).toEqual([]);
  expect(guard?.serverErrors ?? [], `Live sweep saw unexpected 5xx API responses: ${(guard?.serverErrors ?? []).join('\n')}`).toEqual([]);
}

function assertNoMockFallbackEnv(): void {
  const enabled = MOCK_ENV_KEYS.filter((key) => String(process.env[key] ?? '').trim().toLowerCase() === 'true');
  expect(enabled, `Mock/demo fallback env vars must be disabled for the live production sweep: ${enabled.join(', ')}`).toEqual([]);
}

async function assertStackHealth(): Promise<void> {
  for (const path of ['/healthz', '/api/core/health', '/api/content/health', '/api/intel/health']) {
    const response = await fetch(new URL(path, BASE_URL));
    expect(response.status, `${path} health status`).toBe(200);
  }

  const coreDeletePreflight = await fetch(new URL('/api/core/users/00000000-0000-0000-0000-000000000000', BASE_URL), {
    method: 'OPTIONS',
    headers: {
      Origin: new URL(BASE_URL).origin,
      Referer: `${new URL(BASE_URL).origin}/`,
    },
  });
  const allowedCoreMethods = [
    coreDeletePreflight.headers.get('allow'),
    coreDeletePreflight.headers.get('access-control-allow-methods'),
  ]
    .filter(Boolean)
    .join(',');

  if (!/\bDELETE\b/i.test(allowedCoreMethods)) {
    const unauthenticatedDelete = await fetch(new URL('/api/core/users/00000000-0000-0000-0000-000000000000', BASE_URL), {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(
      unauthenticatedDelete.status,
      'Live sweep requires deployed Core account deletion before creating disposable production users',
    ).not.toBe(405);
  }
}

function assertNoMockPayload(payload: unknown, label: string): void {
  const text = JSON.stringify(payload ?? {});
  const leaks = API_MOCK_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
  expect(leaks, `${label} must not contain mock/demo/fixture markers: ${text.slice(0, 800)}`).toEqual([]);
}

function assertClearProviderUnavailable(payload: unknown, label: string): void {
  assertNoMockPayload(payload, label);
  expect(JSON.stringify(payload ?? {}), `${label} must expose a clear provider-unavailable reason`).toMatch(
    /unavailable|provider|configured|GOOGLE_PLACES_API_KEY|OPENWEATHERMAP|weather/i,
  );
}

async function verifyProviderPlace(
  owner: LiveUser,
  body: {
    title: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  },
  label: string,
) {
  let lastPayload: unknown;
  try {
    return await poll(label, async () => {
      const verification = await api('POST', '/api/intel/place/verify', {
        token: owner.accessToken,
        body,
        ok: [200, 503],
      });
      lastPayload = verification.payload;
      assertNoMockPayload(verification.payload, `${label} payload`);
      if (verification.status === 503) {
        assertClearProviderUnavailable(verification.payload, label);
        return false;
      }
      if (!verification.data.verified) {
        return false;
      }
      expect(['google_places', 'mapbox']).toContain(verification.data.source);
      expect(verification.data.providerPlaceId).toBeTruthy();
      return verification;
    }, 45_000);
  } catch (error) {
    throw new Error(`${label} did not return a stable provider-backed verification: ${JSON.stringify(lastPayload).slice(0, 1200)}\n${String(error)}`);
  }
}

function isAllowedProviderUnavailable(pathname: string, status: number): boolean {
  return status === 503 && (
    pathname === '/api/intel/weather/current' ||
    pathname === '/api/intel/place-photo' ||
    pathname === '/api/intel/fuel/stations'
  );
}

interface ApiOptions {
  token?: string;
  body?: unknown;
  form?: () => FormData;
  headers?: Record<string, string>;
  ok?: number[];
  assert?: (data: any, payload: any) => void | unknown;
}

async function api(method: string, path: string, options: ApiOptions = {}) {
  const ok = options.ok ?? [200, 201, 202, 204];
  let lastPayload: unknown;
  let bearerToken = options.token;
  const baseUrl = new URL(BASE_URL);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Origin: baseUrl.origin,
      Referer: `${baseUrl.origin}/`,
      ...options.headers,
    };
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }
    let requestBody: BodyInit | undefined;
    if (options.form) {
      requestBody = options.form();
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.body);
    }

    const response = await fetch(new URL(path, BASE_URL), {
      method,
      headers,
      body: requestBody,
    });
    const text = await response.text();
    const payload = parseJson(text);
    lastPayload = payload;

    if (response.status === 401 && bearerToken) {
      const staleUser = liveUsersByAccessToken.get(bearerToken);
      if (staleUser) {
        await loginUser(staleUser);
        bearerToken = staleUser.accessToken;
        continue;
      }
    }

    const retryableTransientValidation =
      response.status === 400 &&
      path === '/api/content/spots/compose' &&
      /Place verification is unavailable right now/i.test(JSON.stringify(payload));
    if (((response.status === 429 || response.status === 502 || response.status === 503) && !ok.includes(response.status)) || retryableTransientValidation) {
      await delay(Math.min(30_000, 2_000 + attempt * 3_000));
      continue;
    }

    if (!ok.includes(response.status)) {
      throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
    }

    const data = unwrap(payload);
    options.assert?.(data, payload);
    await delay(150);
    return { status: response.status, payload, data };
  }

  throw new Error(`${method} ${path} kept returning a retryable status: ${JSON.stringify(lastPayload).slice(0, 1200)}`);
}

async function findNotification(user: LiveUser, matcher: (notification: Record<string, any>) => boolean) {
  const response = await api('GET', '/api/core/notifications?page=1&pageSize=100', { token: user.accessToken });
  const items = Array.isArray(response.data) ? response.data : [];
  return items.find(matcher);
}

async function poll<T>(label: string, fn: () => Promise<T | false | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function makePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const rows = Buffer.from([
    0, 32, 120, 190, 30, 140, 210,
    0, 250, 190, 90, 240, 210, 120,
  ]);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND'),
  ]);
}

function pngChunk(type: string, data = Buffer.alloc(0)): Buffer {
  const name = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
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
  return payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')
    ? payload.data
    : payload;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
