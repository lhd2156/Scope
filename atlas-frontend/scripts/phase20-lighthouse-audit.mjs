import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDirectory, '..');
const viteCliPath = resolve(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const requestedPreviewPort = Number(process.env.LIGHTHOUSE_PORT ?? 4177);
const requestedChromeDebugPort = Number(process.env.LIGHTHOUSE_CHROME_PORT ?? 9222);
const auditPreset = (process.env.LIGHTHOUSE_PRESET ?? 'desktop').trim().toLowerCase();
const reportRoot = resolve(workspaceRoot, 'test-results', 'lighthouse', auditPreset);
const routeFilter = (process.env.LIGHTHOUSE_ROUTE_FILTER ?? '').trim().toLowerCase();
const parsedRouteAttempts = Number.parseInt(process.env.LIGHTHOUSE_ROUTE_ATTEMPTS ?? '2', 10);
const routeAttempts = Number.isFinite(parsedRouteAttempts) && parsedRouteAttempts > 0 ? parsedRouteAttempts : 2;
const ANALYTICS_CONSENT_STORAGE_KEY = 'atlas-analytics-consent';
const ONBOARDING_COMPLETION_STORAGE_KEY = 'atlas-onboarding-completed-v1';
const ONBOARDING_COMPLETION_VALUE = 'completed';
const AUTH_SESSION_HINT_STORAGE_KEY = 'atlas-auth-session-hint';
const AUTH_SESSION_HINT_VERSION = 1;
const PREP_PATH = '/';
const SESSION_GUEST = 'guest';
const SESSION_AUTHENTICATED = 'authenticated';
const routes = [
  { slug: 'home', path: '/', session: SESSION_GUEST },
  { slug: 'explore', path: '/explore', session: SESSION_GUEST },
  { slug: 'map', path: '/map', session: SESSION_GUEST },
  { slug: 'spot-detail', path: '/spots/demo-spot-1', session: SESSION_GUEST },
  { slug: 'login', path: '/login', session: SESSION_GUEST },
  { slug: 'register', path: '/register', session: SESSION_GUEST },
  { slug: 'not-found', path: '/this-route-does-not-exist', session: SESSION_GUEST, skipSeoTarget: true },
  { slug: 'trip-planner', path: '/trips/new', session: SESSION_AUTHENTICATED },
  { slug: 'trip-detail', path: '/trips/demo-trip-1', session: SESSION_AUTHENTICATED },
  { slug: 'spot-create', path: '/spots/new', session: SESSION_AUTHENTICATED },
  { slug: 'spot-edit', path: '/spots/demo-spot-1/edit', session: SESSION_AUTHENTICATED },
  { slug: 'profile', path: '/profile/demo-user-1', session: SESSION_AUTHENTICATED },
  { slug: 'friends', path: '/friends', session: SESSION_AUTHENTICATED },
  { slug: 'settings', path: '/settings', session: SESSION_AUTHENTICATED },
];

let previewPort = requestedPreviewPort;
let chromeDebugPort = requestedChromeDebugPort;
let baseUrl = `http://127.0.0.1:${previewPort}`;
let userDataDir = '';

function commandName(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function createAuditEnv(overrides = {}) {
  return {
    ...process.env,
    VITE_DEMO_MODE: 'true',
    VITE_ENABLE_AUTH_MOCK_FALLBACK: 'true',
    VITE_ENABLE_USER_MOCK_FALLBACK: 'true',
    VITE_DISABLE_SERVICE_WORKER: process.env.VITE_DISABLE_SERVICE_WORKER ?? 'true',
    ...overrides,
  };
}

function delay(timeMs) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, timeMs);
  });
}

function spawnProcess(command, args, options = {}) {
  const childProcess = spawn(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  let stdout = '';
  let stderr = '';

  childProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    if (options.pipeOutput) {
      process.stdout.write(text);
    }
  });

  childProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    if (options.pipeOutput) {
      process.stderr.write(text);
    }
  });

  const result = new Promise((resolveResult, rejectResult) => {
    childProcess.on('error', rejectResult);
    childProcess.on('exit', (code, signal) => {
      resolveResult({ code: signal ? 1 : code ?? 1, signal, stdout, stderr });
    });
  });

  return { childProcess, result, readStdout: () => stdout, readStderr: () => stderr };
}

async function canListenOnPort(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      resolvePort(false);
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function findAvailablePort(startPort, attempts = 40) {
  for (let port = startPort; port < startPort + attempts; port += 1) {
    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`Could not find an available port starting at ${startPort}.`);
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the server is ready.
    }

    await delay(500);
  }

  throw new Error(`Preview server did not become ready within ${timeoutMs}ms at ${url}.`);
}

