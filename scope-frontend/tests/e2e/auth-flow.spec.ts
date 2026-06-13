import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/scope-test';

const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
const REGISTERED_ACCOUNT = {
  username: 'playwright.traveler',
  firstName: 'Playwright',
  lastName: 'Traveler',
  displayName: 'Playwright Traveler',
  email: 'playwright.traveler@example.com',
  phoneNumber: '(555) 867-5309',
  password: 'SecurePass123!',
  dateOfBirth: '1998-05-14',
  acceptedTerms: true,
};

async function expectSessionHint(page: Page, expected: boolean): Promise<void> {
  await expect
    .poll(async () => page.evaluate((storageKey) => (
      Boolean(window.localStorage.getItem(storageKey)) ||
      Boolean(window.sessionStorage.getItem(storageKey))
    ), AUTH_SESSION_HINT_STORAGE_KEY))
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

async function setDateFieldValue(field: Locator, value: string): Promise<void> {
  await field.evaluate(
    (input, nextValue) => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

      valueSetter?.call(input, nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );
}

function isRetryableNavigationAbort(error: unknown): boolean {
  return error instanceof Error && /NS_BINDING_ABORTED|NS_ERROR_FAILURE|ERR_ABORTED|interrupted/i.test(error.message);
}

async function gotoAuthRoute(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      if (!isRetryableNavigationAbort(error) || attempt === 2) {
        throw error;
      }
    }
  }
}

async function reloadAuthRoute(page: Page, path: string): Promise<void> {
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (error) {
    if (!isRetryableNavigationAbort(error) && !(error instanceof Error && /timeout/i.test(error.message))) {
      throw error;
    }
    await gotoAuthRoute(page, path);
  }
}

async function fillRegisterForm(page: Page, overrides: Partial<typeof REGISTERED_ACCOUNT> = {}): Promise<void> {
  const account = { ...REGISTERED_ACCOUNT, ...overrides };
  const form = registerForm(page);

  await form.locator('input[autocomplete="given-name"]').fill(account.firstName);
  await form.locator('input[autocomplete="family-name"]').fill(account.lastName);
  await form.locator('input[autocomplete="username"]').fill(account.username);
  await form.locator('input[autocomplete="email"]').fill(account.email);
  await setDateFieldValue(form.locator('input[autocomplete="bday"]'), account.dateOfBirth);
  await form.locator('input[autocomplete="tel"]').fill(account.phoneNumber);
  await form.locator('input[autocomplete="new-password"]').first().fill(account.password);
  await form.locator('input[autocomplete="new-password"]').nth(1).fill(account.password);

  const termsCheckbox = form.locator('#register-accept-terms');
  if (account.acceptedTerms) {
    await termsCheckbox.check();
  } else {
    await termsCheckbox.uncheck();
  }
}

async function fillLoginForm(page: Page, overrides: Partial<Pick<typeof REGISTERED_ACCOUNT, 'email' | 'password'>> = {}): Promise<void> {
  const account = {
    email: overrides.email ?? REGISTERED_ACCOUNT.email,
    password: overrides.password ?? REGISTERED_ACCOUNT.password,
  };
  const form = loginForm(page);

  await form.locator('input[autocomplete="username"]').fill(account.email);
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

test.describe('Scope auth flow', () => {
  test('keeps authenticated chrome visible while a persisted session refreshes', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, {
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });
    await page.addInitScript(() => {
      const windowWithAuthFlash = window as Window & { __scopeGuestAuthFlash?: boolean };
      windowWithAuthFlash.__scopeGuestAuthFlash = false;

      document.addEventListener('DOMContentLoaded', () => {
        const detectGuestAuthActions = () => {
          if (document.querySelector('.guest-actions, .guest-navbar__auth-actions, .navbar__mobile-guest-actions')) {
            windowWithAuthFlash.__scopeGuestAuthFlash = true;
          }
        };

        detectGuestAuthActions();
        new MutationObserver(detectGuestAuthActions).observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      });
    });
    await page.route('**/api/core/auth/refresh', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fallback();
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    const navbar = page.locator('header.navbar');
    await expect(navbar.locator('[data-test="auth-session-placeholder"]')).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Create account' })).toHaveCount(0);
    await expect(page.locator('button.profile-chip')).toContainText('Louis Do');
    await expect
      .poll(() => page.evaluate(() => Boolean((window as Window & { __scopeGuestAuthFlash?: boolean }).__scopeGuestAuthFlash)))
      .toBe(false);
  });

  test('registers with validation, logs in with a redirect target, persists the session across reload, and logs out cleanly', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);

    await gotoAuthRoute(page, '/register?redirect=/settings');
    await expect(page.getByRole('heading', { name: 'Create your Scope account' })).toBeVisible();

    await fillRegisterForm(page, {
      username: '',
      firstName: '',
      lastName: '',
      email: 'scope@example',
      phoneNumber: '555',
      password: 'short',
      dateOfBirth: '',
      acceptedTerms: false,
    });
    await submitAuthForm(page);

    await expect(page.getByText('Choose a handle (e.g. johndoe).')).toBeVisible();
    await expect(page.getByText('Enter your first name.')).toBeVisible();
    await expect(page.getByText('Enter your last name.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Use a 10-digit phone number.')).toBeVisible();
    await expect(page.getByText('Use at least 10 characters for a stronger password.')).toBeVisible();
    await expect(page.getByText('You must be 13 or older to use Scope.')).toBeVisible();
    await expect(page.getByText('Agree to the Terms and Privacy Policy.')).toBeVisible();
    await expect(page).toHaveURL(/\/register(?:\?redirect=(?:%2F|\/)settings)?$/);
    await expectSessionHint(page, false);

    await fillRegisterForm(page);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/onboarding\/preferences\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'What do you want to find on Scope?' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await logoutFromNavbar(page);
    await expect(page).toHaveURL(/\/$/);
    await expectSessionHint(page, false);

    await gotoAuthRoute(page, '/login?redirect=/settings');
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();

    await fillLoginForm(page);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await reloadAuthRoute(page, '/settings');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Shape how Scope looks, feels, and shares your story.' })).toBeVisible();
    await expect(page.locator('button.profile-chip')).toContainText(REGISTERED_ACCOUNT.displayName);
    await expectSessionHint(page, true);

    await logoutFromNavbar(page);
    await expect(page).toHaveURL(/\/$/);
    await expectSessionHint(page, false);

    await gotoAuthRoute(page, '/settings');
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)settings$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();
    await expectSessionHint(page, false);
  });
});
