import { expect, test } from '@playwright/test';

async function mockAdminApis(page: import('@playwright/test').Page) {
  await page.route('**/api/core/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { email?: string };
    if (body.email === 'bad@scope.local') {
      await route.fulfill({ status: 401, json: { error: 'Invalid credentials' } });
      return;
    }
    await route.fulfill({ json: { accessToken: 'e2e-token' } });
  });
  await page.route('**/api/core/users/me', async (route) => {
    await route.fulfill({
      json: { id: 'admin-1', username: 'admin', email: 'admin@scope.local', role: 'admin' },
    });
  });
  await page.route('**/api/core/users**', async (route) => {
    if (route.request().url().includes('/api/core/users/me')) {
      await route.fulfill({
        json: { id: 'admin-1', username: 'admin', email: 'admin@scope.local', role: 'admin' },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: [
          { id: 'user-1', username: 'sarah', email: 'sarah@scope.local', status: 'active', role: 'user' },
          { id: 'user-2', username: 'mike', email: 'mike@scope.local', status: 'banned', role: 'user' },
        ],
        total: 2,
      },
    });
  });
  await page.route('**/api/content/spots/**', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'spot-1',
            title: 'Tokyo Ramen',
            city: 'Tokyo',
            country: 'Japan',
            flagged: true,
            reviewCount: 4,
          },
          { id: 'spot-2', title: 'Ocean Trail', city: 'San Francisco', flagged: false, reviewCount: 8 },
        ],
        total: 2,
      },
    });
  });
  await page.route('**/api/content/trips/**', async (route) => {
    await route.fulfill({
      json: { data: [{ id: 'trip-1', title: 'Japan Week', memberCount: 3, spotCount: 8 }], total: 1 },
    });
  });
  await page.route('**/api/content/reviews/**', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'review-1',
            user: 'sarah',
            spot: 'Tokyo Ramen',
            rating: 5,
            text: 'Great',
            flagged: true,
            status: 'flagged',
          },
        ],
        total: 1,
      },
    });
  });
  await page.route('**/api/content/photos/**', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'photo-1',
            url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E',
            status: 'pending',
          },
        ],
        total: 1,
      },
    });
  });
  await page.route('**/api/intel/health', async (route) => {
    await route.fulfill({ json: { status: 'healthy' } });
  });
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@scope.local');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Total Users')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockAdminApis(page);
});

test('valid credentials navigate to dashboard', async ({ page }) => {
  await login(page);
});

test('invalid credentials show an error toast', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('bad@scope.local');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Login failed')).toBeVisible();
});

test('users page supports search', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByPlaceholder('Search username or email').fill('sarah');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('link', { name: 'sarah' })).toBeVisible();
});

test('users table exposes pagination controls', async ({ page }) => {
  await login(page);
  await page.goto('/admin/users');
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
});

test('user detail page renders profile actions', async ({ page }) => {
  await login(page);
  await page.goto('/admin/users/user-1');
  await expect(page.getByText('Edit role')).toBeVisible();
});

test('spots page lists and filters flagged spots', async ({ page }) => {
  await login(page);
  await page.goto('/admin/spots');
  await page.getByRole('combobox').selectOption('true');
  await expect(page.getByText('Tokyo Ramen')).toBeVisible();
});

test('review moderation exposes approve and reject actions', async ({ page }) => {
  await login(page);
  await page.goto('/admin/reviews');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
});

test('photos page exposes bulk moderation', async ({ page }) => {
  await login(page);
  await page.goto('/admin/photos');
  await expect(page.getByRole('button', { name: 'Approve selected' })).toBeVisible();
});
