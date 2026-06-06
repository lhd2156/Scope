import { Buffer } from 'node:buffer';
import type { Page, Response } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

const SPOT_PHOTO = {
  name: 'production-public-spot.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tSfoAAAAASUVORK5CYII=', 'base64'),
};

const PUBLIC_SPOT = {
  title: 'Playwright River Market Patio',
  description: 'Production-style public pin with real fixture persistence, searchable patio notes, and safe copy.',
  address: '501 Riverfront Ave',
  city: 'Fort Worth',
  country: 'US',
  category: 'food',
  vibe: 'sunlit market patio',
  rating: '4.7',
  visitedAt: '2026-05-21',
  latitude: '32.7561',
  longitude: '-97.3314',
};

const EXPECTED_NAVIGATION_PATTERN =
  /Frame load interrupted|NS_ERROR_FAILURE|NS_BINDING_ABORTED|interrupted by another navigation|Timeout/i;

async function gotoAllowingImmediateRedirect(page: Page, path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      return;
    } catch (error) {
      if (!EXPECTED_NAVIGATION_PATTERN.test(String(error)) || attempt === 3) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }
}

async function fillPublicSpotForm(page: Page): Promise<void> {
  const form = page.locator('[data-test="spot-form"]');

  await expect(form).toBeVisible();
  await form.locator('[data-test="photo-upload-input"]').setInputFiles(SPOT_PHOTO);
  await expect(form.locator('[data-test="photo-preview-card"]')).toHaveCount(1);

  await form.getByRole('textbox', { name: 'Place' }).fill(PUBLIC_SPOT.title);
  await form.getByLabel('Description').fill(PUBLIC_SPOT.description);
  await form.getByLabel('Address').fill(PUBLIC_SPOT.address);
  await form.getByLabel('City').fill(PUBLIC_SPOT.city);
  await form.getByLabel('Country').fill(PUBLIC_SPOT.country);
  await form.getByLabel('Spot category').selectOption(PUBLIC_SPOT.category);
  await form.getByLabel('Optional vibe').fill(PUBLIC_SPOT.vibe);
  await form.getByLabel('Rating').fill(PUBLIC_SPOT.rating);
  await form.getByLabel('Visited at').fill(PUBLIC_SPOT.visitedAt);
  await form.getByLabel('Latitude').fill(PUBLIC_SPOT.latitude);
  await form.getByLabel('Longitude').fill(PUBLIC_SPOT.longitude);
}

