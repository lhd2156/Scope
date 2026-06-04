import { expect, test } from './fixtures/scope-test';
import type { Page } from '@playwright/test';

type ScreenshotBuffer = {
  toString: (encoding: 'base64') => string;
};

interface ScopeApi {
  seedSession: (page: Page, overrides?: { email?: string }) => Promise<unknown>;
}

interface MapCenter {
  lng: number;
  lat: number;
}

const mapboxRequiredMessage = 'Set VITE_MAPBOX_TOKEN and VITE_ENABLE_MAPBOX_IN_UI_TESTS=true to run trips/new Mapbox UX checks.';
const austin = { latitude: 30.2672, longitude: -97.7431, accuracy: 25 };

function skipIfMapboxUnavailable(): void {
  test.skip(
    !process.env.VITE_MAPBOX_TOKEN?.trim() || process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS !== 'true',
    mapboxRequiredMessage,
  );
}

async function prepareTripsNew(page: Page, scopeApi: ScopeApi): Promise<void> {
  await scopeApi.seedSession(page, { email: 'louis@example.com' });
  await page.addInitScript(() => {
    window.localStorage.setItem('scope-analytics-consent', 'denied');
    window.localStorage.removeItem('scope.tripPlanner.mapStyleMode');
  });
}

async function openTripsNew(page: Page, scopeApi: ScopeApi): Promise<void> {
  await prepareTripsNew(page, scopeApi);
  await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.map-view[data-map-route-variant="planner"]')).toBeVisible({ timeout: 120_000 });
}

async function waitForTripsMapIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(
    (window as Window & { __tripsMapIdle?: boolean }).__tripsMapIdle ||
    document.querySelector('.map-view[data-map-route-variant="planner"] .mapboxgl-canvas.loaded'),
  ), undefined, {
    timeout: 8_000,
  });
}

async function readMapCenter(page: Page): Promise<MapCenter> {
  return page.evaluate(() => {
    const map = (window as Window & {
      __tripsMap?: {
        getCenter: () => { lng: number; lat: number };
      };
    }).__tripsMap;
    if (!map) {
      throw new Error('Trips map is not exposed.');
    }

    const center = map.getCenter();
    return { lng: center.lng, lat: center.lat };
  });
}

async function readMapZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (window as Window & {
      __tripsMap?: {
        getZoom: () => number;
      };
    }).__tripsMap;
    if (!map) {
      throw new Error('Trips map is not exposed.');
    }

    return map.getZoom();
  });
}

async function readMapProjectionName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const map = (window as Window & {
      __tripsMap?: {
        getProjection?: () => { name?: string };
      };
    }).__tripsMap;
    if (!map?.getProjection) {
      throw new Error('Trips map projection is not exposed.');
    }

    return map.getProjection().name ?? '';
  });
}

async function readRouteLayerState(page: Page): Promise<{ line: boolean; outline: boolean; source: boolean; overlay: boolean }> {
  return page.evaluate(() => {
    const map = (window as Window & {
      __tripsMap?: {
        getLayer?: (id: string) => unknown;
        getSource?: (id: string) => unknown;
      };
    }).__tripsMap;

    const hasLayer = (id: string) => {
      try {
        return Boolean(map?.getLayer?.(id));
      } catch {
        return false;
      }
    };
    const hasSource = (id: string) => {
      try {
        return Boolean(map?.getSource?.(id));
      } catch {
        return false;
      }
    };

    return {
      line: hasLayer('scope-route-line'),
      outline: hasLayer('scope-route-outline'),
      source: hasSource('scope-route-source'),
      overlay: Boolean(document.querySelector('.map-live-route-overlay path')),
    };
  });
}

function visibleMapPickButton(page: Page, testId: string) {
  return page.locator(`[data-test="${testId}"]`).filter({ visible: true }).first();
}

async function pickTwoRoutePoints(page: Page): Promise<void> {
  const mapCanvas = page.locator('.map-view[data-map-route-variant="planner"] .mapboxgl-canvas');
  await mapCanvas.scrollIntoViewIfNeeded();
  const box = await mapCanvas.boundingBox();
  expect(box, 'trip map canvas should have a bounding box before picking route points').toBeTruthy();
  if (!box) {
    return;
  }

  await visibleMapPickButton(page, 'map-pick-start').click();
  await mapCanvas.click({ position: { x: box.width * 0.42, y: box.height * 0.58 } });
  await expect(visibleMapPickButton(page, 'map-pick-end')).toHaveAttribute('aria-pressed', 'true', { timeout: 12_000 });
  await mapCanvas.click({ position: { x: box.width * 0.58, y: box.height * 0.42 } });
  await expect(page.locator('[data-test="route-sequence-list"] .route-sequence-chip')).toHaveCount(2, { timeout: 20_000 });
}

