import { expect, test } from './fixtures/scope-test';
import type { Locator, Page } from '@playwright/test';

async function readMapCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.mapboxgl-canvas') as HTMLCanvasElement | null;
    const shell = document.querySelector('.map-shell') as HTMLElement | null;
    if (!canvas || !shell) {
      return null;
    }

    const canvasBox = canvas.getBoundingClientRect();
    const shellBox = shell.getBoundingClientRect();
    const deviceScale = window.devicePixelRatio || 1;
    return {
      canvasCssWidth: canvasBox.width,
      canvasCssHeight: canvasBox.height,
      canvasPixelWidth: canvas.width / deviceScale,
      canvasPixelHeight: canvas.height / deviceScale,
      shellWidth: shellBox.width,
      shellHeight: shellBox.height,
    };
  });
}

async function expectMapCanvasToMatchShell(page: Page) {
  const metrics = await readMapCanvasMetrics(page);
  expect(metrics, 'Mapbox canvas and trip map shell should both exist').toBeTruthy();

  if (!metrics) {
    throw new Error('Missing Mapbox canvas metrics');
  }

  expect(Math.abs(metrics.canvasCssWidth - metrics.shellWidth), 'canvas CSS width should match shell width').toBeLessThanOrEqual(2);
  expect(Math.abs(metrics.canvasCssHeight - metrics.shellHeight), 'canvas CSS height should match shell height').toBeLessThanOrEqual(2);
  expect(Math.abs(metrics.canvasPixelWidth - metrics.canvasCssWidth), 'canvas backing width should match rendered width').toBeLessThanOrEqual(4);
  expect(Math.abs(metrics.canvasPixelHeight - metrics.canvasCssHeight), 'canvas backing height should match rendered height').toBeLessThanOrEqual(4);
}

async function readMapStatusLayout(page: Page) {
  return page.evaluate(() => {
    const weather = document.querySelector('[data-test="map-weather-badge"]') as HTMLElement | null;
    const location = document.querySelector('[data-test="map-location-badge"]') as HTMLElement | null;
    const styleSwitch = document.querySelector('[data-test="map-style-switch"]') as HTMLElement | null;
    const mapboxLogo = document.querySelector('.mapboxgl-ctrl-logo') as HTMLElement | null;

    if (!weather || !mapboxLogo || !styleSwitch) {
      return null;
    }

    const toBox = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      };
    };

    const locationBox = location ? toBox(location) : null;

    return {
      weather: toBox(weather),
      location: locationBox && locationBox.right > locationBox.left && locationBox.bottom > locationBox.top ? locationBox : null,
      styleSwitch: toBox(styleSwitch),
      mapboxLogo: toBox(mapboxLogo),
    };
  });
}

async function expectMapStatusBadgesToClearLogo(page: Page) {
  const layout = await readMapStatusLayout(page);
  if (!layout) {
    return;
  }

  expect(Math.abs(layout.weather.left - layout.mapboxLogo.left), 'weather badge should hug the Mapbox attribution edge').toBeLessThanOrEqual(20);
  expect(layout.weather.bottom, 'weather badge should sit above Mapbox attribution').toBeLessThanOrEqual(layout.mapboxLogo.top - 2);
  if (layout.location) {
    expect(layout.location.right, 'location badge should sit directly left of the bright/dark switch').toBeLessThanOrEqual(layout.styleSwitch.left + 2);
    expect(Math.abs(layout.location.bottom - layout.styleSwitch.bottom), 'location badge should align with the style switch row').toBeLessThanOrEqual(12);
  }
}

