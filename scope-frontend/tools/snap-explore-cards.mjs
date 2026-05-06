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
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = document.querySelector('.results-masonry');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/explore_cards.png`, fullPage: false });
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
