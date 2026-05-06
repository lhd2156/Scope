import { expect, test } from './fixtures/scope-test';

test.describe('Scope trip planner flow', () => {
  test('keeps the route copilot build prompt in-place without reloading the page', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      const loadCountKey = 'scope-e2e-trip-planner-load-count';
      const currentLoadCount = Number(window.sessionStorage.getItem(loadCountKey) ?? '0');
      window.sessionStorage.setItem(loadCountKey, String(currentLoadCount + 1));
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();

    await planner.locator('[data-test="trip-title-input"]').fill('No reload route');
    await planner.getByLabel('Start date').fill('2026-05-08');
    await planner.getByLabel('End date').fill('2026-05-10');
    await planner.locator('[data-test="destination-input"]').fill('Oklahoma City, Oklahoma');
    await planner.locator('[data-test="end-destination-input"]').fill('Dexter, New Mexico');
    await planner.locator('[data-test="trip-interest-scenic"]').click();

    const urlBeforeBuild = page.url();
    const loadCountBeforeBuild = await page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'));
    const firstBuildPrompt = page.locator('[data-test="trip-ai-suggestion"]').filter({ hasText: 'Build the itinerary from Oklahoma City, Oklahoma to Dexter, New Mexico' });
    await expect(firstBuildPrompt).toHaveCount(1);
    await firstBuildPrompt.click();

    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-ai-response"]')).toContainText('route builder, map preview, and copilot are synced now');

    expect(page.url()).toBe(urlBeforeBuild);
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'))).toBe(loadCountBeforeBuild);
  });

  test('creates a trip brief, adds destinations, generates an AI itinerary, and renders the packed timeline', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();
    await expect(planner.getByRole('heading', { name: 'New trip' })).toBeVisible();
    await expect(page.locator('[data-test="itinerary-planning-card"]')).toBeVisible();

    await planner.locator('[data-test="trip-title-input"]').fill('Playwright Patagonia Sprint');
    await expect(planner.locator('[data-test="trip-title-input"]')).toHaveValue('Playwright Patagonia Sprint');
    await planner.getByLabel('Start date').fill('2026-05-08');
    await planner.getByLabel('End date').fill('2026-05-10');
    await expect(planner.locator('input[type="range"]')).toHaveCount(0);
    await planner.locator('[data-test="budget-floor-input"]').fill('125');
    await planner.locator('[data-test="budget-ceiling-input"]').fill('7200');
    await planner.locator('[data-test="destination-input"]').fill('Patagonia, Chile + Argentina');
    await planner.locator('[data-test="end-destination-input"]').fill('Torres del Paine, Chile');

    await planner.locator('[data-test="trip-pace-packed"]').click();
    await planner.locator('[data-test="trip-interest-adventure"]').click();
    await planner.locator('[data-test="trip-interest-nature"]').click();
    await planner.locator('[data-test="trip-interest-scenic"]').click();
    await planner.locator('[data-test="trip-planner-submit"]').click();

    const timelineOverlay = page.locator('[data-test="itinerary-timeline-overlay"]');

    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();
    await expect(page.locator('[data-test="itinerary-summary-stops"]')).toContainText('5 stops');
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(3);
    await expect(timelineOverlay).toContainText('Mount Fitz Roy');
    await expect(timelineOverlay).toContainText('Torres del Paine');
    await expect(timelineOverlay).toContainText('Day 1');
    await expect(timelineOverlay).toContainText('Day 2');
    await expect(timelineOverlay).toContainText('Day 3');
  });
});