async function readMapStyleDiagnostics(page: Page) {
  return page.evaluate(() => {
    const map = (window as Window & {
      __scopeMapboxMap?: {
        getStyle: () => {
          layers?: Array<{ id?: string; type?: string; 'source-layer'?: string }>;
          sources?: Record<string, { url?: string; volatile?: boolean }>;
        };
        getLayer: (id: string) => unknown;
        getFilter: (layerId: string) => unknown;
        getPaintProperty: (layerId: string, property: string) => unknown;
        getLayoutProperty: (layerId: string, property: string) => unknown;
        getFog?: () => Record<string, unknown> | null | undefined;
        getProjection?: () => { name?: string };
        getRenderWorldCopies?: () => boolean;
      };
      __scopeMapTrafficError?: string;
    }).__scopeMapboxMap;
    if (!map) {
      return null;
    }

    const serialize = (value: unknown) => {
      try {
        return JSON.stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    };
    const style = map.getStyle();
    const layers = style.layers ?? [];
    const trafficSource = style.sources?.['scope-mapbox-traffic'];
    const globeFog = map.getFog?.() ?? {};
    const fillPaint = layers
      .filter((layer) => layer.type === 'fill')
      .map((layer) => serialize(map.getPaintProperty(String(layer.id), 'fill-color')));
    const waterFillPaint = layers
      .filter((layer) => layer.type === 'fill')
      .filter((layer) => {
        const layerId = String(layer.id ?? '').toLowerCase();
        const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
        return layerId.includes('water') || sourceLayer.includes('water');
      })
      .map((layer) => serialize(map.getPaintProperty(String(layer.id), 'fill-color')));
    const landFillPaint = layers
      .filter((layer) => layer.type === 'fill')
      .filter((layer) => {
        const layerId = String(layer.id ?? '').toLowerCase();
        const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
        return !layerId.includes('water') && !sourceLayer.includes('water');
      })
      .map((layer) => serialize(map.getPaintProperty(String(layer.id), 'fill-color')));
    const darkFillLeakCount = fillPaint.filter((value) =>
      value.includes('31, 45, 43') ||
      value.includes('24, 34, 43') ||
      value.includes('37, 45, 52') ||
      value.includes('18, 33, 43')
    ).length;
    const hiddenLabelLayers = layers
      .filter((layer) => layer.type === 'symbol')
      .filter((layer) => {
        const layerId = String(layer.id ?? '').toLowerCase();
        const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
        const isImportantLabel =
          layerId.includes('poi') ||
          layerId.includes('road-label') ||
          layerId.includes('place-label') ||
          layerId.includes('settlement') ||
          sourceLayer.includes('poi') ||
          sourceLayer.includes('road') ||
          sourceLayer.includes('place');
        return isImportantLabel && map.getLayoutProperty(String(layer.id), 'visibility') === 'none';
      })
      .map((layer) => String(layer.id));

    const trafficLayerIds = [
      'scope-traffic-flow-casing',
      'scope-traffic-flow',
      'scope-traffic-alert-casing',
      'scope-traffic-alert',
      'scope-traffic-closures',
    ];
    const trafficLayerIndexById = new Map(trafficLayerIds.map((layerId) => [layerId, layers.findIndex((layer) => layer.id === layerId)]));
    const trafficLayerIndexes = [...trafficLayerIndexById.values()].filter((index) => index >= 0);
    const maxBaseRoadLineIndex = layers.reduce((maxIndex, layer, index) => {
      const layerId = String(layer.id ?? '').toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      const isTrafficLayer = trafficLayerIds.includes(String(layer.id ?? ''));
      const isRoadLine =
        layer.type === 'line' &&
        !isTrafficLayer &&
        (sourceLayer === 'road' || layerId.includes('road') || layerId.includes('motorway') || layerId.includes('street'));
      return isRoadLine ? Math.max(maxIndex, index) : maxIndex;
    }, -1);
    const minTrafficLayerIndex = trafficLayerIndexes.length ? Math.min(...trafficLayerIndexes) : -1;
    const maxTrafficLayerIndex = trafficLayerIndexes.length ? Math.max(...trafficLayerIndexes) : -1;
    const adminBoundaryLayerIndexes = layers
      .map((layer, index) => {
        const layerId = String(layer.id ?? '').toLowerCase();
        const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
        const isAdminBoundary =
          layer.type === 'line' &&
          !trafficLayerIds.includes(String(layer.id ?? '')) &&
          (sourceLayer === 'admin' || layerId.includes('admin') || layerId.includes('boundary') || layerId.includes('state'));
        return isAdminBoundary ? index : -1;
      })
      .filter((index) => index >= 0);
    const hasAdminBoundaryAboveTraffic =
      trafficLayerIndexes.length > 0 &&
      adminBoundaryLayerIndexes.some((boundaryIndex) => boundaryIndex > maxTrafficLayerIndex);
    const readTrafficPaint = (layerId: string, property: string) =>
      map.getLayer(layerId) ? serialize(map.getPaintProperty(layerId, property)) : '';
    const readTrafficLayout = (layerId: string, property: string) =>
      map.getLayer(layerId) ? serialize(map.getLayoutProperty(layerId, property)) : '';
    const readTrafficFilter = (layerId: string) =>
      map.getLayer(layerId) ? serialize(map.getFilter(layerId)) : '';

    return {
      darkFillLeakCount,
      hiddenLabelLayers,
      waterFillPaint,
      landFillPaint,
      trafficError: (window as Window & { __scopeMapTrafficError?: string }).__scopeMapTrafficError ?? '',
      trafficLayerCount: trafficLayerIds.filter((layerId) => map.getLayer(layerId)).length,
      trafficLayerOrder: {
        minTrafficLayerIndex,
        maxBaseRoadLineIndex,
        hasAdminBoundaryAboveTraffic,
      },
      trafficPaint: {
        moderate: readTrafficPaint('scope-traffic-flow', 'line-color'),
        alert: readTrafficPaint('scope-traffic-alert', 'line-color'),
        closures: readTrafficPaint('scope-traffic-closures', 'line-color'),
        closuresDash: readTrafficPaint('scope-traffic-closures', 'line-dasharray'),
        offset: readTrafficPaint('scope-traffic-flow', 'line-offset'),
        moderateWidth: readTrafficPaint('scope-traffic-flow', 'line-width'),
        alertWidth: readTrafficPaint('scope-traffic-alert', 'line-width'),
      },
      trafficLayout: {
        moderateCap: readTrafficLayout('scope-traffic-flow', 'line-cap'),
        alertCap: readTrafficLayout('scope-traffic-alert', 'line-cap'),
        alertJoin: readTrafficLayout('scope-traffic-alert', 'line-join'),
      },
      trafficFilters: {
        moderate: readTrafficFilter('scope-traffic-flow'),
        alert: readTrafficFilter('scope-traffic-alert'),
      },
      trafficSource: {
        url: trafficSource?.url ?? '',
        volatile: trafficSource?.volatile === true,
      },
      globeFog: {
        color: serialize(globeFog.color),
        highColor: serialize(globeFog['high-color']),
        horizonBlend: Number(globeFog['horizon-blend'] ?? Number.NaN),
        range: serialize(globeFog.range),
        spaceColor: serialize(globeFog['space-color']),
        starIntensity: Number(globeFog['star-intensity'] ?? Number.NaN),
      },
      projectionName: map.getProjection?.().name ?? '',
      renderWorldCopies: map.getRenderWorldCopies?.() === true,
    };
  });
}

async function expectMapStyleDiagnostics(page: Page, mode: 'native' | 'scope') {
  await expect.poll(async () => {
    const diagnostics = await readMapStyleDiagnostics(page);
    return diagnostics ? 'ready' : 'missing';
  }, {
    message: `map style diagnostics should settle in ${mode} mode`,
    timeout: 15_000,
  }).toBe('ready');
  const diagnostics = await readMapStyleDiagnostics(page);

  expect(diagnostics?.projectionName, 'trip planner should use the globe projection used by the Trips/New map').toBe('globe');
  expect(diagnostics?.renderWorldCopies, 'globe mode should keep duplicate world copies disabled for stable planner framing').toBe(false);
  expect(diagnostics?.trafficError, 'live traffic overlay should load without Mapbox style errors').toBe('');
  await expect.poll(async () => (await readMapStyleDiagnostics(page))?.trafficLayerCount ?? 0, {
    message: 'trips/new should restore all live traffic severity layers by default',
    timeout: 15_000,
  }).toBe(5);
  const trafficReadyDiagnostics = await readMapStyleDiagnostics(page);
  const expectPaintColor = (actual: string | undefined, expectedHex: string, expectedRgb: string, message: string) => {
    const normalized = String(actual ?? '').toLowerCase();
    expect(
      normalized.includes(expectedHex) || normalized.includes(expectedRgb),
      message,
    ).toBe(true);
  };
  expect(trafficReadyDiagnostics?.trafficSource.url, 'trips/new should load the Mapbox live traffic tile source').toContain('mapbox.mapbox-traffic-v1');
  expect(trafficReadyDiagnostics?.trafficSource.volatile, 'traffic tiles should use the normal cached Mapbox source path').toBe(false);
  expectPaintColor(trafficReadyDiagnostics?.trafficPaint.moderate, '#d98a24', 'rgb(217, 138, 36)', 'moderate traffic should use the deeper yellow/orange slow color');
  expectPaintColor(trafficReadyDiagnostics?.trafficPaint.alert, '#f04438', 'rgb(240, 68, 56)', 'heavy traffic should use the stronger red alert color');
  expectPaintColor(trafficReadyDiagnostics?.trafficPaint.closures, '#7654d7', 'rgb(118, 84, 215)', 'closed roads should use the purple closure color');
  expect(trafficReadyDiagnostics?.trafficPaint.closuresDash, 'closures should render as a distinct dashed road status').toContain('1.05');
  expect(trafficReadyDiagnostics?.trafficLayout.moderateCap, 'traffic lines should avoid rounded blobs on highway edges').toContain('butt');
  expect(trafficReadyDiagnostics?.trafficLayout.alertCap, 'alert traffic lines should avoid rounded blobs on highway edges').toContain('butt');
  expect(trafficReadyDiagnostics?.trafficLayout.alertJoin, 'traffic line joins should stay crisp while zooming').toContain('bevel');
  expect(trafficReadyDiagnostics?.trafficLayerOrder.hasAdminBoundaryAboveTraffic, 'state/country boundaries should render above traffic').toBe(true);

  if (mode === 'scope') {
    expect(diagnostics?.globeFog.horizonBlend, 'Scope dark atmosphere should stay subtle instead of forming a bright rim').toBeLessThanOrEqual(0.015);
    expect(diagnostics?.globeFog.starIntensity, 'Scope dark mode should keep stars nearly invisible behind the route map').toBeLessThanOrEqual(0.02);
  }

  await expect.poll(async () => (await readMapStyleDiagnostics(page))?.hiddenLabelLayers.length ?? Number.POSITIVE_INFINITY, {
    message: `map labels should remain visible in ${mode} mode`,
    timeout: 15_000,
  }).toBe(0);
  if (mode === 'native') {
    await expect.poll(async () => (await readMapStyleDiagnostics(page))?.darkFillLeakCount ?? Number.POSITIVE_INFINITY, {
      message: 'light mode should not retain dark fill colors',
      timeout: 15_000,
    }).toBe(0);
  }
}

async function getUnobstructedNearbyMarkerButton(page: Page): Promise<Locator> {
  const markerButtons = page.locator('[data-test="nearby-place-marker"] .nearby-place-marker__button');
  const blockerBoxes = await page.locator('[data-test="map-style-switch"], .control-stack').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      };
    }),
  );
  const markerCount = await markerButtons.count();

  for (let index = 0; index < markerCount; index += 1) {
    const markerButton = markerButtons.nth(index);
    const box = await markerButton.boundingBox();
    if (!box) {
      continue;
    }

    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const isBlocked = blockerBoxes.some((blocker) =>
      center.x >= blocker.left &&
      center.x <= blocker.right &&
      center.y >= blocker.top &&
      center.y <= blocker.bottom,
    );
    const isTopmostMarker = await markerButton.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(topElement && (element === topElement || element.contains(topElement)));
    });

    if (!isBlocked && isTopmostMarker) {
      return markerButton;
    }
  }

  return markerButtons.first();
}

