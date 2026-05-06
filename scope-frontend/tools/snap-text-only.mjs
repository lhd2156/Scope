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
  await page.waitForTimeout(1000);

  const nav = await page.$('.guest-navbar__accent-link');
  if (nav) {
    const box = await nav.boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/text_create_account.png`, clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 20), width: box.width + 80, height: box.height + 40 } });
    const text = await nav.innerText();
    console.log('Nav button text:', JSON.stringify(text));
  }

  const tour = await page.$('.hero-tour-link');
  if (tour) {
    await tour.hover();
    await page.waitForTimeout(300);
    const box = await tour.boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/text_tour.png`, clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 30), width: box.width + 120, height: box.height + 60 } });
    const text = await tour.innerText();
    console.log('Tour button text:', JSON.stringify(text));
  }

  await page.close();
  await context.close();
} finally {
  await browser.close();
}
