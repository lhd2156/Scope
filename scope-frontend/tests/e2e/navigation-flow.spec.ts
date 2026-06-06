import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

interface RouteExpectation {
  slug: string;
  path: string;
  assert: (page: Page) => Promise<void>;
}

const demoTripShareStorageKey = 'scope.trip-shares.v1';
const demoShareToken = 'share-trip-1';
const demoSharedTripId = 'trip-1';

const publicRoutes: RouteExpectation[] = [
  {
    slug: 'home',
    path: '/',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Find a place worth going.' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Trending Destinations' })).toBeVisible();
    },
  },
  {
    slug: 'explore',
    path: '/explore',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Explore standout places through photo-led discovery.' })).toBeVisible();
      await expect(page.locator('[data-test="explore-results"]')).toBeVisible();
    },
  },
  {
    slug: 'map',
    path: '/map',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
      await expect(page.locator('[data-test="map-summary-pins"], [data-test="map-fallback-stage"]').first()).toBeVisible();
    },
  },
  {
    slug: 'spot-detail',
    path: '/spots/spot-1',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Sunset Rooftop Tacos' })).toBeVisible();
      await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();
    },
  },
  {
    slug: 'shared-trip',
    path: '/trips/shared/share-trip-1',
    assert: async (page) => {
      await expect(page.locator('[data-test="trip-detail"]')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'North Texas Night + Food Loop' })).toBeVisible();
    },
  },
  {
    slug: 'login',
    path: '/login',
    assert: async (page) => {
      await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();
      await expect(page.locator('form.auth-form')).toBeVisible();
    },
  },
  {
    slug: 'register',
    path: '/register',
    assert: async (page) => {
      await expect(page.getByRole('heading', { name: 'Create your Scope account' })).toBeVisible();
      await expect(page.locator('form.auth-form')).toBeVisible();
    },
  },
  {
    slug: 'privacy',
    path: '/privacy',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'privacy-alias',
    path: '/privacy-policy',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'terms',
    path: '/terms',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'terms-alias',
    path: '/terms-of-service',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'cookies',
    path: '/cookies',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Cookie Choices' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'accessibility',
    path: '/accessibility',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Accessibility' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'security',
    path: '/security',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'about',
    path: '/about',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'About Scope' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
  {
    slug: 'help',
    path: '/help',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
      await expect(page.locator('[data-test="legal-document"]')).toBeVisible();
    },
  },
];

const protectedRoutes: RouteExpectation[] = [
  {
    slug: 'trips-workspace',
    path: '/trips',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Trip workspace' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'New trip' })).toHaveAttribute('href', '/trips/new');
    },
  },
  {
    slug: 'friends',
    path: '/friends',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Build your Scope travel circle.' })).toBeVisible();
      await expect(page.locator('[data-test="friends-grid"]')).toBeVisible();
    },
  },
  {
    slug: 'profile',
    path: '/profile/user-1',
    assert: async (page) => {
      await expect(page.locator('[data-test="profile-header"]')).toBeVisible();
      await expect(page.locator('[data-test="profile-map"]')).toBeVisible();
    },
  },
  {
    slug: 'settings',
    path: '/settings',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
      await expect(page.locator('[data-test="settings-sidebar"]')).toBeVisible();
    },
  },
  {
    slug: 'trip-planner',
    path: '/trips/new',
    assert: async (page) => {
      await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
      await expect(page.locator('[data-test="itinerary-view"]')).toBeVisible();
    },
  },
  {
    slug: 'trip-detail',
    path: '/trips/trip-1',
    assert: async (page) => {
      await expect(page.locator('[data-test="trip-detail"]')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'North Texas Night + Food Loop' })).toBeVisible();
    },
  },
  {
    slug: 'trip-edit',
    path: '/trips/trip-1/edit',
    assert: async (page) => {
      await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'North Texas Night + Food Loop' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: 'Title, dates, city, and travelers' })).toBeVisible();
    },
  },
  {
    slug: 'spot-create',
    path: '/spots/new',
    assert: async (page) => {
      await expect(page.locator('[data-test="spot-form"]')).toBeVisible();
      await expect(page.locator('[data-test="spot-form"]')).toContainText('Publish spot');
    },
  },
  {
    slug: 'spot-edit',
    path: '/spots/spot-1/edit',
    assert: async (page) => {
      await expect(page.locator('[data-test="spot-form"]')).toBeVisible();
      await expect(page.locator('[data-test="spot-form"]')).toContainText('Save changes');
    },
  },
  {
    slug: 'notifications',
    path: '/notifications',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Scope inbox' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Delivery controls' })).toBeVisible();
    },
  },
  {
    slug: 'onboarding-preferences',
    path: '/onboarding/preferences',
    assert: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'What do you want to find on Scope?' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Set your preferred location' })).toBeVisible();
    },
  },
];

