import { expect, test } from './fixtures/scope-test';

test.describe('Scope notifications page', () => {
  test('filters, marks read, clears empty filters, marks all read, and updates preferences', async ({ page }) => {
    await page.goto('/login?redirect=/notifications', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Your name, 555 123 4567, or email@example.com').fill('louis@example.com');
    await page.getByPlaceholder('Enter your password').fill('SecurePass123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Scope inbox' })).toBeVisible();

    const notificationRows = page.locator('[data-test^="notifications-row-"]');
    await expect(notificationRows).toHaveCount(4);
    await expect(page.locator('[data-test="notifications-filter-trip"]')).toContainText('1');
    await expect(page.locator('[data-test="notifications-filter-social"]')).toContainText('2');
    await expect(page.locator('[data-test="notifications-filter-friend"]')).toContainText('1');

    await page.locator('[data-test="notifications-filter-trip"]').click();
    await expect(page.locator('[data-test="notifications-row-notification-1"]')).toBeVisible();
    await expect(page.locator('[data-test="notifications-row-notification-2"]')).toHaveCount(0);

    await page.locator('[data-test="notifications-unread-toggle"]').click();
    await expect(page.locator('[data-test="notifications-unread-toggle"] input')).toBeChecked();

    const tripNotification = page.locator('[data-test="notifications-row-notification-1"]');
    await tripNotification.getByRole('button', { name: 'Mark read' }).click();
    await expect(page.locator('[data-test="notifications-empty-state"]')).toContainText('No notifications match');

    await page.locator('[data-test="notifications-clear-filters"]').click();
    await expect(page.locator('[data-test="notifications-unread-toggle"] input')).not.toBeChecked();
    await expect(notificationRows).toHaveCount(4);

    await page.locator('[data-test="notifications-mark-all-read"]').click();
    await expect(page.locator('.unread-dot')).toHaveCount(0);

    const tripPreference = page.locator('.preference-row').filter({ hasText: 'Trips' });
    await expect(tripPreference).toHaveCount(1);
    const tripPushToggle = tripPreference.getByRole('button', { name: 'Push' });
    await expect(tripPushToggle).toHaveAttribute('aria-pressed', 'true');
    await tripPushToggle.click();
    await expect(tripPushToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
