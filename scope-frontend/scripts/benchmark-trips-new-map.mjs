import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const explicitTargetUrl = Boolean(process.env.SCOPE_TRIPS_MAP_BENCHMARK_URL?.trim());
const targetUrl = process.env.SCOPE_TRIPS_MAP_BENCHMARK_URL ||
  'http://127.0.0.1:4174/trips/new?scopeQaSession=authenticated';
const runs = Math.max(1, Number(process.env.SCOPE_TRIPS_MAP_BENCHMARK_RUNS || 4));

function readBudget(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const budgets = {
  maxAverageLoadedAtMs: readBudget('SCOPE_TRIPS_MAP_BENCHMARK_MAX_AVG_LOADED_MS', 15000),
  maxAverageLocateP95FrameMs: readBudget('SCOPE_TRIPS_MAP_BENCHMARK_MAX_AVG_LOCATE_P95_FRAME_MS', 650),
  maxAverageLocateVerySlowFrames: readBudget('SCOPE_TRIPS_MAP_BENCHMARK_MAX_AVG_LOCATE_VERY_SLOW_FRAMES', 12),
  maxAverageLocateLongTasks: readBudget('SCOPE_TRIPS_MAP_BENCHMARK_MAX_AVG_LOCATE_LONG_TASKS', 15),
};

function wait(ms) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}

