import { expect, test } from './fixtures/atlas-test';

test.describe('Atlas social flow', () => {
  test('views the feed, likes an item, accepts a friend request, and opens notifications', async ({ page, atlasApi }) => {
    await atlasApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const notificationBadge = page.locator('[data-test="notification-badge"]');
    const firstLikeButton = page.locator('[data-test^="feed-like-"]').first();

    await expect(page.getByRole('heading', { name: 'Activity Feed' })).toBeVisible();
    await expect(notificationBadge).toHaveText('2');
    await expect(firstLikeButton).toHaveAttribute('aria-pressed', 'false');

    await firstLikeButton.scrollIntoViewIfNeeded();
    await firstLikeButton.click();
    await expect(firstLikeButton).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/friends', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Build your Atlas travel circle.' })).toBeVisible();

    await page.locator('[data-test="tab-requests"]').click();
    await expect(page.locator('[data-test="request-card"]')).toHaveCount(3);

    await page.locator('[data-test="accept-request-request-1"]').click();

    await expect(page.locator('[data-test="tab-all"]')).toContainText('7');
    await expect(page.locator('[data-test="tab-requests"]')).toContainText('2');
    await expect(page.locator('[data-test="friend-card"]')).toHaveCount(7);
    await expect(notificationBadge).toHaveText('3');

    await page.locator('[data-test="notification-toggle"]').click();

    const notificationMenu = page.locator('[data-test="notification-menu"]');
    const acceptedFriendNotification = page.locator('[data-test="notification-row-notification-friend-request-1"]');

    await expect(notificationMenu).toBeVisible();
    await expect(notificationMenu).toContainText('Recent updates');
    await expect(acceptedFriendNotification).toBeVisible();
    await expect(acceptedFriendNotification).toContainText('New Atlas friend');
    await expect(acceptedFriendNotification).toContainText('Sofia Ramirez is now in your Atlas travel circle.');
  });
});
