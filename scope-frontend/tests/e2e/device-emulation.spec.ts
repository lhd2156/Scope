import { devices, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

interface DeviceCheckpoint {
  name: string;
  route: string;
  contextOptions: BrowserContextOptions;
  assert: (page: Page) => Promise<void>;
}

const iPadDevice: BrowserContextOptions = {
  viewport: { width: 820, height: 1180 },
  screen: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

const galaxyS24Device: BrowserContextOptions = {
  viewport: { width: 412, height: 915 },
  screen: { width: 412, height: 915 },
  deviceScaleFactor: 3.5,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Galaxy S24) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
};

const deviceCheckpoints: DeviceCheckpoint[] = [
  {
    name: 'iPhone 14 renders the mobile map shell without horizontal overflow',
    route: '/map',
    contextOptions: {
      ...devices['iPhone 14'],
    },
    assert: async (page) => {
      await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
      await expect(page.locator('[data-test="map-mobile-sheet"]')).toHaveAttribute('data-sheet-state', 'peek');
      await expect(page.locator('[data-test="map-mobile-sheet-toggle"]')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('[data-test="map-fallback-stage"]')).toBeVisible();
    },
  },
  {
    name: 'iPad keeps the explore workspace in the tablet masonry layout',
    route: '/explore',
    contextOptions: iPadDevice,
    assert: async (page) => {
      await expect(page.locator('.explore-page')).toHaveAttribute('data-explore-layout', 'desktop');
      await expect(page.locator('[data-test="explore-results"]')).toHaveAttribute('data-results-layout', 'masonry');
      await expect(page.locator('[data-test="trending-panel"]')).toHaveAttribute('data-trending-layout', 'sidebar');
      await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
    },
  },
  {
    name: 'Galaxy S24 switches explore into the mobile single-column stack',
    route: '/explore',
    contextOptions: galaxyS24Device,
    assert: async (page) => {
      await expect(page.locator('.explore-page')).toHaveAttribute('data-explore-layout', 'mobile');
      await expect(page.locator('[data-test="explore-results"]')).toHaveAttribute('data-results-layout', 'single-column');
      await expect(page.locator('[data-test="trending-panel"]')).toHaveAttribute('data-trending-layout', 'stacked');
      await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
    },
  },
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function seedAuthenticatedContext(context: BrowserContext): Promise<void> {
  const sessionPayload = {
    id: 'user-louisdo',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    accessToken: 'playwright-device-access-louisdo',
    refreshToken: 'playwright-device-refresh-louisdo',
  };
  const userPayload = {
    id: sessionPayload.id,
    username: sessionPayload.username,
    email: sessionPayload.email,
    displayName: sessionPayload.displayName,
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  };

  await context.addInitScript(() => {
    window.localStorage.setItem(
      'scope-auth-session-hint',
      JSON.stringify({ version: 1, hasSessionCookie: true, lastAuthenticatedAt: new Date().toISOString() }),
    );
    window.localStorage.setItem('scope-analytics-consent', 'denied');
  });

  await context.route('**/api/core/auth/refresh', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload) });
  });
  await context.route('**/api/core/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: userPayload }) });
  });
  await context.route('**/api/core/notifications**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 1, total: 0, totalPages: 1 } }),
    });
  });
}

test.describe('Scope Chrome device-emulation responsive QA', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Device emulation verification is scoped to Chromium / Chrome DevTools parity.');
  });

  for (const checkpoint of deviceCheckpoints) {
    test(checkpoint.name, async ({ browser, baseURL }, testInfo) => {
      const context = await browser.newContext(checkpoint.contextOptions);
      await seedAuthenticatedContext(context);
      const page = await context.newPage();
      const targetUrl = new URL(checkpoint.route, baseURL ?? 'http://127.0.0.1:4173').toString();

      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await checkpoint.assert(page);
        await expectNoHorizontalOverflow(page);

        await testInfo.attach('device-screenshot', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      } finally {
        await context.close();
      }
    });
  }
});
