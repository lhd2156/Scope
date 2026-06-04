import { expect, test } from './fixtures/scope-test';

test.describe('Scope trip planner flow', () => {
  test('keeps the route copilot in the itinerary area and leaves the route builder roomy', async ({ page, scopeApi }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="trip-planner"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-ai-assist"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-ai-suggestion"]')).toHaveCount(3);
    await expect(page.locator('[data-test="trip-ai-form"]')).toBeVisible();

    const layout = await page.evaluate(() => {
      const planner = document.querySelector('[data-test="trip-planner"]');
      const coreBrief = document.querySelector('[data-test="planner-core-brief-card"]');
      const itinerarySlot = document.querySelector('[data-test="itinerary-ai-slot"]');
      const panel = document.querySelector('[data-test="trip-ai-assist"]');
      const composer = document.querySelector('[data-test="trip-ai-form"]');
      const map = document.querySelector('.map-view[data-map-route-variant="planner"]');
      const suggestions = Array.from(document.querySelectorAll('[data-test="trip-ai-suggestion"]'));
      const plannerRect = planner?.getBoundingClientRect();
      const coreBriefRect = coreBrief?.getBoundingClientRect();
      const mapRect = map?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();

      return {
        scrollY: window.scrollY,
        inItinerarySlot: panel ? itinerarySlot?.contains(panel) ?? false : false,
        routeBuilderTitleCount: planner?.querySelectorAll('.planner-header h2').length ?? 0,
        coreBriefTopOffset: plannerRect && coreBriefRect ? coreBriefRect.top - plannerRect.top : Number.NaN,
        plannerWidth: plannerRect?.width ?? 0,
        mapWidth: mapRect?.width ?? 0,
        panelHeight: panelRect?.height ?? 0,
        panelLeft: panelRect?.left ?? Number.NaN,
        mapLeft: mapRect?.left ?? Number.NaN,
        composerBottom: composerRect?.bottom ?? Number.NaN,
        panelBottom: panelRect?.bottom ?? Number.NaN,
        suggestionCount: suggestions.length,
      };
    });

    expect(layout.scrollY).toBe(0);
    expect(layout.inItinerarySlot).toBe(true);
    expect(layout.routeBuilderTitleCount).toBe(0);
    expect(layout.coreBriefTopOffset).toBeLessThan(76);
    expect(layout.suggestionCount).toBe(3);
    expect(layout.plannerWidth).toBeGreaterThanOrEqual(340);
    expect(layout.mapWidth).toBeGreaterThanOrEqual(620);
    expect(layout.panelHeight).toBeGreaterThan(760);
    expect(layout.panelLeft).toBeGreaterThanOrEqual(layout.mapLeft - 1);
    expect(Math.abs(layout.panelBottom - layout.composerBottom)).toBeLessThanOrEqual(96);
  });

  test('keeps the route copilot build prompt in-place without reloading the page', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      const loadCountKey = 'scope-e2e-trip-planner-load-count';
      const currentLoadCount = Number(window.sessionStorage.getItem(loadCountKey) ?? '0');
      window.sessionStorage.setItem(loadCountKey, String(currentLoadCount + 1));
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();

    await planner.locator('[data-test="trip-title-input"]').fill('No reload route');
    await planner.getByLabel('Start date').fill('2026-05-08');
    await planner.getByLabel('End date').fill('2026-05-10');
    await planner.locator('[data-test="destination-input"]').fill('Oklahoma City, Oklahoma');
    await planner.locator('[data-test="end-destination-input"]').fill('Dexter, New Mexico');
    await planner.locator('[data-test="trip-interest-scenic"]').click();

    const urlBeforeBuild = page.url();
    const loadCountBeforeBuild = await page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'));
    const firstBuildPrompt = page.locator('[data-test="trip-ai-suggestion"]').filter({ hasText: 'Build the itinerary from Oklahoma City, Oklahoma to Dexter, New Mexico' });
    await expect(firstBuildPrompt).toHaveCount(1);
    await firstBuildPrompt.click();

    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();
    await expect(page.locator('[data-test="trip-ai-response"]')).toContainText('route builder, map preview, and copilot are synced now');

    expect(page.url()).toBe(urlBeforeBuild);
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'))).toBe(loadCountBeforeBuild);
  });

  test('suggests endpoint choices from a rural start prompt before setting the final destination', async ({ page, scopeApi }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
      const loadCountKey = 'scope-e2e-trip-planner-load-count';
      const currentLoadCount = Number(window.sessionStorage.getItem(loadCountKey) ?? '0');
      window.sessionStorage.setItem(loadCountKey, String(currentLoadCount + 1));
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    const assistant = page.locator('[data-test="trip-ai-assist"]');
    await expect(planner).toBeVisible();
    await expect(assistant).toBeVisible();

    const urlBeforeAsk = page.url();
    const loadCountBeforeAsk = await page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'));
    await page.locator('[data-test="trip-ai-input"]').fill('Help me choose an end point from E1500 Road, Hollis');
    await page.locator('[data-test="trip-ai-form"]').locator('button[type="submit"]').click();

    const placeResults = page.locator('[data-test="trip-ai-place-results"]');
    await expect(placeResults).toContainText(/Endpoint ideas from (E1500 Road|Hollis, Oklahoma 73571)/);
    await expect(placeResults).toContainText('Quartz Mountain State Park');
    await expect(placeResults.locator('[data-test="trip-ai-place-add"]').first()).toHaveText('Use as final destination');
    await expect(planner.locator('[data-test="destination-input"]')).toHaveValue(/E1500 Road, Hollis|Hollis, Oklahoma 73571(?:, United States)?/);
    await expect(planner.locator('[data-test="end-destination-input"]')).toHaveValue('');

    await placeResults.locator('[data-test="trip-ai-place-add"]').first().click();

    await expect(planner.locator('[data-test="destination-input"]')).toHaveValue(/E1500 Road, Hollis|Hollis, Oklahoma 73571(?:, United States)?/);
    await expect(planner.locator('[data-test="end-destination-input"]')).toHaveValue(/Quartz Mountain State Park|14722 Highway 44A/);
    expect(page.url()).toBe(urlBeforeAsk);
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('scope-e2e-trip-planner-load-count'))).toBe(loadCountBeforeAsk);

    const layout = await page.evaluate(() => {
      const itinerarySlot = document.querySelector('[data-test="itinerary-ai-slot"]');
      const panel = document.querySelector('[data-test="trip-ai-assist"]');
      const composer = document.querySelector('[data-test="trip-ai-form"]');
      const map = document.querySelector('.map-view[data-map-route-variant="planner"]');
      const panelRect = panel?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();
      const mapRect = map?.getBoundingClientRect();

      return {
        inItinerarySlot: panel ? itinerarySlot?.contains(panel) ?? false : false,
        panelHeight: panelRect?.height ?? 0,
        panelLeft: panelRect?.left ?? 0,
        mapLeft: mapRect?.left ?? 0,
        composerVisible: Boolean(
          composerRect &&
          panelRect &&
          composerRect.bottom <= panelRect.bottom + 1 &&
          composerRect.top >= panelRect.top - 1
        ),
      };
    });

    expect(layout.inItinerarySlot).toBe(true);
    expect(layout.panelHeight).toBeGreaterThan(500);
    expect(layout.panelLeft).toBeGreaterThanOrEqual(layout.mapLeft - 1);
    expect(layout.composerVisible).toBe(true);
  });

  test('applies max budget and end date chat commands without stale replies', async ({ page, scopeApi }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    const chatInput = page.locator('[data-test="trip-ai-input"]');
    const chatSubmit = page.locator('[data-test="trip-ai-form"]').locator('button[type="submit"]');

    await expect(planner).toBeVisible();
    await planner.getByLabel('Start date').fill('2026-05-17');

    await chatInput.fill('Set max budget to $400');
    await chatSubmit.click();

    await expect(page.locator('[data-test="trip-ai-response"]').last()).toContainText(/Set the max trip budget to \$400/);
    await expect(planner.locator('[data-test="budget-floor-input"]')).toHaveValue('400');
    await expect(planner.locator('[data-test="budget-ceiling-input"]')).toHaveValue('400');

    await chatInput.fill('END DATE MAYBE 5/18?');
    await chatSubmit.click();

    const latestResponse = page.locator('[data-test="trip-ai-response"]').last();
    await expect(latestResponse).toContainText('Set the trip end date to 2026-05-18.');
    await expect(latestResponse).not.toContainText('Set the travel party to 2 travelers.');
    await expect(planner.getByLabel('End date')).toHaveValue('2026-05-18');
  });

  test('creates a trip brief, adds destinations, generates an AI itinerary, and renders the packed timeline', async ({ page, scopeApi }) => {
    await scopeApi.seedSession(page, { email: 'louis@example.com' });
    await page.addInitScript(() => {
      window.localStorage.setItem('scope-analytics-consent', 'denied');
    });

    await page.goto('/trips/new', { waitUntil: 'domcontentloaded' });
    const planner = page.locator('[data-test="trip-planner"]');
    await expect(planner).toBeVisible();
    await expect(planner.locator('[data-test="planner-core-brief-card"]')).toBeVisible();
    await expect(planner.locator('.planner-header h2')).toHaveCount(0);
    await expect(page.locator('[data-test="itinerary-planning-card"]')).toBeVisible();

    await planner.locator('[data-test="trip-title-input"]').fill('Playwright Patagonia Sprint');
    await expect(planner.locator('[data-test="trip-title-input"]')).toHaveValue('Playwright Patagonia Sprint');
    await planner.getByLabel('Start date').fill('2026-05-08');
    await planner.getByLabel('End date').fill('2026-05-10');
    await expect(planner.locator('input[type="range"]')).toHaveCount(0);
    await planner.locator('[data-test="budget-floor-input"]').fill('125');
    await planner.locator('[data-test="budget-ceiling-input"]').fill('7200');
    await planner.locator('[data-test="destination-input"]').fill('Patagonia, Chile + Argentina');
    await planner.locator('[data-test="end-destination-input"]').fill('Torres del Paine, Chile');

    await planner.locator('[data-test="trip-pace-packed"]').click();
    await planner.locator('[data-test="trip-interest-adventure"]').click();
    await planner.locator('[data-test="trip-interest-nature"]').click();
    await planner.locator('[data-test="trip-interest-scenic"]').click();
    await planner.locator('[data-test="trip-planner-submit"]').click();

    const timelineOverlay = page.locator('[data-test="itinerary-timeline-overlay"]');

    await expect(page.locator('[data-test="itinerary-summary-card"]')).toBeVisible();
    await expect(page.locator('[data-test="itinerary-summary-stops"]')).toContainText('5 stops');
    await expect(page.locator('[data-test="itinerary-day-card"]')).toHaveCount(3);
    await expect(timelineOverlay).toContainText('Mount Fitz Roy');
    await expect(timelineOverlay).toContainText('Torres del Paine');
    await expect(timelineOverlay).toContainText('Day 1');
    await expect(timelineOverlay).toContainText('Day 2');
    await expect(timelineOverlay).toContainText('Day 3');

    const builtLayout = await page.evaluate(() => {
      const timeline = document.querySelector('[data-test="itinerary-timeline-overlay"]');
      const itinerarySlot = document.querySelector('[data-test="itinerary-ai-slot"]');
      const assistant = document.querySelector('[data-test="trip-ai-assist"]');
      const timelineRect = timeline?.getBoundingClientRect();
      const assistantRect = assistant?.getBoundingClientRect();

      return {
        assistantClass: assistant?.className ?? '',
        assistantHeight: assistantRect?.height ?? Number.NaN,
        inItinerarySlot: assistant ? itinerarySlot?.contains(assistant) ?? false : false,
        timelineBottom: timelineRect?.bottom ?? Number.NaN,
        timelineLeft: timelineRect?.left ?? Number.NaN,
        timelineWidth: timelineRect?.width ?? Number.NaN,
        assistantTop: assistantRect?.top ?? Number.NaN,
        assistantLeft: assistantRect?.left ?? Number.NaN,
        assistantWidth: assistantRect?.width ?? Number.NaN,
      };
    });

    expect(builtLayout.inItinerarySlot).toBe(true);
    expect(builtLayout.assistantClass).toContain('planner-workspace__assistant--with-days');
    expect(builtLayout.assistantHeight).toBeGreaterThan(520);
    expect(builtLayout.assistantTop).toBeGreaterThanOrEqual(builtLayout.timelineBottom - 1);
    expect(Math.abs(builtLayout.assistantLeft - builtLayout.timelineLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(builtLayout.assistantWidth - builtLayout.timelineWidth)).toBeLessThanOrEqual(2);
  });
});
