import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

interface RouteExpectation {
  slug: string;
  path: string;
  assert: (page: Page) => Promise<void>;
}

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
      await expect(page.locator('[data-test="map-fallback-stage"]')).toBeVisible();
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
];

const protectedRoutes: RouteExpectation[] = [
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
];

async function gotoRoute(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
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

    await scopeApi.seedSession(page, seededSession);

    await test.step('redirects authenticated users away from login', async () => {
      await expectGuestRouteRedirect(page, '/login');
    });

    await test.step('redirects authenticated users away from register', async () => {
      await expectGuestRouteRedirect(page, '/register');
    });
  });
});
