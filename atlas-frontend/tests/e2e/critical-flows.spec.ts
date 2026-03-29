import { expect, test, type Page } from '@playwright/test';

const TEST_SPOT_TITLE = 'Playwright Sunset Tacos';
const TEST_SPOT_DESCRIPTION = 'A browser-driven Atlas test stop for smoke-checking the full creation flow.';
const TEST_TRIP_DESTINATION = 'Austin, TX';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn6zkAAAAAASUVORK5CYII=';

function createPhotoFixture() {
  return {
    name: 'playwright-spot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'),
  };
}

function buildAuthPayload(overrides: Record<string, string> = {}) {
  return {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    accessToken: 'playwright-access-token',
    refreshToken: 'playwright-refresh-token',
    ...overrides,
  };
}

async function waitForAtlasPageReady(page: Page) {
  const loadingWorkspaceText = page.getByText(/loading atlas workspace/i);
  if (await loadingWorkspaceText.count()) {
    await loadingWorkspaceText.waitFor({ state: 'detached', timeout: 15000 });
  }
}

test('critical user journey: register, login, create spot, view map, and plan a trip', async ({ page }) => {
  await page.route('**/api/core/auth/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/register')) {
      const payload = request.postDataJSON() as Record<string, string>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildAuthPayload({
            username: payload.username ?? 'louisdo',
            email: payload.email ?? 'louis@example.com',
            displayName: payload.displayName ?? 'Louis Do',
          }),
        ),
      });
      return;
    }

    if (path.endsWith('/login')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAuthPayload()),
      });
      return;
    }

    if (path.endsWith('/refresh') || path.endsWith('/oauth/cognito')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAuthPayload()),
      });
      return;
    }

    if (path.endsWith('/logout')) {
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    await route.fallback();
  });
  await page.goto('/register');
  await waitForAtlasPageReady(page);

  await expect(page.getByText(/start documenting real places and real stories\./i)).toBeVisible();
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/map$/);
  await waitForAtlasPageReady(page);
  await expect(page.getByText(/filters and highlights/i)).toBeVisible();

  await page.getByRole('button', { name: /louis do/i }).click();
  await page.getByRole('button', { name: /log out/i }).click();

  await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /pick up your next mapped adventure/i })).toBeVisible();
  await page.getByRole('button', { name: /^log in$/i }).click();

  await expect(page).toHaveURL(/\/map$/);
  await waitForAtlasPageReady(page);

  await page.goto('/spots/new');
  await waitForAtlasPageReady(page);
  await expect(page.getByRole('heading', { name: /drop a new adventure pin/i })).toBeVisible();

  await page.getByLabel('Title').fill(TEST_SPOT_TITLE);
  await page.getByLabel('Description').fill(TEST_SPOT_DESCRIPTION);
  await page.getByLabel('Vibe').fill('sunset, social, rooftop');
  await page.getByLabel('Address').fill('123 Sunset Ave');
  await page.locator('[data-test="photo-upload-input"]').setInputFiles(createPhotoFixture());
  await expect(page.locator('[data-test="photo-preview-card"]')).toHaveCount(1);
  await page.locator('[data-test="spot-submit"]').click();

  await expect(page).toHaveURL(/\/spots\//);
  await waitForAtlasPageReady(page);
  await expect(page.getByRole('heading', { name: TEST_SPOT_TITLE })).toBeVisible();

  await page.goto('/map');
  await waitForAtlasPageReady(page);
  await expect(page.getByText(/filters and highlights/i)).toBeVisible();
  await expect(page.getByText(/mapbox token required/i)).toBeVisible();

  await page.goto('/trips/new');
  await waitForAtlasPageReady(page);
  await expect(page.getByRole('heading', { name: /generate an itinerary from your travel constraints/i })).toBeVisible();
  await page.getByLabel('Destination').fill(TEST_TRIP_DESTINATION);
  await page.locator('[data-test="trip-planner-submit"]').click();

  await expect(page.locator('[data-test="itinerary-view"]')).toContainText(/ai itinerary/i);
  await expect(page.locator('[data-test="itinerary-view"]')).toContainText(TEST_TRIP_DESTINATION);
});