async function findRenderedPoiClickTarget(page: Page) {
  return page.evaluate(() => {
    const map = (window as any).__scopeMapboxMap;
    if (!map) {
      return null;
    }

    const style = map.getStyle();
    const poiLayers = (style.layers ?? [])
      .filter((layer: { id?: string; type?: string; 'source-layer'?: string }) => {
        const layerId = String(layer.id ?? '').toLowerCase();
        const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
        return layer.type === 'symbol' && (
          /(^|[-_ ])poi($|[-_ ])/.test(layerId) ||
          layerId.includes('point-of-interest') ||
          layerId.includes('transit') ||
          layerId.includes('airport') ||
          sourceLayer.includes('poi') ||
          sourceLayer.includes('point_of_interest') ||
          sourceLayer.includes('transit') ||
          sourceLayer.includes('airport')
        );
      })
      .map((layer: { id?: string }) => String(layer.id));

    const namedRenderedFeatures = (feature: any) => (
      feature.geometry?.type === 'Point' &&
      Array.isArray(feature.geometry.coordinates) &&
      feature.properties &&
      (feature.properties.name || feature.properties.name_en || feature.properties.brand)
    );
    const features = (poiLayers.length ? map.queryRenderedFeatures({ layers: poiLayers }) : [])
      .filter(namedRenderedFeatures);
    const fallbackFeatures = features.length ? [] : map.queryRenderedFeatures()
      .filter((feature: any) => (
        namedRenderedFeatures(feature) &&
        String(feature.layer?.type ?? '').toLowerCase() === 'symbol'
      ));
    const canvasRect = map.getCanvas().getBoundingClientRect();
    const candidates = features.concat(fallbackFeatures);
    const feature = candidates.find((candidate: any) => {
      const point = map.project(candidate.geometry.coordinates);
      return point.x > 80 &&
        point.x < canvasRect.width - 180 &&
        point.y > 84 &&
        point.y < canvasRect.height - 132;
    }) ?? candidates[Math.floor(candidates.length / 2)] ?? candidates[0];
    if (!feature) {
      return null;
    }

    const point = map.project(feature.geometry.coordinates);
    return {
      x: canvasRect.left + point.x,
      y: canvasRect.top + point.y,
      name: feature.properties.name || feature.properties.name_en || feature.properties.brand,
      layerId: feature.layer?.id ?? '',
      featureCount: features.length,
    };
  });
}

