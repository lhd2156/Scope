import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.ATLAS_VISUAL_BASE_URL ?? 'http://127.0.0.1:4184';
const CUSTOM_EXECUTABLE = process.env.ATLAS_VISUAL_BROWSER_EXECUTABLE ?? '';
const SCREENSHOT_ROOT = path.resolve('test-results', 'phase13-visual-qa');
const VIEWPORT = { width: 1440, height: 1120 };
const DEFAULT_SETTLE_MS = 2200;
const ROUTE_TIMEOUT_MS = 45000;
const IMAGE_SETTLE_TIMEOUT_MS = 12000;
const AUTO_SCROLL_STEP_DELAY_MS = 250;
const MOCK_REFRESH_PAYLOAD = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
  accessToken: 'visual-qa-access-token',
  refreshToken: 'visual-qa-refresh-token',
};

const guestRoutes = [
  { slug: 'home', path: '/', readySelector: '#home-hero-title' },
  { slug: 'explore', path: '/explore', readySelector: '.explore-page .discovery-shell h1' },
  { slug: 'map', path: '/map', readySelector: '.map-page .filter-panel h1', settleMs: 3000 },
  { slug: 'spot-detail', path: '/spots/spot-1', readySelector: '[data-test="spot-gallery"]', settleMs: 2800 },
  { slug: 'login', path: '/login', readySelector: '.auth-card__header h2' },
  { slug: 'register', path: '/register', readySelector: '.auth-card__header h2' },
  { slug: 'not-found', path: '/missing/path', readySelector: '.state-card h2' },
];

const authRoutes = [
  { slug: 'friends', path: '/friends', readySelector: '.friends-page .network-shell h1' },
  { slug: 'profile', path: '/profile/user-1', readySelector: '.profile-page .profile-hero', settleMs: 2800 },
  { slug: 'settings', path: '/settings', readySelector: '.settings-page .settings-shell h1' },
  { slug: 'trip-planner', path: '/trips/new', readySelector: '[data-test="trip-planner"]', settleMs: 2800 },
  { slug: 'trip-detail', path: '/trips/trip-1', readySelector: '[data-test="trip-detail"]', settleMs: 2800 },
  { slug: 'spot-create', path: '/spots/new', readySelector: '[data-test="spot-form"]' },
  { slug: 'spot-edit', path: '/spots/spot-1/edit', readySelector: '[data-test="spot-form"]', settleMs: 2600 },
];

function sanitizePath(routePath) {
  return routePath === '/' ? '/' : routePath.replace(/\/+$/, '');
}

async function ensureDirectories() {
  await mkdir(SCREENSHOT_ROOT, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createBrowser() {
  const launchOptions = { headless: true };

  if (CUSTOM_EXECUTABLE && await fileExists(CUSTOM_EXECUTABLE)) {
    return chromium.launch({ ...launchOptions, executablePath: CUSTOM_EXECUTABLE });
  }

  return chromium.launch(launchOptions);
}

function buildScreenshotPath(theme, slug) {
  return path.join(SCREENSHOT_ROOT, `${theme}-${slug}.png`);
}

async function attachDiagnostics(page, summary) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      summary.consoleErrors.push({ route: summary.currentRoute ?? 'unknown', text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    summary.pageErrors.push({ route: summary.currentRoute ?? 'unknown', text: error.message });
  });
}

async function createInstrumentedPage(context, summary) {
  const page = await context.newPage();
  await attachDiagnostics(page, summary);
  return page;
}

async function mockAuthenticatedSession(context) {
  const authResponse = {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: MOCK_REFRESH_PAYLOAD }),
  };

  await context.route('**/api/core/auth/login', async (route) => {
    await route.fulfill(authResponse);
  });

  await context.route('**/api/core/auth/refresh', async (route) => {
    await route.fulfill(authResponse);
  });

  await context.route('**/api/core/auth/logout', async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    });
  });
}

async function createContext(browser, theme, options = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: theme,
    deviceScaleFactor: 1,
  });

  await context.addInitScript((themeMode) => {
    localStorage.setItem('atlas-theme', themeMode);
    window.__ATLAS_VISUAL_QA__ = true;
  }, theme);

  if (options.mockAuthenticatedSession) {
    await mockAuthenticatedSession(context);
  }

  return context;
}

