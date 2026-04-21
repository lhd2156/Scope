import { Buffer } from 'node:buffer';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/atlas-test';

const SPOT_PHOTO = {
  name: 'playwright-spot.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tSfoAAAAASUVORK5CYII=', 'base64'),
};

const createdSpot = {
  title: 'Playwright Skyline Lounge',
  description: 'Glass-wrapped rooftop cocktails with a polished skyline view and late-night DJ sets.',
  address: '501 Riverfront Ave',
  city: 'Fort Worth',
  country: 'US',
  category: 'nightlife',
  vibe: 'electric skyline',
  rating: '4.6',
  visitedAt: '2026-03-31',
};

const updatedSpot = {
  title: 'Playwright Moonlit Lounge',
  description: 'An updated Atlas pin with sharper copy, moodier lighting notes, and a more premium nighttime cue.',
  vibe: 'moonlit social',
  rating: '4.9',
};

async function fillCreateSpotForm(page: Page): Promise<void> {
  const form = page.locator('[data-test="spot-form"]');

  await expect(form).toBeVisible();
  await form.locator('[data-test="photo-upload-input"]').setInputFiles(SPOT_PHOTO);
  await expect(form.locator('[data-test="photo-preview-card"]')).toHaveCount(1);

  await form.getByLabel('Title').fill(createdSpot.title);
  await form.getByLabel('Description').fill(createdSpot.description);
  await form.getByLabel('Address').fill(createdSpot.address);
  await form.getByLabel('City').fill(createdSpot.city);
  await form.getByLabel('Country').fill(createdSpot.country);
  await form.getByLabel('Category').selectOption(createdSpot.category);
  await form.getByLabel('Vibe').fill(createdSpot.vibe);
  await form.getByLabel('Rating').fill(createdSpot.rating);
  await form.getByLabel('Visited at').fill(createdSpot.visitedAt);
}

test.describe('spot CRUD flow', () => {
  test('creates, edits, views, deletes, and verifies removal of a spot with deterministic mocks', async ({ page, atlasApi }) => {
    await atlasApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('atlas-analytics-consent', 'denied');
    });

    await page.goto('/spots/new');
    await expect(page.getByRole('heading', { name: 'Drop a new adventure pin' })).toBeVisible();

    await fillCreateSpotForm(page);
    await page.locator('[data-test="spot-submit"]').click();

    await expect(page).toHaveURL(/\/spots\/spot-\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: createdSpot.title })).toBeVisible();
    await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();
    await expect(page.locator('.headline-description')).toContainText(createdSpot.description);
    await expect(page.getByText('Delete this spot')).toBeVisible();

    await page.getByRole('link', { name: 'Edit this spot' }).click();

    const editForm = page.locator('[data-test="spot-form"]');
    await expect(page).toHaveURL(/\/spots\/spot-\d+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Refine a community pin' })).toBeVisible();
    await expect(editForm).toBeVisible();
    await expect(editForm.getByLabel('Title')).toHaveValue(createdSpot.title);

    await editForm.getByLabel('Title').fill(updatedSpot.title);
    await editForm.getByLabel('Description').fill(updatedSpot.description);
    await editForm.getByLabel('Vibe').fill(updatedSpot.vibe);
    await editForm.getByLabel('Rating').fill(updatedSpot.rating);
    await editForm.locator('[data-test="spot-submit"]').click();

    await expect(page).toHaveURL(/\/spots\/spot-\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: updatedSpot.title })).toBeVisible();
    await expect(page.locator('.headline-description')).toContainText(updatedSpot.description);
    await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();

    await page.getByRole('button', { name: 'Delete this spot' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete this spot?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete spot' }).click();

    await expect(page).toHaveURL(/\/explore(?:\?.*)?$/);
    await expect(page.getByRole('heading', { level: 1, name: /Explore standout places through photo-led discovery/i })).toBeVisible();

    const searchInput = page.getByLabel('Search spots');
    await searchInput.fill(updatedSpot.title);

    await expect.poll(async () => (await page.locator('[data-test="results-count"]').textContent())?.trim()).toBe('0');
    await expect(page.getByRole('heading', { name: 'No spots match the current filters' })).toBeVisible();
  });
});
