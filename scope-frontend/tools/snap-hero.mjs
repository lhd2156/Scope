import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.SNAP_BASE ?? 'http://localhost:8088';
const OUT = 'snaps';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('scope-onboarding-completed-v1', 'completed');
      localStorage.setItem('scope-analytics-consent', 'granted');
      localStorage.setItem('scope-cookie-consent', 'dismissed');
    } catch {}
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const panel = await page.$('.hero-panel');
  const actions = await page.$('.hero-actions');
  const tour = await page.$('.hero-tour-link');
  const panelBox = await panel.boundingBox();
  const actionsBox = await actions.boundingBox();
  const tourBox = await tour.boundingBox();
  const panelCenter = panelBox.x + panelBox.width / 2;
  const actionsCenter = actionsBox.x + actionsBox.width / 2;
  const tourCenter = tourBox.x + tourBox.width / 2;
  console.log('panel center:   ', panelCenter.toFixed(2));
  console.log('actions center: ', actionsCenter.toFixed(2), 'Δ', (actionsCenter - panelCenter).toFixed(2));
  console.log('tour center:    ', tourCenter.toFixed(2), 'Δ', (tourCenter - panelCenter).toFixed(2));
  await page.screenshot({ path: `${OUT}/hero_center.png`, fullPage: false, clip: { x: panelBox.x - 20, y: panelBox.y - 10, width: panelBox.width + 40, height: panelBox.height + 40 } });
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
