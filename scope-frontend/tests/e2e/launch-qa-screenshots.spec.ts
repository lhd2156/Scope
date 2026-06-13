import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures/scope-test';
import { buildSpotPath } from '@/utils/spotRoutes';

const screenshotDir = process.env.SCOPE_QA_SCREENSHOT_DIR ?? 'test-results/launch-qa-screenshots';
const spotPhoto = {
  name: 'launch-qa-spot.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tSfoAAAAASUVORK5CYII=', 'base64'),
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

async function capture(page: { screenshot: (options: { path: string; fullPage?: boolean; animations?: 'disabled' }) => Promise<Buffer> }, name: string, fullPage = false) {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage,
    animations: 'disabled',
  });
}

test.describe('launch QA screenshot evidence', () => {
  test('captures public auth, onboarding, social, notification, place, trip, map, and mobile states', async ({ page, scopeApi }) => {
    await scopeApi.clearSession(page);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Sign in to Scope/i })).toBeVisible();
    await capture(page, '01-login');

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Create your Scope account/i })).toBeVisible();
    await capture(page, '02-register');

    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.goto('/onboarding/preferences', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/preferences|vibes|interests/i);
    await capture(page, '03-onboarding-preferences');

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="settings-sidebar"]')).toBeVisible();
    await capture(page, '04-settings-profile-controls');

    await page.goto('/profile/user-1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Louis Do');
    await capture(page, '05-profile-display');

    await page.goto('/spots/new', { waitUntil: 'domcontentloaded' });
    const spotForm = page.locator('[data-test="spot-form"]');
    await expect(spotForm).toBeVisible();
    await spotForm.locator('[data-test="photo-upload-input"]').setInputFiles(spotPhoto);
    await spotForm.getByRole('textbox', { name: 'Place' }).fill('Launch QA Skyline Patio');
    await spotForm.getByLabel('Description').fill('Disposable launch QA place for screenshot evidence.');
    await spotForm.getByLabel('Address').fill('501 Riverfront Ave');
    await spotForm.getByLabel('City').fill('Fort Worth');
    await spotForm.getByLabel('Country').fill('US');
    await spotForm.getByLabel('Spot category').selectOption('food');
    await spotForm.getByLabel('Optional vibe').fill('public launch proof');
    await spotForm.getByLabel('Rating').fill('4.8');
    await spotForm.getByLabel('Visited at').fill('2026-06-13');
    await spotForm.getByLabel('Latitude').fill('32.7561');
    await spotForm.getByLabel('Longitude').fill('-97.3314');
    await capture(page, '06-add-place-form');

    await page.locator('[data-test="spot-submit"]').click();
    const createdSpotPath = buildSpotPath({ id: 'spot-1', title: 'Launch QA Skyline Patio', city: 'Fort Worth' });
    await expect(page).toHaveURL(new RegExp(`${createdSpotPath}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Launch QA Skyline Patio' })).toBeVisible();
    await capture(page, '07-created-spot-detail');

    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Search spots').fill('Sunset Rooftop Tacos');
    await expect(page.locator('[data-test="explore-results"]')).toContainText('Sunset Rooftop Tacos');
    await capture(page, '08-explore-search');

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    const sunsetSpotButton = page.getByRole('button', { name: /Sunset Rooftop Tacos/i }).first();
    await expect(sunsetSpotButton).toBeVisible();
    await sunsetSpotButton.click();
    await expect(page.locator('[data-test="map-selected-spot-card"]')).toContainText('Sunset Rooftop Tacos');
    await capture(page, '09-map-marker-popup');

    await page.goto('/friends', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-test="tab-requests"]').click();
    await expect(page.locator('[data-test="request-card"]')).toHaveCount(3);
    await page.locator('[data-test="requests-grid"]').scrollIntoViewIfNeeded();
    await capture(page, '10-friend-requests');

    await page.locator('[data-test="notification-toggle"]').click();
    await expect(page.locator('[data-test="notification-menu"]')).toBeVisible();
    await capture(page, '11-notifications-dropdown');

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Scope inbox' })).toBeVisible();
    await capture(page, '12-notifications-page');

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();
    await planner.locator('[data-test="trip-title-input"]').fill('Launch QA Shareable Weekend');
    await planner.getByLabel('Start date').fill('2026-06-20');
    await planner.getByLabel('End date').fill('2026-06-22');
    await planner.locator('[data-test="destination-input"]').fill('Fort Worth, TX');
    await planner.locator('[data-test="end-destination-input"]').fill('Dallas, TX');
    await capture(page, '13-trip-planner');

    await page.locator('[data-test="trip-save-draft"]').click();
    await expect(page.locator('[data-test="trip-share-button"]')).toBeEnabled();
    await page.locator('[data-test="trip-share-button"]').click();
    await expect(page.locator('[data-test="trip-share-form"]')).toBeVisible();
    await page.locator('[data-test="trip-share-recipient"]').fill('maya@example.com');
    await capture(page, '14-trip-share-invite');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="mobile-menu-toggle"]')).toBeVisible();
    await page.locator('[data-test="mobile-menu-toggle"]').click();
    await capture(page, '15-mobile-navigation');
  });
});
