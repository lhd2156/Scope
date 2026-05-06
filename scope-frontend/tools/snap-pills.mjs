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

  // Capture the quick filter grid specifically
  const grid = await page.$('.quick-filter-grid');
  if (grid) {
    await grid.screenshot({ path: `${OUT}/pills_grid.png` });
  }

  // Measure each pill height
  const heights = await page.$$eval('.quick-filter-chip', (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: el.textContent?.trim() ?? '',
        active: el.classList.contains('active'),
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        top: Math.round(r.top * 100) / 100,
      };
    })
  );
  console.log(JSON.stringify(heights, null, 2));

  await page.screenshot({ path: `${OUT}/pills_fullpage.png` });
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