async function buildAuditBundle() {
  const { result } = spawnProcess(process.execPath, [viteCliPath, 'build'], {
    env: createAuditEnv(),
    pipeOutput: true,
  });

  const buildResult = await result;

  if (buildResult.code !== 0) {
    throw new Error(`Audit build failed: ${buildResult.stderr || buildResult.stdout}`);
  }
}

async function startPreviewServer() {
  previewPort = await findAvailablePort(requestedPreviewPort);
  baseUrl = `http://127.0.0.1:${previewPort}`;

  const previewProcess = spawnProcess(process.execPath, [viteCliPath, 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], {
    env: createAuditEnv(),
    pipeOutput: true,
  });

  await waitForHttp(baseUrl, 60_000);
  return previewProcess;
}

async function startChromium() {
  chromeDebugPort = await findAvailablePort(Math.max(requestedChromeDebugPort, chromeDebugPort + 1));
  const tempRoot = resolve(workspaceRoot, '.tmp');
  await mkdir(tempRoot, { recursive: true });
  userDataDir = await mkdtemp(join(tempRoot, `lighthouse-${auditPreset}-profile-`));

  const chromePath = chromium.executablePath();
  const chromeProcess = spawnProcess(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${chromeDebugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--allow-insecure-localhost',
      '--allow-running-insecure-content',
      `--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:${previewPort},http://localhost:${previewPort}`,
      '--ignore-certificate-errors',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades,InterestFeedContentSuggestions,MediaRouter,OptimizationHints,Translate',
      '--disable-notifications',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--password-store=basic',
      '--use-mock-keychain',
      'about:blank',
    ],
    {
      pipeOutput: true,
    },
  );

  const browserUrl = `http://127.0.0.1:${chromeDebugPort}/json/version`;
  await waitForHttp(browserUrl, 30_000);
  return chromeProcess;
}