async function autoScrollForLazyContent(page) {
  await page.evaluate(async ({ stepDelayMs }) => {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const root = document.scrollingElement || document.documentElement;
    const viewportHeight = window.innerHeight || 900;
    const maxScrollTop = Math.max(0, root.scrollHeight - viewportHeight);

    if (maxScrollTop <= 0) {
      return;
    }

    const stepSize = Math.max(Math.floor(viewportHeight * 0.72), 320);

    for (let scrollTop = 0; scrollTop < maxScrollTop; scrollTop += stepSize) {
      window.scrollTo({ top: scrollTop, behavior: 'auto' });
      await wait(stepDelayMs);
    }

    window.scrollTo({ top: maxScrollTop, behavior: 'auto' });
    await wait(stepDelayMs);
    window.scrollTo({ top: 0, behavior: 'auto' });
    await wait(stepDelayMs);
  }, { stepDelayMs: AUTO_SCROLL_STEP_DELAY_MS });
}

async function waitForVisibleImages(page) {
  await page.waitForFunction(
    () => {
      const renderedImages = Array.from(document.images).filter((image) => {
        if (!image.isConnected) {
          return false;
        }

        return image.clientWidth > 0 || image.clientHeight > 0;
      });

      return renderedImages.every((image) => image.complete && image.naturalWidth > 0);
    },
    undefined,
    { timeout: IMAGE_SETTLE_TIMEOUT_MS },
  ).catch(() => undefined);
}

async function waitForPageSettled(page, route) {
  await page.waitForLoadState('domcontentloaded', { timeout: ROUTE_TIMEOUT_MS });

  if (route.readySelector) {
    await page.locator(route.readySelector).first().waitFor({ state: 'visible', timeout: ROUTE_TIMEOUT_MS });
  }

  await page.waitForFunction(() => document.fonts?.status !== 'loading', undefined, { timeout: ROUTE_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForTimeout(route.settleMs ?? DEFAULT_SETTLE_MS);
  await autoScrollForLazyContent(page);
  await waitForVisibleImages(page);
}

async function warmLazyImages(page) {
  await page.evaluate(async () => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const viewportHeight = window.innerHeight;
    const step = Math.max(320, Math.floor(viewportHeight * 0.8));

    for (let offset = 0; offset < documentHeight; offset += step) {
      window.scrollTo({ top: offset, behavior: 'auto' });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  });

  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(900);
}

function assertExpectedPath(page, route, summary) {
  const actualPath = new URL(page.url()).pathname;
  const expectedPath = sanitizePath(route.path);

  if (actualPath !== expectedPath) {
    summary.unexpectedRoutes.push({
      slug: route.slug,
      expectedPath,
      actualPath,
      finalUrl: page.url(),
    });
  }
}

async function capturePage(page, theme, route, summary) {
  const normalizedPath = sanitizePath(route.path);
  summary.currentRoute = normalizedPath;
  process.stdout.write(`[${theme}] Capturing ${route.slug} (${normalizedPath})\n`);
  await page.goto(`${BASE_URL}${normalizedPath}`, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT_MS });
  await waitForPageSettled(page, route);
  await warmLazyImages(page);
  await waitForVisibleImages(page);
  assertExpectedPath(page, route, summary);

  const screenshotPath = buildScreenshotPath(theme, route.slug);
  await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 0 });

  summary.captures.push({
    theme,
    slug: route.slug,
    path: normalizedPath,
    screenshotPath: path.relative(process.cwd(), screenshotPath).replace(/\\/g, '/'),
    title: await page.title(),
    finalUrl: page.url(),
  });
}