const authenticatedRedirectRoutes: RouteExpectation[] = [
  {
    slug: 'ai-trip-planner-redirect',
    path: '/ai/trip-planner',
    assert: async (page) => {
      await expect(page).toHaveURL(/\/trips\/new\?assistant=open$/);
      await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
    },
  },
  {
    slug: 'ai-ask-redirect',
    path: '/ai/ask',
    assert: async (page) => {
      await expect(page).toHaveURL(/\/trips\/new\?assistant=open$/);
      await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
    },
  },
  {
    slug: 'scope-ai-redirect',
    path: '/scope/ai',
    assert: async (page) => {
      await expect(page).toHaveURL(/\/trips\/new\?assistant=open$/);
      await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
    },
  },
];

function isRetryableNavigationAbort(error: unknown): boolean {
  return error instanceof Error && /NS_BINDING_ABORTED|NS_ERROR_FAILURE|ERR_ABORTED|interrupted/i.test(error.message);
}

async function recoverRouteBoundary(page: Page): Promise<boolean> {
  const boundary = page.locator('[data-test="route-error-boundary"]');
  const visible = await boundary.isVisible({ timeout: 750 }).catch(() => false);
  if (!visible) {
    return false;
  }

  await page.getByRole('button', { name: 'Try this view again' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  return true;
}

async function resetRouteDocument(page: Page): Promise<void> {
  if (page.url() === 'about:blank') {
    return;
  }

  await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
}

async function gotoRoute(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await resetRouteDocument(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      if (!isRetryableNavigationAbort(error) || attempt === 2) {
        throw error;
      }
      continue;
    }

    if (await recoverRouteBoundary(page)) {
      continue;
    }

    return;
  }
}

async function seedDemoSharedTrip(page: Page): Promise<void> {
  await page.addInitScript(
    ({ storageKey, shareToken, tripId }) => {
      const rawShares = window.localStorage.getItem(storageKey);
      let shares: Record<string, string> = {};

      try {
        const parsedShares = rawShares ? JSON.parse(rawShares) : {};
        shares = parsedShares && typeof parsedShares === 'object' && !Array.isArray(parsedShares)
          ? parsedShares as Record<string, string>
          : {};
      } catch {
        shares = {};
      }

      window.localStorage.setItem(storageKey, JSON.stringify({
        ...shares,
        [shareToken]: tripId,
      }));
    },
    {
      storageKey: demoTripShareStorageKey,
      shareToken: demoShareToken,
      tripId: demoSharedTripId,
    },
  );
}

async function expectRedirectToLogin(page: Page, protectedPath: string): Promise<void> {
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe('/login');
  expect(currentUrl.searchParams.get('redirect')).toBe(protectedPath);
}

async function expectGuestRouteRedirect(page: Page, guestOnlyPath: '/login' | '/register'): Promise<void> {
  await gotoRoute(page, guestOnlyPath);
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
}

test.describe('Scope route navigation and guard coverage', () => {
  test('renders every public route and the 404 fallback without an authenticated session', async ({ page }) => {
    await seedDemoSharedTrip(page);

    for (const route of publicRoutes) {
      await test.step(`renders public route: ${route.slug}`, async () => {
        await gotoRoute(page, route.path);
        await route.assert(page);
      });
    }

    await test.step('renders the 404 fallback for unknown paths', async () => {
      await gotoRoute(page, '/totally-missing-route');
      await expect(page).toHaveURL(/\/totally-missing-route$/);
      await expect(page.getByRole('heading', { name: 'This trail does not exist in Scope' })).toBeVisible();
      await expect(page.getByText('Page not found')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    });
  });

  test('redirects every protected route to login and preserves the redirect target for guests', async ({ page, scopeApi }) => {
    await scopeApi.clearSession(page);

    for (const route of protectedRoutes) {
      await test.step(`redirects guest away from ${route.slug}`, async () => {
        await gotoRoute(page, route.path);
        await expectRedirectToLogin(page, route.path);
      });
    }
  });

  test('renders every protected route with a seeded Scope session and redirects guest-only pages back to map', async ({ page, scopeApi }) => {
    const seededSession = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    };

    for (const route of protectedRoutes) {
      await test.step(`renders protected route: ${route.slug}`, async () => {
        await scopeApi.seedSession(page, seededSession);
        await gotoRoute(page, route.path);
        await expect(page).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
        await route.assert(page);
      });
    }

    for (const route of authenticatedRedirectRoutes) {
      await test.step(`follows authenticated redirect route: ${route.slug}`, async () => {
        await scopeApi.seedSession(page, seededSession);
        await gotoRoute(page, route.path);
        await route.assert(page);
      });
    }

    await scopeApi.seedSession(page, seededSession);

    await test.step('redirects authenticated users away from login', async () => {
      await expectGuestRouteRedirect(page, '/login');
    });

    await test.step('redirects authenticated users away from register', async () => {
      await expectGuestRouteRedirect(page, '/register');
    });
  });
});