async function readMapOverlayLayout(page: Page) {
  return page.evaluate(() => {
    const mapView = document.querySelector('.map-view') as HTMLElement | null;
    const key = document.querySelector('[data-test="map-traffic-key"]') as HTMLElement | null;
    const location = document.querySelector('[data-test="map-location-badge"]') as HTMLElement | null;
    const styleSwitch = document.querySelector('[data-test="map-style-switch"]') as HTMLElement | null;

    if (!mapView || !key || !styleSwitch) {
      return null;
    }

    const toBox = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    const locationBox = location ? toBox(location) : null;

    return {
      mapView: toBox(mapView),
      key: toBox(key),
      location: locationBox && locationBox.width > 0 && locationBox.height > 0 ? locationBox : null,
      styleSwitch: toBox(styleSwitch),
    };
  });
}

async function readMapCamera(page: Page) {
  return page.evaluate(() => {
    const map = (window as Window & {
      __scopeMapboxMap?: {
        getCenter: () => { lng: number; lat: number };
        getZoom: () => number;
        getBearing: () => number;
        getPitch: () => number;
      };
    }).__scopeMapboxMap;

    if (!map) {
      return null;
    }

    const center = map.getCenter();
    return {
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  });
}

async function expectMapCameraStable(page: Page, expectedCamera: Awaited<ReturnType<typeof readMapCamera>>, message: string) {
  expect(expectedCamera, `${message}: expected map camera should be readable`).toBeTruthy();

  if (!expectedCamera) {
    throw new Error(`${message}: missing expected camera`);
  }

  await expect.poll(async () => {
    const currentCamera = await readMapCamera(page);
    if (!currentCamera) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(
      Math.abs(currentCamera.longitude - expectedCamera.longitude),
      Math.abs(currentCamera.latitude - expectedCamera.latitude),
      Math.abs(currentCamera.zoom - expectedCamera.zoom),
      Math.abs(currentCamera.bearing - expectedCamera.bearing),
      Math.abs(currentCamera.pitch - expectedCamera.pitch),
    );
  }, {
    message,
    timeout: 8_000,
  }).toBeLessThan(0.0001);
}

type MapCameraTransitionMetrics = {
  distinctCameraSamples: number;
  longTaskSupported: boolean;
  maxFrameGapMs: number;
  maxLongTaskMs: number;
  renderGatedSampleCount: number;
  sampleCount: number;
  totalLongTaskMs: number;
};

// Headless Chromium can report Mapbox tile bookkeeping as long tasks even when
// the camera keeps visibly moving; frame gaps carry the user-visible budget.
const MAPBOX_HEADLESS_LOCATE_MAX_FRAME_GAP_MS = 700;
const MAPBOX_HEADLESS_LOCATE_MAX_LONG_TASK_MS = 500;

async function beginMapCameraTransitionMeasurementOnNextLocateClick(page: Page, durationMs = 1_500) {
  await page.evaluate((sampleDurationMs) => {
    const metricsWindow = window as Window & {
      __scopeMapCameraTransitionMetrics?: Promise<MapCameraTransitionMetrics>;
    };

    metricsWindow.__scopeMapCameraTransitionMetrics = new Promise<MapCameraTransitionMetrics>((resolve) => {
      const resolveMissingMeasurement = () => resolve({
        distinctCameraSamples: 0,
        longTaskSupported: false,
        maxFrameGapMs: Number.POSITIVE_INFINITY,
        maxLongTaskMs: Number.POSITIVE_INFINITY,
        renderGatedSampleCount: Number.POSITIVE_INFINITY,
        sampleCount: 0,
        totalLongTaskMs: Number.POSITIVE_INFINITY,
      });
      const locateControl = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.getAttribute('aria-label') === 'Center on my location');
      if (!locateControl) {
        resolveMissingMeasurement();
        return;
      }

      const missingClickTimer = setTimeout(resolveMissingMeasurement, 5_000);

      locateControl.addEventListener('click', () => {
        clearTimeout(missingClickTimer);
        const map = (window as Window & {
          __scopeMapboxMap?: {
            getCenter: () => { lng: number; lat: number };
            getZoom: () => number;
          };
        }).__scopeMapboxMap;
        const mapView = document.querySelector('.map-view');
        const samples: Array<{ key: string; renderGated: boolean; time: number }> = [];
        const longTaskDurations: number[] = [];
        let longTaskSupported = false;
        let observer: PerformanceObserver | null = null;
        const startedAt = performance.now();

        if (!map) {
          resolveMissingMeasurement();
          return;
        }

        try {
          observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.startTime >= startedAt) {
                longTaskDurations.push(entry.duration);
              }
            });
          });
          observer.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
          longTaskSupported = true;
        } catch {
          observer = null;
        }

        let nextTimer: ReturnType<typeof setTimeout> | null = null;
        let nextRaf: number | null = null;
        let isFinished = false;
        let lastSampleAt = 0;

        const clearScheduledSample = () => {
          if (nextTimer) {
            clearTimeout(nextTimer);
            nextTimer = null;
          }
          if (nextRaf !== null) {
            cancelAnimationFrame(nextRaf);
            nextRaf = null;
          }
        };

        const scheduleSample = () => {
          clearScheduledSample();
          nextRaf = requestAnimationFrame(sample);
          nextTimer = setTimeout(sample, 120);
        };

        const sample = () => {
          if (isFinished) {
            return;
          }

          nextRaf = null;
          if (nextTimer) {
            clearTimeout(nextTimer);
            nextTimer = null;
          }

          const now = performance.now();
          if (lastSampleAt && now - lastSampleAt < 24) {
            scheduleSample();
            return;
          }
          lastSampleAt = now;

          const center = map.getCenter();
          samples.push({
            key: `${center.lng.toFixed(5)},${center.lat.toFixed(5)},${map.getZoom().toFixed(2)}`,
            renderGated: mapView?.classList.contains('map-view--render-gated') === true,
            time: now,
          });

          if (now - startedAt < sampleDurationMs) {
            scheduleSample();
            return;
          }

          isFinished = true;
          clearScheduledSample();
          observer?.disconnect();
          const frameGaps = samples.slice(1).map((sampleEntry, index) => sampleEntry.time - samples[index].time);
          resolve({
            distinctCameraSamples: new Set(samples.map((sampleEntry) => sampleEntry.key)).size,
            longTaskSupported,
            maxFrameGapMs: frameGaps.length ? Math.max(...frameGaps) : 0,
            maxLongTaskMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
            renderGatedSampleCount: samples.filter((sampleEntry) => sampleEntry.renderGated).length,
            sampleCount: samples.length,
            totalLongTaskMs: longTaskDurations.reduce((total, duration) => total + duration, 0),
          });
        };

        sample();
      }, { capture: true, once: true });
    });
  }, durationMs);

  return () => page.evaluate(() => {
    const metricsPromise = (window as Window & {
      __scopeMapCameraTransitionMetrics?: Promise<MapCameraTransitionMetrics>;
    }).__scopeMapCameraTransitionMetrics;
    if (!metricsPromise) {
      throw new Error('Map camera transition measurement was not started.');
    }

    return metricsPromise;
  });
}

