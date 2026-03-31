import { expect, test } from './fixtures/atlas-test';

test.describe('Atlas trip planner flow', () => {
  test('creates a trip brief, adds destinations, generates an AI itinerary, and renders the packed timeline', async ({ page, atlasApi }) => {
    await atlasApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Generate an itinerary from your travel constraints' })).toBeVisible();
    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();

    const planner = page.locator('[data-test="trip-planner"]');
    const stopCards = planner.locator('[data-test="trip-stop-card"]');

    await expect(stopCards).toHaveCount(3);

    await planner.locator('[data-test="trip-title-input"]').fill('Playwright Patagonia Sprint');
    await expect(planner.locator('[data-test="trip-title-input"]')).toHaveValue('Playwright Patagonia Sprint');

    await planner.locator('[data-test="trip-add-stop"]').click();
    await expect(stopCards).toHaveCount(4);
    await expect(planner.getByText('Puerto Natales Waterfront')).toBeVisible();

    await planner.locator('[data-test="destination-search-input"]').fill('ushuaia');
    await planner.locator('[data-test="trip-add-stop"]').click();
    await expect(stopCards).toHaveCount(5);
    await expect(planner.getByText('Beagle Channel Outlook')).toBeVisible();

    await planner.locator('[data-test="trip-pace-packed"]').click();
    await planner.locator('[data-test="trip-planner-submit"]').click();

    const timelineOverlay = page.locator('[data-test="itinerary-timeline-overlay"]');

    await expect(page.locator('[data-test="itinerary-summary-stops"]')).toContainText('5 stops');
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(3);
    await expect(timelineOverlay).toContainText('Beagle Channel Outlook');
    await expect(timelineOverlay).toContainText('Day 1');
    await expect(timelineOverlay).toContainText('Day 2');
    await expect(timelineOverlay).toContainText('Day 3');
  });
});
