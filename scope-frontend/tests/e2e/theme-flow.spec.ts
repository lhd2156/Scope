import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

const THEME_STORAGE_KEY = 'scope-theme';
const THEME_COLORS = {
  dark: '#0f0f1a',
  light: '#fafafa',
} as const;

async function expectThemeState(page: Page, themeMode: 'dark' | 'light') {
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(themeMode);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe(themeMode);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY)).toBe(themeMode);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const metaElement = document.querySelector('meta[name="theme-color"]');
        return metaElement?.getAttribute('content') ?? '';
      }),
    )
    .toBe(THEME_COLORS[themeMode]);
}

test.describe('Scope theme toggle persistence', () => {
  test('switches between light and dark themes and persists the selected mode', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'dark');

    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
    await expect(page.locator('[data-test="theme-option-light"]')).toBeVisible();

    await page.locator('[data-test="theme-option-light"]').click();
    await expectThemeState(page, 'light');
    await expect(page.locator('[data-test="theme-option-light"].is-active')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'light');
    await expect(page.locator('[data-test="theme-option-light"].is-active')).toBeVisible();

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'light');

    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-test="theme-option-dark"]').click();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
  });
});