async function screenshotMapClip(page: Page): Promise<Buffer> {
  const mapContainer = page.locator('.map-view[data-map-route-variant="planner"]');
  const box = await mapContainer.boundingBox();
  if (!box) {
    throw new Error('Trips map container is not visible.');
  }

  const metrics = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const x = Math.max(0, box.x + metrics.scrollX);
  const y = Math.max(0, box.y + metrics.scrollY);
  const right = Math.min(metrics.documentWidth, x + box.width);
  const bottom = Math.min(metrics.documentHeight, y + box.height);
  if (right <= x || bottom <= y) {
    throw new Error('Trips map container is outside the screenshot page.');
  }

  return page.screenshot({
    fullPage: true,
    clip: {
      x,
      y,
      width: right - x,
      height: bottom - y,
    },
  });
}

function centersAreEqual(left: MapCenter, right: MapCenter): boolean {
  return Math.abs(left.lng - right.lng) < 0.000001 && Math.abs(left.lat - right.lat) < 0.000001;
}

async function readWhitePixelRatio(page: Page, screenshot: ScreenshotBuffer): Promise<number> {
  const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
  return page.evaluate(async (url) => {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode map screenshot.'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not create screenshot canvas.');
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let whitePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      if (alpha > 240 && red > 248 && green > 248 && blue > 248) {
        whitePixels += 1;
      }
    }

    return whitePixels / Math.max(1, pixels.length / 4);
  }, dataUrl);
}

async function readAverageLuminance(page: Page, screenshot: ScreenshotBuffer): Promise<number> {
  const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
  return page.evaluate(async (url) => {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode map screenshot.'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not create screenshot canvas.');
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let luminance = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      luminance += ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
    }

    return luminance / Math.max(1, pixels.length / 4);
  }, dataUrl);
}

