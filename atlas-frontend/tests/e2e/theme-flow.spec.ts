import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/atlas-test';

const THEME_STORAGE_KEY = 'atlas-theme';

async function expectThemeState(page: Page, themeMode: 'dark' | 'light') {
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(themeMode);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe(themeMode);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY)).toBe(themeMode);

  const resolvedThemeColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const metaElement = document.querySelector('meta[name="theme-color"]');
        return metaElement?.getAttribute('content') ?? '';
      }),
    )
    .toBe(resolvedThemeColor);
}

test.describe('Atlas theme toggle persistence', () => {
  test('switches dark/light mode from the shell and persists across reload plus protected-route navigation', async ({ page, atlasApi }) => {
    await atlasApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expectThemeState(page, 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'light');

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Atlas looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'light');
    await expect(page.locator('[data-test="theme-option-light"].is-active')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

    await page.locator('[data-test="theme-option-dark"]').click();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Atlas looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
  });
});
