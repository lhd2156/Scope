import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

const THEME_STORAGE_KEY = 'scope-theme';

async function expectThemeState(page: Page, themeMode: 'dark') {
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

test.describe('Scope theme toggle persistence', () => {
  test('keeps the shell dark-only and presents light mode as coming soon across reload plus protected-route navigation', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'dark');
    const themeControl = page.getByRole('button', { name: 'Light mode coming soon' });
    await expect(themeControl).toBeVisible();
    await expect(themeControl).toBeDisabled();

    await expectThemeState(page, 'dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Curate the map by mood' })).toBeVisible();
    await expectThemeState(page, 'dark');

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
    await expect(page.locator('[data-test="theme-option-light"]')).toContainText('Coming soon');
    await expect(page.getByRole('button', { name: 'Light mode coming soon' })).toBeVisible();

    await page.locator('[data-test="theme-option-dark"]').click();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Light mode coming soon' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expectThemeState(page, 'dark');
    await expect(page.locator('[data-test="theme-option-dark"].is-active')).toBeVisible();
  });
});
