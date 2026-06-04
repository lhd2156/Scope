import { Buffer } from 'node:buffer';
import { expect, test } from './fixtures/scope-test';

const SPOT_PHOTO = {
  name: 'phase20-spot.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tSfoAAAAASUVORK5CYII=', 'base64'),
};

test.describe('Phase 20 QA coverage', () => {
  test('preserves logical keyboard focus order through the primary login actions', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sign in to Scope' })).toBeVisible();

    const emailField = page.getByLabel('Email, phone, or display name');
    const passwordField = page.locator('input[autocomplete="current-password"]');
    const showPasswordButton = page.getByRole('button', { name: 'Show password' });
    const rememberMeToggle = page.getByLabel('Remember me');
    const forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    const continueWithGoogleButton = page.getByRole('button', { name: 'Continue with Google' });
    const createAccountLink = page.getByRole('link', { name: 'Create an account' });

    await emailField.focus();
    await expect(emailField).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(passwordField).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(showPasswordButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(rememberMeToggle).toBeFocused();

    await page.keyboard.press('Tab');

    const forgotPasswordReceivedFocus = await forgotPasswordLink.evaluate((element) => document.activeElement === element);
    if (forgotPasswordReceivedFocus) {
      await page.keyboard.press('Tab');
    }

    await expect(signInButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(continueWithGoogleButton).toBeFocused();

    await expect(createAccountLink).toBeVisible();
  });

  test('surfaces trip planner edge-case validation and keeps keyboard-only controls operable', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();

    await planner.locator('[data-test="destination-input"]').fill('');
    await planner.getByLabel('Start date').fill('2026-05-18');
    await planner.getByLabel('End date').fill('2026-05-15');

    await planner.locator('[data-test="trip-planner-submit"]').click();

    await expect(planner.getByText('Enter a start or final city, state, or place so Scope can build a route.')).toBeVisible();
    await expect(planner.getByText('End date must be on or after the start date.')).toBeVisible();
    await expect(planner.getByText('Set a real route first; the guide uses the drive before it suggests anything.')).toBeVisible();

    const budgetSlider = planner.getByRole('spinbutton', { name: 'Minimum budget' });
    const originalBudgetFloor = await budgetSlider.inputValue();
    await budgetSlider.focus();
    await page.keyboard.press('ArrowUp');
    await expect(budgetSlider).not.toHaveValue(originalBudgetFloor);

    const relaxedPaceCard = planner.locator('[data-test="trip-pace-relaxed"]');
    await relaxedPaceCard.focus();
    await page.keyboard.press('Enter');
    await expect(relaxedPaceCard).toHaveClass(/active/);

    const shoppingChip = planner.locator('button.interest-chip').filter({ hasText: 'Shopping' }).first();
    await shoppingChip.focus();
    await page.keyboard.press('Space');
    await expect(shoppingChip).toHaveClass(/active/);
  });

  test('blocks invalid spot coordinates and safely renders HTML-like spot content as text', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/spots/new', { waitUntil: 'domcontentloaded' });

    const form = page.locator('[data-test="spot-form"]');
    await expect(form).toBeVisible();

    await form.locator('[data-test="photo-upload-input"]').setInputFiles(SPOT_PHOTO);
    await expect(form.locator('[data-test="photo-preview-card"]')).toHaveCount(1);

    await form.getByRole('textbox', { name: 'Place' }).fill('Skyline <b>Glow</b> Lounge');
    await form.getByLabel('Description').fill('Premium skyline notes <script>alert("scope")</script> after dark.');
    await form.getByLabel('Address').fill('501 Riverfront Ave');
    await form.getByLabel('City').fill('Fort Worth');
    await form.getByLabel('Country').fill('US');
    await form.getByLabel('Spot category').selectOption('nightlife');
    await form.getByLabel('Optional vibe').fill('night <em>energy</em>');
    await form.getByLabel('Rating').fill('4.8');
    await form.getByLabel('Visited at').fill('2026-04-01');
    await form.getByLabel('Latitude').fill('91');
    await form.getByLabel('Longitude').fill('-181');

    await form.locator('[data-test="spot-submit"]').click();

    await expect(form.getByText('Latitude must be between -90 and 90.')).toBeVisible();
    await expect(form.getByText('Longitude must be between -180 and 180.')).toBeVisible();

    await form.getByLabel('Latitude').fill('32.7561');
    await form.getByLabel('Longitude').fill('-97.3314');
    await form.locator('[data-test="spot-submit"]').click();

    await expect(page).toHaveURL(/\/spots\/spot-\d+$/);
    await expect(page.locator('h1')).toContainText('Skyline <b>Glow</b> Lounge');
    await expect(page.locator('.headline-description')).toContainText('Premium skyline notes <script>alert("scope")</script> after dark.');
    await expect(page.locator('.headline-description script')).toHaveCount(0);
  });
});