async function connectBrowser() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chromeDebugPort}`);
  const startTime = Date.now();

  while (Date.now() - startTime < 10_000) {
    const context = browser.contexts()[0];
    if (context) {
      return { browser, context };
    }

    await delay(250);
  }

  throw new Error('Could not connect to a Chromium browser context for Lighthouse preparation.');
}

async function seedSessionState(context, session) {
  await context.clearCookies();

  const openPages = context.pages().filter((page) => !page.isClosed());
  await Promise.all(openPages.map((page) => page.close().catch(() => undefined)));

  const prepPage = typeof context.newPage === 'function'
    ? await context.newPage().catch(() => null)
    : null;

  if (!prepPage) {
    throw new Error('Could not acquire a preparation page for Lighthouse session seeding.');
  }

  const prepUrl = new URL(PREP_PATH, baseUrl);
  prepUrl.searchParams.set('atlasQaSession', session);
  await prepPage.goto(prepUrl.toString(), { waitUntil: 'domcontentloaded' });
  await prepPage.evaluate(
    ({
      analyticsConsentKey,
      onboardingCompletionKey,
      onboardingCompletionValue,
      authSessionHintKey,
      authSessionHintVersion,
      authenticated,
    }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(analyticsConsentKey, 'denied');
      window.localStorage.setItem(onboardingCompletionKey, onboardingCompletionValue);

      if (authenticated) {
        window.localStorage.setItem(
          authSessionHintKey,
          JSON.stringify({
            version: authSessionHintVersion,
            hasSessionCookie: true,
            lastAuthenticatedAt: new Date().toISOString(),
          }),
        );
      } else {
        window.localStorage.removeItem(authSessionHintKey);
      }
    },
    {
      analyticsConsentKey: ANALYTICS_CONSENT_STORAGE_KEY,
      onboardingCompletionKey: ONBOARDING_COMPLETION_STORAGE_KEY,
      onboardingCompletionValue: ONBOARDING_COMPLETION_VALUE,
      authSessionHintKey: AUTH_SESSION_HINT_STORAGE_KEY,
      authSessionHintVersion: AUTH_SESSION_HINT_VERSION,
      authenticated: session === SESSION_AUTHENTICATED,
    },
  );
  await prepPage.goto('about:blank', { waitUntil: 'load' });
  await prepPage.close().catch(() => undefined);
}

function scoreToPercent(score) {
  return typeof score === 'number' ? Math.round(score * 100) : null;
}

function readCategoryScore(lighthouseReport, categoryId) {
  return scoreToPercent(lighthouseReport.categories?.[categoryId]?.score);
}

function buildAuditUrl(route) {
  const auditUrl = new URL(route.path, baseUrl);
  auditUrl.searchParams.set('atlasQaSession', route.session);
  return auditUrl.toString();
}

function normalizeRoutePath(urlString) {
  try {
    const url = new URL(urlString);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return urlString;
  }
}

function isPassing(summary, route) {
  const meetsSeoTarget = route.skipSeoTarget
    ? typeof summary.seo === 'number'
    : typeof summary.seo === 'number' && summary.seo >= 90;

  return (
    !summary.error &&
    summary.redirectMatched &&
    typeof summary.performance === 'number' &&
    typeof summary.accessibility === 'number' &&
    typeof summary.bestPractices === 'number' &&
    meetsSeoTarget &&
    summary.performance >= 90 &&
    summary.accessibility >= 95 &&
    summary.bestPractices >= 95
  );
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function buildFailedResult(route, error, attemptBaseUrl = baseUrl) {
  const errorMessage = readErrorMessage(error);

  return {
    route: route.path,
    slug: route.slug,
    session: route.session,
    baseUrl: attemptBaseUrl,
    requestedPath: route.path,
    finalPath: 'n/a',
    redirectMatched: false,
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null,
    lcp: 'n/a',
    tbt: 'n/a',
    cls: 'n/a',
    speedIndex: 'n/a',
    error: errorMessage,
    passed: false,
  };
}

function isTransientRouteFailure(route, result) {
  const retryableErrorSnippets = [
    'Failed to fetch browser webSocket URL',
    'Target page, context or browser has been closed',
    'ERR_CONNECTION_REFUSED',
    'Detected unsettled top-level await',
    'Could not connect to a Chromium browser context',
    'Preview server did not become ready',
  ];

  if (result.error && retryableErrorSnippets.some((snippet) => result.error.includes(snippet))) {
    return true;
  }

  return route.session === SESSION_AUTHENTICATED && !result.redirectMatched;
}

async function primeRouteState(context, route) {
  const prepPage = typeof context.newPage === 'function'
    ? await context.newPage().catch(() => null)
    : null;

  if (!prepPage) {
    return;
  }

  const expectedUrl = buildAuditUrl(route);

  try {
    await prepPage.goto(expectedUrl, { waitUntil: 'domcontentloaded' });
    await delay(750);
  } catch {
    // The subsequent Lighthouse run captures route-level failures with fuller detail.
  } finally {
    await prepPage.close().catch(() => undefined);
  }
}

async function runLighthouseAudit(route) {
  const expectedUrl = buildAuditUrl(route);
  const reportPath = join(reportRoot, `${route.slug}.json`);
  const args = [
    '--yes',
    'lighthouse',
    expectedUrl,
    `--port=${chromeDebugPort}`,
    '--output=json',
    `--output-path=${reportPath}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet',
    '--disable-storage-reset',
    '--disable-full-page-screenshot',
  ];

  if (auditPreset === 'desktop') {
    args.push('--preset=desktop');
  }

  const { result } = spawnProcess(commandName('npx'), args, {
    pipeOutput: true,
    shell: process.platform === 'win32',
  });

  const commandResult = await result;

  if (commandResult.code !== 0) {
    throw new Error(`Lighthouse failed for ${route.path}: ${commandResult.stderr || commandResult.stdout}`);
  }

  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const finalPath = normalizeRoutePath(report.finalDisplayedUrl ?? report.finalUrl ?? expectedUrl);
  const requestedPath = normalizeRoutePath(expectedUrl);
  const summary = {
    route: route.path,
    slug: route.slug,
    session: route.session,
    baseUrl,
    requestedPath,
    finalPath,
    redirectMatched: requestedPath === finalPath,
    performance: readCategoryScore(report, 'performance'),
    accessibility: readCategoryScore(report, 'accessibility'),
    bestPractices: readCategoryScore(report, 'best-practices'),
    seo: readCategoryScore(report, 'seo'),
    lcp: report.audits?.['largest-contentful-paint']?.displayValue ?? 'n/a',
    tbt: report.audits?.['total-blocking-time']?.displayValue ?? 'n/a',
    cls: report.audits?.['cumulative-layout-shift']?.displayValue ?? 'n/a',
    speedIndex: report.audits?.['speed-index']?.displayValue ?? 'n/a',
    error: null,
    skipSeoTarget: Boolean(route.skipSeoTarget),
  };

  return {
    ...summary,
    passed: isPassing(summary, route),
  };
}