async function waitForPreviewServer(url, childProcess, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  childProcess.once('exit', () => {
    exited = true;
  });

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error('Vite preview server exited before the benchmark page was reachable.');
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Preview is still starting.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function startPreviewServer() {
  const viteCliPath = resolve(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const previewUrl = new URL(targetUrl);
  const previewProcess = spawn(process.execPath, [
    viteCliPath,
    'preview',
    '--host',
    previewUrl.hostname,
    '--port',
    previewUrl.port || '4174',
    '--strictPort',
  ], {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  await waitForPreviewServer(targetUrl, previewProcess);
  return previewProcess;
}

function stopPreviewServer(previewProcess) {
  if (!previewProcess || previewProcess.killed) {
    return;
  }

  previewProcess.kill('SIGTERM');
}

async function waitForGone(page, selector, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count === 0) {
      return Date.now() - started;
    }
    await page.waitForTimeout(16);
  }

  return null;
}

function mean(results, readValue) {
  return Math.round(results.reduce((sum, row) => sum + (readValue(row) ?? 0), 0) / results.length);
}

async function runOnce(index) {
  const theme = index % 2 === 0 ? 'dark' : 'light';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1688, height: 930 },
    geolocation: { latitude: 32.838, longitude: -97.19, accuracy: 25 },
    permissions: ['geolocation'],
    colorScheme: theme,
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__scopeBench = { longTasks: [] };
    try {
      new PerformanceObserver((list) => {
        window.__scopeBench.longTasks.push(...list.getEntries().map((entry) => ({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        })));
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long task timings are best-effort in older browsers.
    }
  });

  const startedAt = Date.now();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.map-view').scrollIntoViewIfNeeded({ timeout: 15000 });
  const mapVisibleAt = Date.now() - startedAt;
  await page.waitForSelector('.mapboxgl-canvas', { timeout: 15000 });
  const canvasAt = Date.now() - startedAt;
  await page.waitForFunction(
    () => document.querySelector('.mapboxgl-canvas')?.classList.contains('is-previewing'),
    null,
    { timeout: 15000 },
  );
  const previewAt = Date.now() - startedAt;
  await page.waitForFunction(
    () => document.querySelector('.mapboxgl-canvas')?.classList.contains('loaded'),
    null,
    { timeout: 15000 },
  );
  const loadedAt = Date.now() - startedAt;
  const overlayGoneAfterLoaded = await waitForGone(page, '.map-planner-preload-surface', 8000);
  const overlayGoneAt = overlayGoneAfterLoaded === null ? null : Date.now() - startedAt;

  await page.waitForFunction(
    () => document.querySelector('[data-test="map-location-badge"]')?.textContent?.includes('Location on'),
    null,
    { timeout: 5000 },
  ).catch(() => undefined);

  const locate = page.getByRole('button', { name: 'Center on my location' });
  await locate.waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => {
    window.__scopeBench.locateFrames = [];
    window.__scopeBench.locateStart = performance.now();
    let last = performance.now();
    let active = true;
    window.__scopeBench.stopLocateFrames = () => {
      active = false;
    };
    function tick(now) {
      if (!active) {
        return;
      }
      window.__scopeBench.locateFrames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  await locate.click();
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__scopeBench.stopLocateFrames?.());

  const locateResult = await page.evaluate(() => {
    const frames = window.__scopeBench.locateFrames || [];
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] : 0;
    const locateTasks = (window.__scopeBench.longTasks || [])
      .filter((task) => task.startTime >= window.__scopeBench.locateStart);
    return {
      frames: frames.length,
      maxFrameMs: frames.length ? Math.max(...frames) : 0,
      p95FrameMs: p95,
      p99FrameMs: p99,
      slowFrames: frames.filter((frame) => frame > 33).length,
      verySlowFrames: frames.filter((frame) => frame > 50).length,
      longTasksAfterLocate: locateTasks.length,
      longTaskMsAfterLocate: locateTasks.reduce((sum, task) => sum + task.duration, 0),
    };
  });

  const longTasks = await page.evaluate(() => window.__scopeBench.longTasks || []);
  await browser.close();

  return {
    run: index + 1,
    theme,
    mapVisibleAt,
    canvasAt,
    previewAt,
    loadedAt,
    overlayGoneAt,
    overlayAfterLoadedMs: overlayGoneAfterLoaded,
    locate: locateResult,
    longTasksCount: longTasks.length,
    longTasksTotalMs: Math.round(longTasks.reduce((sum, task) => sum + task.duration, 0)),
  };
}

let previewProcess = null;
try {
  if (!explicitTargetUrl) {
    previewProcess = await startPreviewServer();
  }

  const results = [];
  for (let index = 0; index < runs; index += 1) {
    results.push(await runOnce(index));
  }

  const averages = {
    mapVisibleAt: mean(results, (row) => row.mapVisibleAt),
    canvasAt: mean(results, (row) => row.canvasAt),
    previewAt: mean(results, (row) => row.previewAt),
    loadedAt: mean(results, (row) => row.loadedAt),
    overlayGoneAt: mean(results, (row) => row.overlayGoneAt),
    longTasksCount: mean(results, (row) => row.longTasksCount),
    longTasksTotalMs: mean(results, (row) => row.longTasksTotalMs),
    locateMaxFrameMs: mean(results, (row) => row.locate.maxFrameMs),
    locateP95FrameMs: mean(results, (row) => row.locate.p95FrameMs),
    locateP99FrameMs: mean(results, (row) => row.locate.p99FrameMs),
    locateSlowFrames: mean(results, (row) => row.locate.slowFrames),
    locateVerySlowFrames: mean(results, (row) => row.locate.verySlowFrames),
    locateLongTasks: mean(results, (row) => row.locate.longTasksAfterLocate),
    locateLongTaskMs: mean(results, (row) => row.locate.longTaskMsAfterLocate),
  };
  const budgetFailures = [
    averages.loadedAt > budgets.maxAverageLoadedAtMs
      ? `average loadedAt ${averages.loadedAt}ms exceeded ${budgets.maxAverageLoadedAtMs}ms`
      : null,
    averages.locateP95FrameMs > budgets.maxAverageLocateP95FrameMs
      ? `average locate p95 frame ${averages.locateP95FrameMs}ms exceeded ${budgets.maxAverageLocateP95FrameMs}ms`
      : null,
    averages.locateVerySlowFrames > budgets.maxAverageLocateVerySlowFrames
      ? `average locate very-slow frames ${averages.locateVerySlowFrames} exceeded ${budgets.maxAverageLocateVerySlowFrames}`
      : null,
    averages.locateLongTasks > budgets.maxAverageLocateLongTasks
      ? `average locate long tasks ${averages.locateLongTasks} exceeded ${budgets.maxAverageLocateLongTasks}`
      : null,
  ].filter(Boolean);

  console.log(JSON.stringify({
    url: targetUrl,
    runs,
    budgets,
    status: budgetFailures.length ? 'failed' : 'passed',
    averages,
    results,
  }, null, 2));

  if (budgetFailures.length) {
    console.error(budgetFailures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  stopPreviewServer(previewProcess);
}
