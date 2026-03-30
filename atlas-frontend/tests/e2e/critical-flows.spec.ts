import { expect, test, type Page, type Route } from '@playwright/test';

function buildPngFixtureBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pT9lRcAAAAASUVORK5CYII=',
    'base64',
  );
}

async function mockAuthEndpoints(page: Page): Promise<void> {
  await page.route('**/api/core/auth/**', async (route: Route) => {
    const requestUrl = route.request().url();
    const requestBody = route.request().postDataJSON?.() as Record<string, unknown> | undefined;
    const emailAddress = typeof requestBody?.email === 'string' ? requestBody.email : 'louis@example.com';
    const username = typeof requestBody?.username === 'string' ? requestBody.username : emailAddress.split('@')[0] || 'atlas-user';
    const displayName = typeof requestBody?.displayName === 'string' ? requestBody.displayName : 'Atlas Traveler';
    const authPayload = {
      id: `user-${username}`,
      username,
      email: emailAddress,
      displayName,
      accessToken: `playwright-access-${username}`,
      refreshToken: `playwright-refresh-${username}`,
    };

    if (requestUrl.endsWith('/logout')) {
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestUrl.endsWith('/refresh')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authPayload),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authPayload),
    });
  });
}

test.describe('Atlas critical user flow', () => {
  test('registers, logs in, creates a spot, verifies the map pin, and generates an itinerary', async ({ page }) => {
    const uniqueSuffix = Date.now().toString();
    const emailAddress = `atlas-e2e-${uniqueSuffix}@example.com`;
    const password = 'SecurePass123!';
    const displayName = `Atlas E2E ${uniqueSuffix}`;
    const username = `atlas${uniqueSuffix}`;
    const spotTitle = `E2E Rooftop Tacos ${uniqueSuffix}`;
    const spotDescription = 'Playwright captured this premium rooftop stop for Atlas integration validation.';
    const destination = 'Dallas, TX';

    await mockAuthEndpoints(page);

    await page.goto('/register');
    await page.getByPlaceholder('louisdo').fill(username);
    await page.getByPlaceholder('Louis Do').fill(displayName);
    await page.getByPlaceholder('louis@example.com').fill(emailAddress);
    await page.getByPlaceholder('Create a strong password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole('heading', { name: 'Filters and highlights' })).toBeVisible();

    await page.locator('.profile-chip').click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

    await page.goto('/login');
    await page.getByPlaceholder('louis@example.com').fill(emailAddress);
    await page.getByPlaceholder('Enter your password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole('heading', { name: 'Filters and highlights' })).toBeVisible();

    await page.goto('/spots/new');
    await page.getByPlaceholder('Sunset Rooftop Tacos').fill(spotTitle);
    await page.getByPlaceholder('Tell travelers why this stop matters, what to order, and when it shines.').fill(spotDescription);
    await page.getByPlaceholder('123 Main St').fill('500 Commerce St');
    await page.getByPlaceholder('Fort Worth').fill('Dallas');
    await page.getByPlaceholder('US').fill('US');
    await page.getByPlaceholder('electric, calm, curated').fill('electric');
    await page.locator('[data-test="photo-upload-input"]').setInputFiles({
      name: 'atlas-e2e-spot.png',
      mimeType: 'image/png',
      buffer: buildPngFixtureBuffer(),
    });
    await page.locator('[data-test="spot-submit"]').click();

    await expect(page).toHaveURL(/\/spots\/spot-\d+$/);
    await expect(page.getByRole('heading', { name: spotTitle })).toBeVisible();
    await expect(page.getByText(spotDescription)).toBeVisible();

    await page.getByRole('link', { name: 'Map' }).click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole('button', { name: new RegExp(spotTitle, 'i') })).toBeVisible();

    await page.getByRole('link', { name: 'Trips' }).click();
    await expect(page).toHaveURL(/\/trips\/new$/);
    await expect(page.locator('[data-test="itinerary-view"]')).toBeVisible();
    await page.locator('[data-test="destination-input"]').fill(destination);
    await page.getByRole('button', { name: 'Generate itinerary' }).click();

    await expect(page.locator('[data-test="itinerary-view"]')).toContainText(destination);
    await expect(page.locator('[data-test="itinerary-view"]')).toContainText('AI itinerary');
  });
});