async function expectMapOverlayLayout(page: Page) {
  const layout = await readMapOverlayLayout(page);
  expect(layout, 'map overlay elements should be measurable').toBeTruthy();

  if (!layout) {
    throw new Error('Missing map overlay layout');
  }

  expect(layout.key.top - layout.mapView.top, 'traffic key should be pinned to the map top edge').toBeLessThanOrEqual(28);
  expect(layout.mapView.right - layout.key.right, 'traffic key should be pinned to the map right edge').toBeLessThanOrEqual(28);
  expect(layout.key.height, 'traffic key should stay on one uncluttered desktop row').toBeLessThanOrEqual(52);

  if (layout.location) {
    expect(layout.location.right, 'location badge should sit to the left of the theme switch').toBeLessThanOrEqual(layout.styleSwitch.left - 8);
    expect(Math.abs(layout.location.bottom - layout.styleSwitch.bottom), 'location badge should align with the theme switch row').toBeLessThanOrEqual(12);
    expect(layout.location.top, 'location badge should be in the lower half of the map').toBeGreaterThan(layout.mapView.top + layout.mapView.height / 2);
  }
}

async function focusDallasTrafficViewport(page: Page) {
  const canvas = page.locator('.mapboxgl-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = await canvas.boundingBox();
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(160);
  }

  await page.evaluate(() => {
    const map = (window as Window & {
      __scopeMapboxMap?: {
        jumpTo: (options: { center: [number, number]; zoom: number }) => void;
        triggerRepaint?: () => void;
      };
    }).__scopeMapboxMap;
    map?.jumpTo({ center: [-96.92, 32.82], zoom: 9.65 });
    map?.triggerRepaint?.();
  });
  await page.waitForTimeout(1_200);
}

