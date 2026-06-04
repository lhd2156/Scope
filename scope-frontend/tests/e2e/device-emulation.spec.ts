import type { BrowserContextOptions, Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

interface DeviceCheckpoint {
  name: string;
  route: string;
  contextOptions: BrowserContextOptions;
  assert: (page: Page) => Promise<void>;
}

const tabletTouchDevice: BrowserContextOptions = {
  viewport: { width: 820, height: 1180 },
  screen: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Mobile; ScopeWeb) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

const phoneTouchDevice: BrowserContextOptions = {
  viewport: { width: 412, height: 915 },
  screen: { width: 412, height: 915 },
  deviceScaleFactor: 3.5,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Mobile; ScopeWeb) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

const deviceCheckpoints: DeviceCheckpoint[] = [
  {
    name: 'Mobile touch viewport renders the mobile map shell without horizontal overflow',
    route: '/map',
    contextOptions: {
      ...phoneTouchDevice,
    },
    assert: async (page) => {
      await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
      await expect(page.locator('[data-test="map-mobile-sheet"]')).toHaveAttribute('data-sheet-state', 'peek');
      await expect(page.locator('[data-test="map-mobile-sheet-toggle"]')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.map-view')).toBeVisible();

      const fallbackStage = page.locator('[data-test="map-fallback-stage"]');
      if (await fallbackStage.isVisible()) {
        return;
      }

      await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
      await expect(page.locator('[data-test="map-summary-pins"]')).toBeVisible();
    },
  },
  {
    name: 'Tablet touch viewport keeps the explore workspace in the tablet masonry layout',
    route: '/explore',
    contextOptions: tabletTouchDevice,
    assert: async (page) => {
      await expect(page.locator('.explore-page')).toHaveAttribute('data-explore-layout', 'desktop');
      await expect(page.locator('[data-test="explore-results"]')).toHaveAttribute('data-results-layout', 'masonry');
      await expect(page.locator('[data-test="trending-panel"]')).toHaveAttribute('data-trending-layout', 'sidebar');
      await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
    },
  },
  {
    name: 'Mobile touch viewport switches explore into the mobile single-column stack',
    route: '/explore',
    contextOptions: phoneTouchDevice,
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

test.describe('Scope Chrome device-emulation responsive QA', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Device emulation verification is scoped to Chromium / Chrome DevTools parity.');

  for (const checkpoint of deviceCheckpoints) {
    test.describe(checkpoint.name, () => {
      test.use(checkpoint.contextOptions);

      test(checkpoint.name, async ({ page, baseURL, scopeApi }, testInfo) => {
        await scopeApi.seedSession(page, { email: 'louis@example.com' });
        const targetUrl = new URL(checkpoint.route, baseURL ?? 'http://127.0.0.1:4173').toString();

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await checkpoint.assert(page);
        await expectNoHorizontalOverflow(page);

        await testInfo.attach('device-screenshot', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    });
  }
});
