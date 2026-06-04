import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

async function scrollLocatorToViewportCenter(page: Page, locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const targetTop = Math.max(0, rect.top + window.scrollY - window.innerHeight * 0.5);
    window.scrollTo(0, targetTop);
  });

  await page.waitForFunction((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }, await locator.elementHandle());
}

test.describe('Scope social flow', () => {
  test('views the feed, likes an item, accepts a friend request, and opens notifications', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const notificationBadge = page.locator('[data-test="notification-badge"]');
    const firstLikeButton = page.locator('[data-test^="feed-like-"]').first();

    const feedHeading = page.getByRole('heading', { name: 'Activity Feed' });

    await expect(feedHeading).toBeVisible();
    await feedHeading.scrollIntoViewIfNeeded();
    await expect(notificationBadge).toHaveText('2');
    await expect(firstLikeButton).toBeVisible();
    await expect(firstLikeButton).toHaveAttribute('aria-pressed', 'false');

    await scrollLocatorToViewportCenter(page, firstLikeButton);
    await firstLikeButton.click();
    await expect(firstLikeButton).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/friends', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Build your Scope travel circle.' })).toBeVisible();

    await page.locator('[data-test="tab-requests"]').click();
    await expect(page.locator('[data-test="request-card"]')).toHaveCount(3);

    await page.locator('[data-test="accept-request-request-1"]').click();

    await expect(page.locator('[data-test="tab-all"]')).toContainText('6');
    await expect(page.locator('[data-test="tab-requests"]')).toContainText('2');
    const showMoreButton = page.locator('[data-test="friends-show-more"]');
    if (await showMoreButton.isVisible()) {
      await showMoreButton.click();
    }
    await expect(page.locator('[data-test="friend-card"]')).toHaveCount(6);
    await expect(notificationBadge).toHaveText('3');

    await page.locator('[data-test="notification-toggle"]').click();

    const notificationMenu = page.locator('[data-test="notification-menu"]');
    const acceptedFriendNotification = page.locator('[data-test="notification-row-notification-friend-request-1"]');

    await expect(notificationMenu).toBeVisible();
    await expect(notificationMenu).toContainText('Recent updates');
    await expect(acceptedFriendNotification).toBeVisible();
    await expect(acceptedFriendNotification).toContainText('New Scope friend');
    await expect(acceptedFriendNotification).toContainText('Sofia Ramirez is now in your Scope travel circle.');
  });
});