test.describe('Trips new map UX', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Mapbox WebGL visual and performance checks are calibrated for Chromium.');

  test('T1 - no white flash on load', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await prepareTripsNew(page, scopeApi);
    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const mapContainer = page.locator('.map-view[data-map-route-variant="planner"]');
    await expect(mapContainer).toBeVisible({ timeout: 120_000 });
    await page.waitForFunction(() => Boolean(
      document.querySelector('.map-planner-preload-surface') ||
      document.querySelector('.mapboxgl-canvas.loaded'),
    ), undefined, { timeout: 8_000 });

    await page.waitForTimeout(60);
    const preloadSurface = page.locator('.map-planner-preload-surface');
    const preloadSurfaceVisible = await preloadSurface.isVisible();
    const preloadSurfaceOpacity = preloadSurfaceVisible
      ? await preloadSurface.evaluate((element) => Number.parseFloat(window.getComputedStyle(element).opacity || '0')).catch(() => 0)
      : 0;
    const screenshotInitial = await screenshotMapClip(page);
    await test.info().attach('map-initial-cover', { body: screenshotInitial, contentType: 'image/png' });
    if (preloadSurfaceVisible && preloadSurfaceOpacity > 0.85) {
      const initialCoverLuminance = await readAverageLuminance(page, screenshotInitial);
      expect(initialCoverLuminance, 'initial planner load cover should not expose a white page flash').toBeLessThan(0.82);
      expect(initialCoverLuminance, 'initial planner load cover should stay map-like instead of a dead black shell').toBeGreaterThan(0.12);
    }

    await page.waitForTimeout(200);
    const screenshot200 = await screenshotMapClip(page);
    await test.info().attach('map-200ms', { body: screenshot200, contentType: 'image/png' });
    await page.waitForTimeout(400);
    const screenshot600 = await screenshotMapClip(page);
    await test.info().attach('map-600ms', { body: screenshot600, contentType: 'image/png' });
    await waitForTripsMapIdle(page);
    const screenshotIdle = await screenshotMapClip(page);
    await test.info().attach('map-idle', { body: screenshotIdle, contentType: 'image/png' });

    const whitePixelRatio = await readWhitePixelRatio(page, screenshot200);
    expect(whitePixelRatio).toBeLessThan(0.5);
  });

  test('T2 - location button flies smoothly', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation(austin);
    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    await page.evaluate(() => {
      const map = (window as Window & {
        __tripsMap?: {
          jumpTo: (options: { center: [number, number]; zoom: number }) => void;
        };
      }).__tripsMap;

      map?.jumpTo({ center: [-98.5795, 39.8283], zoom: 3.25 });
    });
    await page.waitForTimeout(120);

    const locateButton = page.getByRole('button', { name: /my location|location/i }).first();
    await locateButton.click();
    const center0 = await readMapCenter(page);
    await page.waitForTimeout(500);
    const center500 = await readMapCenter(page);
    await page.waitForTimeout(500);
    const center1000 = await readMapCenter(page);
    await page.waitForTimeout(600);
    const center1600 = await readMapCenter(page);
    await page.waitForTimeout(800);
    const center2400 = await readMapCenter(page);
    const distanceToAustin = (center: MapCenter) =>
      Math.abs(center.lat - austin.latitude) + Math.abs(center.lng - austin.longitude);

    expect(centersAreEqual(center500, center0), 'location camera should start moving by 500ms').toBe(false);
    expect(Number.isFinite(center1000.lng) && Number.isFinite(center1000.lat), 'location camera should be readable at 1000ms').toBe(true);
    expect(distanceToAustin(center1000), 'location camera should keep moving toward the mocked location').toBeLessThanOrEqual(distanceToAustin(center500));
    expect(distanceToAustin(center1600), 'location camera should not drift away after the first second').toBeLessThanOrEqual(distanceToAustin(center1000));
    expect(Math.abs(center2400.lat - austin.latitude), 'location camera should arrive near mocked latitude').toBeLessThanOrEqual(0.01);
    expect(Math.abs(center2400.lng - austin.longitude), 'location camera should arrive near mocked longitude').toBeLessThanOrEqual(0.01);
  });

  test('T3 - drag is smooth', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    const warnings: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (
        message.type() === 'warning' &&
        /performance|slow frame|dropped/i.test(text) &&
        !/GPU stall due to ReadPixels/i.test(text)
      ) {
        warnings.push(text);
      }
    });

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);
    const mapContainer = page.locator('.map-view[data-map-route-variant="planner"]');
    await mapContainer.scrollIntoViewIfNeeded();
    const box = await mapContainer.boundingBox();
    expect(box, 'trip map should have a bounding box before dragging').toBeTruthy();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 16 });
    await page.mouse.up();

    expect(warnings).toEqual([]);
  });

  test('T4 - console clean', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /mapbox|webgl|tile|GL|canvas/i.test(message.text())) {
        errors.push(message.text());
      }
    });

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    expect(errors).toEqual([]);
  });

  test('T5 - planner map uses globe projection', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    await page.locator('.map-view[data-map-route-variant="planner"]').scrollIntoViewIfNeeded();
    await expect.poll(() => readMapProjectionName(page), { timeout: 8_000 }).toBe('globe');
  });

  test('T6 - pointer entering map does not redraw by switching projection', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    const mapContainer = page.locator('.map-view[data-map-route-variant="planner"]');
    await mapContainer.scrollIntoViewIfNeeded();
    const box = await mapContainer.boundingBox();
    expect(box, 'trip map should have a bounding box before pointer smoke').toBeTruthy();
    if (!box) {
      return;
    }

    await expect.poll(() => readMapProjectionName(page), { timeout: 8_000 }).toBe('globe');
    await page.mouse.move(Math.max(1, box.x - 8), box.y + box.height / 2);
    await page.waitForTimeout(160);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(160);
    const screenshot160 = await screenshotMapClip(page);
    await page.waitForTimeout(640);
    const screenshot800 = await screenshotMapClip(page);

    await expect.poll(() => readMapProjectionName(page), { timeout: 2_000 }).toBe('globe');
    await expect(readWhitePixelRatio(page, screenshot160), 'pointer-enter frame at 160ms should not be mostly white').resolves.toBeLessThan(0.5);
    await expect(readWhitePixelRatio(page, screenshot800), 'pointer-enter frame at 800ms should not be mostly white').resolves.toBeLessThan(0.5);
  });

  test('T7 - zoom does not white flash', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    const zoomInButton = page.getByRole('button', { name: /zoom in/i }).first();
    await zoomInButton.click();
    await page.waitForTimeout(120);
    const screenshot120 = await screenshotMapClip(page);
    await page.waitForTimeout(360);
    const screenshot480 = await screenshotMapClip(page);
    await waitForTripsMapIdle(page);

    await expect(readWhitePixelRatio(page, screenshot120), 'zoom frame at 120ms should not be mostly white').resolves.toBeLessThan(0.5);
    await expect(readWhitePixelRatio(page, screenshot480), 'zoom frame at 480ms should not be mostly white').resolves.toBeLessThan(0.5);
  });

  test('T8 - visual regression', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    await expect(page.locator('.map-view[data-map-route-variant="planner"]')).toHaveScreenshot('trips-new-map.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('T9 - reset does not white flash', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    const zoomInButton = page.getByRole('button', { name: /zoom in/i }).first();
    await zoomInButton.click();
    await page.waitForTimeout(420);
    await zoomInButton.click();
    await page.waitForTimeout(420);

    const resetButton = page.getByRole('button', { name: /reset map/i }).first();
    await resetButton.click();
    await page.waitForTimeout(120);
    const screenshot120 = await screenshotMapClip(page);
    await page.waitForTimeout(380);
    const screenshot500 = await screenshotMapClip(page);

    await expect(readWhitePixelRatio(page, screenshot120), 'reset frame at 120ms should not be mostly white').resolves.toBeLessThan(0.5);
    await expect(readWhitePixelRatio(page, screenshot500), 'reset frame at 500ms should not be mostly white').resolves.toBeLessThan(0.5);
  });

  test('T9b - reset after selected start returns to base map', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    const mapCanvas = page.locator('.map-view[data-map-route-variant="planner"] .mapboxgl-canvas');
    await mapCanvas.scrollIntoViewIfNeeded();
    const box = await mapCanvas.boundingBox();
    expect(box, 'trip map canvas should have a bounding box before selecting start').toBeTruthy();
    if (!box) {
      return;
    }

    await visibleMapPickButton(page, 'map-pick-start').click();
    await mapCanvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    await expect.poll(() => readMapZoom(page), { timeout: 12_000 }).toBeGreaterThanOrEqual(6.9);
    await expect.poll(() => readMapZoom(page), { timeout: 12_000 }).toBeLessThanOrEqual(7.5);

    await page.getByRole('button', { name: /reset map/i }).first().click();
    await expect.poll(() => readMapZoom(page), { timeout: 12_000 }).toBeLessThanOrEqual(3.45);
    await page.waitForTimeout(900);
    expect(await readMapZoom(page)).toBeLessThanOrEqual(3.45);
  });

  test('T9c - removing route endpoints from the route canvas clears the map path', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);
    await pickTwoRoutePoints(page);

    const routeRemoveButtons = page.locator('[data-test="route-sequence-list"] button');
    await routeRemoveButtons.first().click();
    await expect.poll(() => readRouteLayerState(page), { timeout: 12_000 }).toMatchObject({
      line: false,
      outline: false,
      source: false,
      overlay: false,
    });

    if (await routeRemoveButtons.count()) {
      await routeRemoveButtons.first().click();
    }
    await expect(page.locator('[data-test="route-sequence-list"] .route-sequence-chip')).toHaveCount(0, { timeout: 12_000 });
  });

  test('T9d - hovered route marker labels can remove points from the map', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);
    await pickTwoRoutePoints(page);

    const routeMarker = page.locator('.mapboxgl-marker .spot-marker--sequence').first();
    await routeMarker.hover();
    await routeMarker.locator('[data-test="map-route-point-remove"]').click();

    await expect.poll(() => readRouteLayerState(page), { timeout: 12_000 }).toMatchObject({
      line: false,
      outline: false,
      source: false,
      overlay: false,
    });
  });

  test('T10 - locate does not white flash', async ({ page, scopeApi }) => {
    skipIfMapboxUnavailable();

    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation(austin);
    await openTripsNew(page, scopeApi);
    await waitForTripsMapIdle(page);

    const locateButton = page.getByRole('button', { name: /my location|location/i }).first();
    await locateButton.click();
    await page.waitForTimeout(120);
    const screenshot120 = await screenshotMapClip(page);
    await page.waitForTimeout(380);
    const screenshot500 = await screenshotMapClip(page);

    await expect(readWhitePixelRatio(page, screenshot120), 'location frame at 120ms should not be mostly white').resolves.toBeLessThan(0.5);
    await expect(readWhitePixelRatio(page, screenshot500), 'location frame at 500ms should not be mostly white').resolves.toBeLessThan(0.5);
  });
});
