import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/atlas-test';

const AUTH_SESSION_HINT_STORAGE_KEY = 'atlas-auth-session-hint';
const REGISTERED_ACCOUNT = {
  username: 'playwright.traveler',
  displayName: 'Playwright Traveler',
  email: 'playwright.traveler@example.com',
  password: 'SecurePass123!',
};

async function expectSessionHint(page: Page, expected: boolean): Promise<void> {
  await expect
    .poll(async () => page.evaluate((storageKey) => Boolean(window.localStorage.getItem(storageKey)), AUTH_SESSION_HINT_STORAGE_KEY))
    .toBe(expected);
}

async function submitAuthForm(page: Page): Promise<void> {
  const authForm = page.locator('form.auth-form');

  await expect(authForm).toBeVisible();
  await authForm.evaluate((formElement) => {
    (formElement as HTMLFormElement).requestSubmit();
  });
}

function registerForm(page: Page): Locator {
  return page.locator('form.auth-form');
}

function loginForm(page: Page): Locator {
  return page.locator('form.auth-form');
}

async function fillRegisterForm(page: Page, overrides: Partial<typeof REGISTERED_ACCOUNT> = {}): Promise<void> {
  const account = { ...REGISTERED_ACCOUNT, ...overrides };
  const form = registerForm(page);

  await form.locator('input[autocomplete="username"]').fill(account.username);
  await form.locator('input[autocomplete="name"]').fill(account.displayName);
  await form.locator('input[type="email"]').fill(account.email);
  await form.locator('input[type="password"]').fill(account.password);
}

async function fillLoginForm(page: Page, overrides: Partial<Pick<typeof REGISTERED_ACCOUNT, 'email' | 'password'>> = {}): Promise<void> {
  const account = {
    email: overrides.email ?? REGISTERED_ACCOUNT.email,
    password: overrides.password ?? REGISTERED_ACCOUNT.password,
  };
  const form = loginForm(page);

  await form.locator('input[type="email"]').fill(account.email);
  await form.locator('input[type="password"]').fill(account.password);
}

async function openProfileMenu(page: Page): Promise<void> {
  const profileMenuButton = page.locator('button.profile-chip');

  await expect(profileMenuButton).toBeVisible();
  await profileMenuButton.click();
  await expect(profileMenuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu')).toBeVisible();
}

async function logoutFromNavbar(page: Page): Promise<void> {
  await openProfileMenu(page);
  await page.getByRole('menuitem', { name: 'Log out' }).click();
}

test.describe('Atlas auth flow', () => {
  test('registers with validation, logs in with a redirect target, persists the session across reload, and logs out cleanly', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);

    await page.goto('/register?redirect=/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Create your Atlas account' })).toBeVisible();

    await fillRegisterForm(page, {
      username: '',
      displayName: '',
      email: 'atlas@example',
      password: 'short',
    });
    await submitAuthForm(page);

    await expect(page.getByText('Choose a username for your Atlas profile.')).toBeVisible();
    await expect(page.getByText('Add the name people will see across Atlas.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters for a stronger password.')).toBeVisible();
    await expect(page).toHaveURL(/\/register(?:\?redirect=(?:%2F|\/)settings)?$/);
    await expectSessionHint(page, false);

    await fillRegisterForm(page);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Atlas looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await logoutFromNavbar(page);
    await expect(page).toHaveURL(/\/$/);
    await expectSessionHint(page, false);

    await page.goto('/login?redirect=/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Atlas' })).toBeVisible();

    await fillLoginForm(page);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Atlas looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Atlas looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await logoutFromNavbar(page);
    await expect(page).toHaveURL(/\/$/);
    await expectSessionHint(page, false);

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Atlas' })).toBeVisible();
    await expectSessionHint(page, false);
  });
});
