import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

function loadPlaywrightEnvFile(path: string, override = false): void {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    if (!override && process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

loadPlaywrightEnvFile(resolve(currentDirectory, '..', '.env'));
loadPlaywrightEnvFile(resolve(currentDirectory, '.env.local'));
const noMockEnvDefaults = {
  VITE_DEMO_MODE: process.env.PLAYWRIGHT_DEMO_MODE ?? 'false',
  VITE_ENABLE_AUTH_MOCK_FALLBACK: 'false',
  VITE_ENABLE_TRIP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_SPOT_MOCK_FALLBACK: 'false',
  VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_USER_MOCK_FALLBACK: 'false',
  VITE_ENABLE_SOCIAL_MOCK_FALLBACK: 'false',
  VITE_ENABLE_MAP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_CLIENT_WEATHER_FALLBACK: 'false',
  VITE_ENABLE_DEMO_WEATHER: 'false',
  VITE_ENABLE_DEMO_FUEL_PRICES: 'false',
  VITE_ENABLE_AGENT_LOCAL_FALLBACK: 'false',
  VITE_ENABLE_INTEL_MOCK_FALLBACK: 'false',
  VITE_DISABLE_SERVICE_WORKER: 'true',
  VITE_SCOPE_AI_MIN_REPLY_MS: '',
} as const;

for (const [key, value] of Object.entries(noMockEnvDefaults)) {
  process.env[key] = value;
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const mapboxToken = process.env.VITE_MAPBOX_TOKEN ?? '';
const enableMapboxUiTests = process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS ?? (mapboxToken ? 'true' : 'false');
process.env.VITE_MAPBOX_TOKEN = mapboxToken;
process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS = enableMapboxUiTests;
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
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === 'true',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects,
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true'
    ? undefined
    : {
        command: 'npm run serve:e2e',
        cwd: currentDirectory,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 300 * 1000,
        env: {
          ...process.env,
          VITE_DEMO_MODE: process.env.VITE_DEMO_MODE ?? 'false',
          VITE_ENABLE_AUTH_MOCK_FALLBACK: process.env.VITE_ENABLE_AUTH_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_TRIP_MOCK_FALLBACK: process.env.VITE_ENABLE_TRIP_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK: process.env.VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK ?? 'false',
          VITE_ENABLE_SPOT_MOCK_FALLBACK: process.env.VITE_ENABLE_SPOT_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK: process.env.VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK ?? 'false',
          VITE_ENABLE_USER_MOCK_FALLBACK: process.env.VITE_ENABLE_USER_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_SOCIAL_MOCK_FALLBACK: process.env.VITE_ENABLE_SOCIAL_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_MAP_MOCK_FALLBACK: process.env.VITE_ENABLE_MAP_MOCK_FALLBACK ?? 'false',
          VITE_ENABLE_CLIENT_WEATHER_FALLBACK: process.env.VITE_ENABLE_CLIENT_WEATHER_FALLBACK ?? 'false',
          VITE_ENABLE_DEMO_WEATHER: process.env.VITE_ENABLE_DEMO_WEATHER ?? 'false',
          VITE_ENABLE_DEMO_FUEL_PRICES: process.env.VITE_ENABLE_DEMO_FUEL_PRICES ?? 'false',
          VITE_ENABLE_AGENT_LOCAL_FALLBACK: process.env.VITE_ENABLE_AGENT_LOCAL_FALLBACK ?? 'false',
          VITE_ENABLE_INTEL_MOCK_FALLBACK: process.env.VITE_ENABLE_INTEL_MOCK_FALLBACK ?? 'false',
          VITE_API_BASE_URL: process.env.PLAYWRIGHT_FRONTEND_API_BASE_URL ?? '/',
          VITE_CSRF_ENDPOINT: process.env.PLAYWRIGHT_FRONTEND_CSRF_ENDPOINT ?? '',
          VITE_MAPBOX_TOKEN: mapboxToken,
          VITE_ENABLE_MAPBOX_IN_UI_TESTS: enableMapboxUiTests,
          VITE_DISABLE_SERVICE_WORKER: process.env.VITE_DISABLE_SERVICE_WORKER ?? 'true',
        },
      },
});
