import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
    },
  },
  {
    name: 'firefox',
    use: {
      ...devices['Desktop Firefox'],
    },
  },
  {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari'],
    },
  },
  ...(process.env.PLAYWRIGHT_INCLUDE_EDGE === 'true'
    ? [
        {
          name: 'msedge',
          use: {
            browserName: 'chromium' as const,
            channel: 'msedge',
            viewport: { width: 1440, height: 960 },
          },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 180 * 1000,
  expect: {
    timeout: 60 * 1000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 1),
  outputDir: 'test-results/playwright-artifacts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/html-report' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects,
  webServer: {
    command: 'npm run serve:e2e',
    cwd: currentDirectory,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300 * 1000,
    env: {
      ...process.env,
      VITE_DEMO_MODE: process.env.VITE_DEMO_MODE ?? 'false',
      VITE_ENABLE_AUTH_MOCK_FALLBACK: process.env.VITE_ENABLE_AUTH_MOCK_FALLBACK ?? 'false',
      // Social flow e2e coverage exercises the seeded Scope network. Real
      // production accounts start with an empty travel circle and build it
      // through the find-people search on the Friends page.
      VITE_ENABLE_SOCIAL_MOCK_FALLBACK: process.env.VITE_ENABLE_SOCIAL_MOCK_FALLBACK ?? 'true',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? '/',
      VITE_CSRF_ENDPOINT: process.env.VITE_CSRF_ENDPOINT ?? '',
      VITE_MAPBOX_TOKEN: process.env.VITE_MAPBOX_TOKEN ?? '',
      VITE_DISABLE_SERVICE_WORKER: process.env.VITE_DISABLE_SERVICE_WORKER ?? 'true',
    },
  },
});
