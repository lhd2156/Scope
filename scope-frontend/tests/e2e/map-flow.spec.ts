import { expect, test } from './fixtures/scope-test';

test.describe('Scope map interactions', () => {
  test('loads the map workspace, selects a marker, shows the sidebar detail, and navigates to the spot detail route', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Curate the map by mood' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /spot(?:s)? ready to explore/i })).toBeVisible();

    const selectedSpotCard = page.locator('[data-test="map-selected-spot-card"]');
    const sunsetSpotButton = page.getByRole('button', { name: /Sunset Rooftop Tacos/i }).first();

    await expect(sunsetSpotButton).toBeVisible();
    await sunsetSpotButton.click();
    await expect(selectedSpotCard).toContainText('Sunset Rooftop Tacos');
    await expect(selectedSpotCard).toContainText('Open-air tacos, frozen palomas');

    const detailLink = page.locator('[data-test="map-selected-spot-detail-link"]');
    await expect(detailLink).toHaveAttribute('href', '/spots/spot-1');
    await detailLink.click();

    await expect(page).toHaveURL(/\/spots\/spot-1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sunset Rooftop Tacos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick planning notes' })).toBeVisible();
    await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();
  });
});