function buildMarkdownReport(results) {
  const generatedAt = new Date().toISOString();
  const failedRoutes = results.filter((result) => !result.passed);
  const passCount = results.length - failedRoutes.length;
  const uniqueBaseUrls = [...new Set(results.map((result) => result.baseUrl).filter(Boolean))];
  const baseUrlLabel = uniqueBaseUrls.length === 1 ? 'Base URL' : 'Base URLs';
  const summaryRows = results.map((result) => `| ${result.route} | ${result.session} | ${result.performance ?? 'n/a'} | ${result.accessibility ?? 'n/a'} | ${result.bestPractices ?? 'n/a'} | ${result.seo ?? 'n/a'}${result.skipSeoTarget ? ' (exempt)' : ''} | ${result.lcp} | ${result.tbt} | ${result.cls} | ${result.redirectMatched ? 'yes' : `no → ${result.finalPath}`} | ${result.error ?? '—'} | ${result.passed ? 'PASS' : 'FAIL'} |`);
  const failingList = failedRoutes.length
    ? failedRoutes.map((result) => `- ${result.route} [${result.session}]: Perf ${result.performance ?? 'n/a'}, A11y ${result.accessibility ?? 'n/a'}, BP ${result.bestPractices ?? 'n/a'}, SEO ${result.seo ?? 'n/a'}${result.skipSeoTarget ? ' (exempt)' : ''}, Redirect ${result.redirectMatched ? 'ok' : result.finalPath}${result.error ? `, Error ${result.error}` : ''}`).join('\n')
    : '- None';

  return [
    '# Lighthouse Audit Summary',
    '',
    `- Generated: ${generatedAt}`,
    `- Preset: ${auditPreset}`,
    `- ${baseUrlLabel}: ${uniqueBaseUrls.join(', ')}`,
    `- Routes audited: ${results.length}`,
    `- Passing routes: ${passCount}/${results.length}`,
    '',
    '## Targets',
    '',
    '- Performance > 90',
    '- Accessibility > 95',
    '- Best Practices > 95',
    '- SEO > 90 (except intentional noindex catch-all routes marked as exempt)',
    '- Final URL must match the requested route (no unintended redirect)',
    '',
    '## Route matrix',
    '',
    '| Route | Session | Perf | A11y | BP | SEO | LCP | TBT | CLS | Redirect OK | Error | Status |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |',
    ...summaryRows,
    '',
    '## Failing routes',
    '',
    failingList,
    '',
  ].join('\n');
}

async function stopProcess(runningProcess) {
  if (!runningProcess?.childProcess || runningProcess.childProcess.killed) {
    return;
  }

  runningProcess.childProcess.kill('SIGTERM');
  await Promise.race([
    runningProcess.result,
    delay(5_000),
  ]);

  if (!runningProcess.childProcess.killed) {
    runningProcess.childProcess.kill('SIGKILL');
  }
}

async function runRouteAudit(route) {
  let lastResult = buildFailedResult(route, new Error(`No Lighthouse attempt completed for ${route.path}.`));

  for (let attempt = 1; attempt <= routeAttempts; attempt += 1) {
    let previewProcess;
    let chromeProcess;
    let browserConnection;

    try {
      previewProcess = await startPreviewServer();
      chromeProcess = await startChromium();
      browserConnection = await connectBrowser();
      await seedSessionState(browserConnection.context, route.session);
      await primeRouteState(browserConnection.context, route);
      await delay(250);
      lastResult = await runLighthouseAudit(route);
    } catch (error) {
      console.error(error);
      lastResult = buildFailedResult(route, error, baseUrl);
    } finally {
      await browserConnection?.browser?.close().catch(() => undefined);
      await stopProcess(chromeProcess);
      await stopProcess(previewProcess);
      await delay(250);
      if (userDataDir) {
        await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
        userDataDir = '';
      }
    }

    if (!isTransientRouteFailure(route, lastResult) || attempt === routeAttempts) {
      return lastResult;
    }

    console.warn(
      `[retry ${attempt + 1}/${routeAttempts}] Retrying ${route.path} after transient Lighthouse/browser failure.`,
    );
    await delay(500);
  }

  return lastResult;
}

async function main() {
  await mkdir(reportRoot, { recursive: true });
  await buildAuditBundle();

  const selectedRoutes = routeFilter
    ? routes.filter((route) => route.slug.includes(routeFilter) || route.path.toLowerCase().includes(routeFilter))
    : routes;

  if (!selectedRoutes.length) {
    throw new Error(`No Lighthouse routes matched filter: ${routeFilter}`);
  }

  const results = [];

  for (const route of selectedRoutes) {
    console.log(`\n=== Lighthouse: ${route.path} [${route.session}] ===`);
    results.push(await runRouteAudit(route));
  }

  const markdownReport = buildMarkdownReport(results);
  await writeFile(join(reportRoot, 'SUMMARY.md'), markdownReport, 'utf8');
  await writeFile(join(reportRoot, 'summary.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('\n' + markdownReport);

  if (userDataDir) {
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
    userDataDir = '';
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