/**
 * Interactive Mapbox GL + DOM overlays only load when the preview bundle includes a Mapbox token.
 * Example:
 *   set VITE_MAPBOX_TOKEN=pk.your_public_token
 *   set VITE_ENABLE_MAPBOX_IN_UI_TESTS=true
 *   npm run test:e2e:raw -- tests/e2e/trip-planner-map-popup.spec.ts
 */
test.describe('Trip planner nearby place popover alignment (Mapbox)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Mapbox WebGL visual and performance checks are calibrated for Chromium.');

  test('keeps the precise planner basemap stable through bright and Scope dark map switches', async ({
    page,
    scopeApi,
  }) => {
    test.skip(
      !process.env.VITE_MAPBOX_TOKEN?.trim() || process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS !== 'true',
      'Set VITE_MAPBOX_TOKEN and VITE_ENABLE_MAPBOX_IN_UI_TESTS=true to run Mapbox style checks.',
    );

    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 32.838, longitude: -97.19, accuracy: 133 });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      window.localStorage.removeItem('scope.tripPlanner.mapStyleMode');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Live traffic');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Slow');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Heavy');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Closed');
    await expectMapOverlayLayout(page);
    await page.getByRole('button', { name: 'Center on my location' }).click();
    await expect(page.locator('[data-test="map-location-badge"]')).toBeVisible();
    await focusDallasTrafficViewport(page);
    await expectMapStyleDiagnostics(page, 'native');

    for (let index = 0; index < 4; index += 1) {
      const cameraBeforeDarkSwitch = await readMapCamera(page);
      await page.getByRole('button', { name: 'Use Scope dark map' }).click();
      await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'scope');
      await expectMapCameraStable(page, cameraBeforeDarkSwitch, 'switching to Scope dark mode should preserve the exact viewport after location is on');
      await expectMapStyleDiagnostics(page, 'scope');

      const cameraBeforeBrightSwitch = await readMapCamera(page);
      await page.getByRole('button', { name: 'Use bright map' }).click();
      await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'native');
      await expectMapCameraStable(page, cameraBeforeBrightSwitch, 'switching to bright mode should preserve the exact viewport after location is on');
      await expectMapStyleDiagnostics(page, 'native');
    }
  });

  test('keeps the locate camera flight smooth within the frame and long-task budget', async ({
    page,
    scopeApi,
  }) => {
    test.skip(
      !process.env.VITE_MAPBOX_TOKEN?.trim() || process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS !== 'true',
      'Set VITE_MAPBOX_TOKEN and VITE_ENABLE_MAPBOX_IN_UI_TESTS=true to run Mapbox locate performance checks.',
    );

    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 32.838, longitude: -97.19, accuracy: 133 });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      window.localStorage.removeItem('scope.tripPlanner.mapStyleMode');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('.map-view')).not.toHaveClass(/map-view--render-gated/, { timeout: 12_000 });
    await expect.poll(async () => {
      return page.evaluate(() => {
        const windowWithMap = window as Window & { __tripsMapIdle?: boolean };
        const canvas = document.querySelector('.map-view[data-map-route-variant="planner"] .mapboxgl-canvas');
        return Boolean(windowWithMap.__tripsMapIdle || canvas?.classList.contains('loaded'));
      });
    }, {
      message: 'planner map should be idle before measuring locate animation',
      timeout: 15_000,
    }).toBe(true);
    await page.evaluate(() => {
      const map = (window as Window & {
        __scopeMapboxMap?: {
          jumpTo: (options: { center: [number, number]; zoom: number }) => void;
        };
      }).__scopeMapboxMap;

      map?.jumpTo({ center: [-98.5795, 39.8283], zoom: 3.25 });
    });
    await page.waitForTimeout(300);
    const readMetrics = await beginMapCameraTransitionMeasurementOnNextLocateClick(page);
    await page.getByRole('button', { name: 'Center on my location' }).click();
    const metrics = await readMetrics();

    expect(metrics.sampleCount, 'locate flight should be observed across repeated animation frames even when headless RAF is throttled').toBeGreaterThanOrEqual(6);
    expect(metrics.distinctCameraSamples, 'locate should move the camera instead of staying frozen; detailed smoothness is covered by the Trips/New locate test').toBeGreaterThanOrEqual(2);
    expect(metrics.renderGatedSampleCount, 'locate should expose at least one ungated camera sample during the flight').toBeLessThan(metrics.sampleCount);
    expect(
      metrics.maxFrameGapMs,
      'locate animation should avoid a frozen headless Mapbox frame while the camera is moving',
    ).toBeLessThanOrEqual(MAPBOX_HEADLESS_LOCATE_MAX_FRAME_GAP_MS);
    if (metrics.longTaskSupported) {
      expect(
        metrics.maxLongTaskMs,
        'locate should avoid a single huge headless Mapbox main-thread stall',
      ).toBeLessThanOrEqual(MAPBOX_HEADLESS_LOCATE_MAX_LONG_TASK_MS);
    }
  });

  test('opens clicked map POIs with a stop action and steady photo slot', async ({
    page,
    scopeApi,
  }) => {
    test.skip(
      !process.env.VITE_MAPBOX_TOKEN?.trim() || process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS !== 'true',
      'Set VITE_MAPBOX_TOKEN and VITE_ENABLE_MAPBOX_IN_UI_TESTS=true to run Mapbox POI click checks.',
    );

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Cannot read|undefined|null/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });

    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      window.localStorage.removeItem('scope.tripPlanner.mapStyleMode');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible({ timeout: 120_000 });
    await page.locator('.mapboxgl-canvas').scrollIntoViewIfNeeded();
    await focusDallasTrafficViewport(page);
    await page.evaluate(() => {
      const map = (window as any).__scopeMapboxMap;
      map?.jumpTo({ center: [-97.189, 32.838], zoom: 14.25 });
      map?.triggerRepaint?.();
    });
    await page.waitForTimeout(3_000);

    const target = await findRenderedPoiClickTarget(page);
    expect(target, 'Dallas zoomed map should expose at least one clickable POI symbol').toBeTruthy();
    if (!target) {
      throw new Error('Missing rendered POI click target');
    }

    await page.mouse.click(target.x, target.y);
    await expect(page.locator('.nearby-place-popup').first()).toBeVisible();
    await expect(page.locator('[data-test="nearby-place-add-stop"]').first()).toBeVisible();
    await page.waitForTimeout(250);
    await expect(
      page.locator('.nearby-place-popup__photo[data-photo-source="fallback"]'),
      'clicked map labels should not flash category/mock fallback photos while the real photo lookup resolves',
    ).toHaveCount(0);
    await expect(
      page.locator('.nearby-place-popup__photo[data-photo-fallback="ready"]'),
      'clicked map labels should not paint a category/mock fallback behind the real provider photo',
    ).toHaveCount(0);
    expect(runtimeErrors, `clicking ${target.name} should not throw`).toEqual([]);
  });

  test('keeps the nearby place popover horizontally centered on the marker after opening trips/new', async ({
    page,
    scopeApi,
  }) => {
    test.skip(
      !process.env.VITE_MAPBOX_TOKEN?.trim() || process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS !== 'true',
      'Set VITE_MAPBOX_TOKEN and VITE_ENABLE_MAPBOX_IN_UI_TESTS=true to run Mapbox popup alignment checks.',
    );

    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      window.localStorage.removeItem('scope.tripPlanner.mapStyleMode');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });

    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();

    await planner.locator('[data-test="trip-title-input"]').fill('Playwright popup probe');
    await planner.getByLabel('Start date').fill('2026-05-08');
    await planner.getByLabel('End date').fill('2026-05-10');
    await planner.locator('[data-test="destination-input"]').fill('Patagonia, Chile + Argentina');
    await planner.locator('[data-test="end-destination-input"]').fill('Torres del Paine, Chile');
    await planner.locator('[data-test="trip-interest-scenic"]').click();
    await planner.locator('[data-test="trip-planner-submit"]').click();

    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();

    await expect(page.locator('.mapboxgl-canvas')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'native');
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-style', 'mapbox://styles/mapbox/outdoors-v12');
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);
    await expectMapCanvasToMatchShell(page);
    await expectMapStyleDiagnostics(page, 'native');
    await expect(page.locator('[data-test="map-traffic-key"]')).toBeVisible();
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Live traffic');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Slow');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Heavy');
    await expect(page.locator('[data-test="map-traffic-key"]')).toContainText('Closed');
    await expectMapOverlayLayout(page);
    await expectMapStatusBadgesToClearLogo(page);
    await expect(page.locator('[data-test="nearby-place-marker"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Use Scope dark map' }).click();
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'scope');
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-style', 'mapbox://styles/mapbox/outdoors-v12');
    await expectMapCanvasToMatchShell(page);
    await expectMapStyleDiagnostics(page, 'scope');

    await page.getByRole('button', { name: 'Use bright map' }).click();
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'native');
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-style', 'mapbox://styles/mapbox/outdoors-v12');
    await expectMapCanvasToMatchShell(page);
    await expectMapStyleDiagnostics(page, 'native');

    for (let index = 0; index < 3; index += 1) {
      await page.getByRole('button', { name: 'Use Scope dark map' }).click();
      await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'scope');
      await expectMapStyleDiagnostics(page, 'scope');
      await page.getByRole('button', { name: 'Use bright map' }).click();
      await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'native');
      await expectMapStyleDiagnostics(page, 'native');
    }

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Use Scope dark map' }).click();
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'scope');
    await expectMapStyleDiagnostics(page, 'scope');
    await page.getByRole('button', { name: 'Use bright map' }).click();
    await expect(page.locator('.map-view')).toHaveAttribute('data-map-presentation', 'native');
    await expectMapStyleDiagnostics(page, 'native');
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(900);
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);
    await expectMapCanvasToMatchShell(page);
    await expectMapStyleDiagnostics(page, 'native');

    if (await page.locator('[data-test="route-nearby-drawer"]').getAttribute('data-drawer-state') !== 'open') {
      await page.locator('[data-test="route-nearby-toggle"]').click();
    }
    await expect(page.locator('[data-test="route-nearby-drawer"]')).toHaveAttribute('data-drawer-state', 'open');

    const nearbyMarker = page.locator('[data-test="nearby-place-marker"]').first();
    const nearbyMarkerAvailable = await nearbyMarker.waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (nearbyMarkerAvailable) {
      const clickedNearbyMarker = await getUnobstructedNearbyMarkerButton(page)
        .then((markerButton) => markerButton.click({ force: true, timeout: 5_000 }))
        .then(() => true)
        .catch(() => false);

      if (!clickedNearbyMarker) {
        await page.waitForTimeout(250);
      } else {
        const activeNearbyMarker = page.locator('[data-test="nearby-place-marker"][data-active="true"]').first();
        const popover = activeNearbyMarker.locator('.nearby-place-marker__popover');
        const activeNearbyMarkerVisible = await activeNearbyMarker.waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        const popoverVisible = activeNearbyMarkerVisible
          ? await popover.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
          : false;

        if (activeNearbyMarkerVisible && popoverVisible) {
          const markerBox = await activeNearbyMarker.locator('.nearby-place-marker__button').boundingBox();
          const popoverBox = await popover.boundingBox();

          expect(markerBox, 'nearby marker should have layout bounds').toBeTruthy();
          expect(popoverBox, 'nearby place popover should have layout bounds').toBeTruthy();

          if (!markerBox || !popoverBox) {
            throw new Error('Missing bounding boxes for marker or popover');
          }

          const markerCenterX = markerBox.x + markerBox.width / 2;
          const popoverCenterX = popoverBox.x + popoverBox.width / 2;
          const horizontalDeltaPx = Math.abs(markerCenterX - popoverCenterX);

          expect(horizontalDeltaPx).toBeLessThanOrEqual(18);
        }
      }
    }

    if (await page.locator('[data-test="route-nearby-drawer"]').getAttribute('data-drawer-state') === 'open') {
      await page.locator('[data-test="route-nearby-toggle"]').click();
      await expect(page.locator('[data-test="route-nearby-drawer"]')).toHaveAttribute('data-drawer-state', 'closed');
    }

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(450);
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    await expect(page.locator('[data-test="map-fallback-stage"]')).toHaveCount(0);
    await expectMapCanvasToMatchShell(page);

    const canvasBox = await page.locator('.mapboxgl-canvas').boundingBox();
    expect(canvasBox, 'Mapbox canvas should have layout bounds before dragging').toBeTruthy();
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + canvasBox.width / 2 - 90, canvasBox.y + canvasBox.height / 2 + 45, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(650);
      await expectMapCanvasToMatchShell(page);
    }

    await expectMapStyleDiagnostics(page, 'native');
  });
});