async function signIn(page, theme, summary) {
  const loginRoute = { path: '/login', readySelector: '.auth-card__header h2', settleMs: DEFAULT_SETTLE_MS };
  summary.currentRoute = '/login';
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 0 });
  await waitForPageSettled(page, loginRoute);

  await page.locator('input[type="email"]').fill('louis@example.com');
  await page.locator('input[type="password"]').fill('SecurePass123!');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/map', { timeout: 0 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  await waitForPageSettled(page, { path: '/map', readySelector: '.map-page .filter-panel h1', settleMs: 3000 });
  await warmLazyImages(page);
  await waitForVisibleImages(page);

  const signedInPath = buildScreenshotPath(theme, 'post-login-map');
  await page.screenshot({ path: signedInPath, fullPage: true, timeout: 0 });
  summary.captures.push({
    theme,
    slug: 'post-login-map',
    path: '/map',
    screenshotPath: path.relative(process.cwd(), signedInPath).replace(/\\/g, '/'),
    title: await page.title(),
    finalUrl: page.url(),
  });
}

async function captureRoutes(context, theme, routes, summary) {
  for (const route of routes) {
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const page = await createInstrumentedPage(context, summary);

      try {
        await capturePage(page, theme, route, summary);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;

        if (attempt === 1) {
          process.stdout.write(`[${theme}] Retrying ${route.slug} after a transient capture failure\n`);
        }
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}

function buildMarkdownReport(summary) {
  const lines = [
    '# Phase 13 Visual QA',
    '',
    `- Base URL: ${summary.baseUrl}`,
    `- Screenshot root: ${summary.screenshotRoot}`,
    `- Captures: ${summary.captures.length}`,
    `- Console errors: ${summary.consoleErrors.length}`,
    `- Page errors: ${summary.pageErrors.length}`,
    `- Unexpected route landings: ${summary.unexpectedRoutes.length}`,
    '',
    '## Captures',
    '',
  ];

  for (const capture of summary.captures) {
    lines.push(`- [${capture.theme}] ${capture.slug} → ${capture.screenshotPath}`);
  }

  if (summary.consoleErrors.length) {
    lines.push('', '## Console errors', '');
    for (const item of summary.consoleErrors) {
      lines.push(`- ${item.route}: ${item.text}`);
    }
  }

  if (summary.pageErrors.length) {
    lines.push('', '## Page errors', '');
    for (const item of summary.pageErrors) {
      lines.push(`- ${item.route}: ${item.text}`);
    }
  }

  if (summary.unexpectedRoutes.length) {
    lines.push('', '## Unexpected route landings', '');
    for (const item of summary.unexpectedRoutes) {
      lines.push(`- ${item.slug}: expected ${item.expectedPath}, landed on ${item.actualPath} (${item.finalUrl})`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function run() {
  await ensureDirectories();

  const browser = await createBrowser();
  const summary = {
    baseUrl: BASE_URL,
    screenshotRoot: path.relative(process.cwd(), SCREENSHOT_ROOT).replace(/\\/g, '/'),
    captures: [],
    consoleErrors: [],
    pageErrors: [],
    unexpectedRoutes: [],
    currentRoute: null,
  };

  try {
    for (const theme of ['dark', 'light']) {
      const guestContext = await createContext(browser, theme);
      await captureRoutes(guestContext, theme, guestRoutes, summary);
      await guestContext.close();

      const authContext = await createContext(browser, theme, { mockAuthenticatedSession: true });
      const authBootstrapPage = await createInstrumentedPage(authContext, summary);
      await signIn(authBootstrapPage, theme, summary);
      await authBootstrapPage.close();
      await captureRoutes(authContext, theme, authRoutes, summary);
      await authContext.close();
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(SCREENSHOT_ROOT, 'summary.json');
  const reportPath = path.join(SCREENSHOT_ROOT, 'report.md');
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(reportPath, buildMarkdownReport(summary), 'utf8');

  process.stdout.write(`${summary.captures.length} screenshots written to ${summary.screenshotRoot}\n`);
  process.stdout.write(`Summary: ${path.relative(process.cwd(), summaryPath).replace(/\\/g, '/')}\n`);
  process.stdout.write(`Report: ${path.relative(process.cwd(), reportPath).replace(/\\/g, '/')}\n`);
  process.stdout.write(`Console errors: ${summary.consoleErrors.length}; page errors: ${summary.pageErrors.length}; unexpected routes: ${summary.unexpectedRoutes.length}\n`);

  if (summary.consoleErrors.length || summary.pageErrors.length || summary.unexpectedRoutes.length) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