async function createPublicSpot(page: Page): Promise<{ id: string; verificationStatus: string; safetyStatus: string }> {
  await page.goto('/spots/new');
  await expect(page.getByRole('heading', { name: 'New spot' })).toBeVisible();

  await fillPublicSpotForm(page);

  const composeResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/content/spots/compose') && response.request().method() === 'POST',
  );
  await page.locator('[data-test="spot-submit"]').click();

  const composeResponse = await composeResponsePromise;
  expect(composeResponse.ok()).toBeTruthy();

  const payload = await composeResponse.json();
  const spot = payload.data;
  expect(spot.verificationStatus).toBe('verified');
  expect(spot.safetyStatus).toBe('clean');
  expect(spot.providerPlaceId).toBeTruthy();

  await expect(page).toHaveURL(new RegExp(`/spots/${spot.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: PUBLIC_SPOT.title })).toBeVisible();

  return {
    id: spot.id,
    verificationStatus: spot.verificationStatus,
    safetyStatus: spot.safetyStatus,
  };
}

async function waitForOkResponse(responsePromise: Promise<Response>): Promise<void> {
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

test.describe('production-minded data flows', () => {
  test('publishes a verified public spot and another user sees it through explore, quick search, map, and detail', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    const createdSpot = await createPublicSpot(page);
    expect(createdSpot.verificationStatus).toBe('verified');
    expect(createdSpot.safetyStatus).toBe('clean');

    await scopeApi.seedSession(page, {
      id: 'user-2',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
    });

    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Explore standout places/i })).toBeVisible();

    await page.getByLabel('Search spots').fill(PUBLIC_SPOT.title);
    await expect(page.locator('[data-test="results-count"]')).toContainText('1');
    await expect(page.getByText(PUBLIC_SPOT.title).first()).toBeVisible();
    await expect(page.getByText(/Fort Worth, TX|San Antonio, TX|Austin, TX/).first()).toBeVisible();

    const navbarSearch = page.locator('.quick-search-shell--desktop').getByLabel('Search Scope');
    await navbarSearch.fill('River Market Patio');
    await expect(page.locator('[data-test="quick-search-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-test="quick-search-result"]').filter({ hasText: PUBLIC_SPOT.title })).toBeVisible();

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    const publicSpotMapButton = page.getByRole('button', { name: new RegExp(PUBLIC_SPOT.title) }).first();
    await expect(publicSpotMapButton).toBeVisible();
    await publicSpotMapButton.click();
    await expect(page.locator('[data-test="map-selected-spot-card"]')).toContainText(PUBLIC_SPOT.title);

    await page.goto('/spots/spot-1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Sunset Rooftop Tacos' })).toBeVisible();
    await expect(page.getByText('2 reviews').first()).toBeVisible();
    await expect(page.getByText('The reviews are real fixture data here')).toBeVisible();
  });

  test('searches users by name, sends friend requests, opens profiles, and shows online/planning presence', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    await gotoAllowingImmediateRedirect(page, '/friends');
    await expect(page.getByRole('heading', { name: 'Build your Scope travel circle.' })).toBeVisible();
    await expect(page.locator('[data-test="friends-online-rail"]')).toContainText('Online');
    await expect(page.locator('[data-test="friends-online-rail"]')).toContainText('Planning');

    await page.locator('[data-test="online-rail-user-2"]').click();
    await expect(page).toHaveURL(/\/profile\/user-2$/);
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Maya Chen');

    await gotoAllowingImmediateRedirect(page, '/friends');
    await page.getByLabel('Search friends and Scope members').fill('Aisha');
    await expect(page.locator('[data-test="main-search-results"]')).toBeVisible();
    await expect(page.locator('[data-test="find-people-results"]')).toContainText('Aisha Green');

    await page.locator('[data-test="send-request-suggestion-aisha"]').click();
    await page.getByLabel('Search friends and Scope members').fill('');

    await page.locator('[data-test="tab-requests"]').click();
    await expect(page.locator('[data-test="request-card"]')).toHaveCount(4);
    await expect(page.locator('[data-test="requests-grid"]')).toContainText('Aisha Green');

    await page.locator('[data-test="notification-toggle"]').click();
    await expect(page.locator('[data-test="notification-menu"]')).toContainText('Recent updates');
    await expect(page.locator('[data-test="notification-menu"]')).toContainText(/Trip invite|Spot liked|Review posted/);
  });

  test('persists profile pinned and wishlist collections with real spot/trip data', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/profile/user-1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="profile-header"]')).toContainText('Louis Do');
    await expect(page.locator('[data-test="profile-stats"]')).toBeVisible();

    await page.locator('[data-test="profile-collection-section"]').getByRole('button', { name: /Pinned/ }).click();
    await expect(page.locator('[data-test="profile-collection-rail"]')).toHaveAttribute('data-active-collection', 'pinned');
    await expect(page.locator('[data-test="profile-collection-rail"]')).toContainText('Sunset Rooftop Tacos');

    await page.locator('[data-test="profile-collection-section"]').getByRole('button', { name: /Wishlist/ }).click();
    await expect(page.locator('[data-test="profile-collection-rail"]')).toHaveAttribute('data-active-collection', 'wishlist');
    await expect(page.locator('[data-test="profile-collection-rail"]')).toContainText('Mount Bonnell Lookout');
  });

  test('saves recent trips, shares from the new-trip flow, validates invite conditions, and survives back navigation', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();
    await expect(planner.locator('[data-test="trip-interest-food"]')).toHaveClass(/active/);
    await expect(planner.locator('[data-test="trip-interest-culture"]')).toHaveClass(/active/);
    await expect(planner.locator('[data-test="trip-interest-nightlife"]')).toHaveClass(/active/);

    await planner.locator('[data-test="trip-title-input"]').fill('Playwright Shareable Weekend');
    await planner.getByLabel('Start date').fill('2026-06-05');
    await planner.getByLabel('End date').fill('2026-06-07');
    await planner.locator('[data-test="destination-input"]').fill('Fort Worth, TX');
    await planner.locator('[data-test="end-destination-input"]').fill('Dallas, TX');
    await planner.locator('[data-test="budget-floor-input"]').fill('100');
    await planner.locator('[data-test="budget-ceiling-input"]').fill('650');

    const saveResponse = page.waitForResponse((response) =>
      response.url().includes('/api/content/trips') && ['POST', 'PUT'].includes(response.request().method()),
    );
    await page.locator('[data-test="trip-save-draft"]').click();
    await waitForOkResponse(saveResponse);
    await expect(page.locator('[data-test="trip-autosave-status"]')).toContainText('Autosaved');

    await page.locator('[data-test="trip-visibility-public"]').click();
    await expect(page.locator('[data-test="trip-autosave-status"]')).toContainText('Autosaved');
    await expect(page.locator('[data-test="trip-visibility-public"]')).toHaveAttribute('aria-pressed', 'true');

    await expect(page.locator('[data-test="trip-share-button"]')).toBeEnabled();
    await page.locator('[data-test="trip-share-button"]').click();
    await expect(page.locator('[data-test="trip-share-form"]')).toBeVisible();

    await page.locator('[data-test="trip-share-recipient"]').fill('555-1212');
    await page.locator('[data-test="trip-share-submit"]').click();
    await expect(page.getByText('Phone-only invites are not supported.')).toBeVisible();

    await page.locator('[data-test="trip-share-recipient"]').fill('maya@example.com');
    const inviteResponse = page.waitForResponse((response) =>
      /\/api\/content\/trips\/trip-\d+\/members$/.test(new URL(response.url()).pathname) &&
      response.request().method() === 'POST',
    );
    await page.locator('[data-test="trip-share-submit"]').click();
    await waitForOkResponse(inviteResponse);
    await expect(page.locator('[data-test="trip-share-form"]')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Current trip crew' })).toContainText('Maya Chen');
    await expect(page.getByRole('region', { name: 'Current trip crew' })).toContainText(/Editor invite pending|Editor/);

    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Trip workspace' })).toBeVisible();
    await expect(page.getByText('Playwright Shareable Weekend')).toBeVisible();

    const createdTripCard = page.locator('article').filter({ hasText: 'Playwright Shareable Weekend' });
    const editTripLink = createdTripCard.getByRole('link', { name: 'Edit' });
    await expect(editTripLink).toHaveAttribute('href', /\/trips\/trip-\d+\/edit$/);
    await editTripLink.scrollIntoViewIfNeeded();
    await editTripLink.click();
    await expect(page).toHaveURL(/\/trips\/trip-\d+\/edit$/);
    await expect(page.locator('[data-test="trip-title-input"]')).toHaveValue('Playwright Shareable Weekend');

    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText('Playwright Shareable Weekend')).toBeVisible();
  });
});
