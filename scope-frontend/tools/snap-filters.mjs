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
  await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const group = await page.$('.quick-filter-grid');
  if (group) {
    await group.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await group.boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/explore_filters.png`, clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(1440, box.width + 40), height: box.height + 40 } });
  }
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
