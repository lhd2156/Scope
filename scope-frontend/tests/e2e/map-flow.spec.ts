import { expect, test } from './fixtures/scope-test';

test.describe('Scope map interactions', () => {
  test('loads the map workspace, selects a marker, shows the sidebar detail, and navigates to the spot detail route', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Curate the map by mood' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /spot(?:s)? ready to explore/i })).toBeVisible();
    await expect(page.locator('[data-test="map-fallback-stage"]')).toBeVisible();

    const selectedSpotCard = page.locator('[data-test="map-selected-spot-card"]');
    const secondMarker = page.locator('[data-test="map-fallback-marker-spot-2"]');
    const secondMarkerHitArea = page.locator('[data-test="map-fallback-marker-hit-spot-2"]');

    await expect(selectedSpotCard).toContainText('Sunset Rooftop Tacos');
    await expect(secondMarker).not.toHaveClass(/is-active/);

    await secondMarkerHitArea.click();

    await expect(secondMarker).toHaveClass(/is-active/);
    await expect(selectedSpotCard).toContainText('Botanic River Walk');
    await expect(selectedSpotCard).toContainText('A shady riverside boardwalk with spring blooms');

    const detailLink = page.locator('[data-test="map-selected-spot-detail-link"]');
    await expect(detailLink).toHaveAttribute('href', '/spots/spot-2');
    await detailLink.click();

    await expect(page).toHaveURL(/\/spots\/spot-2$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Botanic River Walk' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick planning notes' })).toBeVisible();
    await expect(page.locator('[data-test="spot-gallery"]')).toBeVisible();
  });
});
