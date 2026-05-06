import { expect, test } from './fixtures/scope-test';

test.describe('Playwright multi-browser harness', () => {
  test('renders guest entry routes and protected-route redirects with deterministic API mocks', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your Scope account' })).toBeVisible();

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();
  });

  test('renders protected map and trip workspaces once the mocked session is seeded', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/map');
    await expect(page.getByRole('heading', { name: 'Curate the map by mood' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /spot(?:s)? ready to explore/i })).toBeVisible();

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: /new trip/i }).click();
    await expect(page).toHaveURL(/\/trips\/new$/);
    await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
    await expect(page.locator('[data-test="itinerary-view"]')).toBeVisible();
  });
});
