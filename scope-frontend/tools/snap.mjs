import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.SNAP_BASE ?? 'http://localhost:8088';
const OUT = 'snaps';
const routes = [
  ['home', '/'],
  ['explore', '/explore'],
  ['map', '/map'],
  ['planner', '/trips/new?scopeQaSession=authenticated'],
];
const viewports = [
  ['full', { width: 1440, height: 900 }],
  ['half', { width: 720, height: 900 }],
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [vName, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('scope-onboarding-completed-v1', 'completed');
        localStorage.setItem('scope-analytics-consent', 'granted');
        localStorage.setItem('scope-cookie-consent', 'dismissed');
      } catch {}
    });
    for (const [rName, path] of routes) {
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (e) {
        console.warn(`goto ${path} timed out; continuing`, e.message);
      }
      if (path === '/map') await page.waitForTimeout(9000);
      else await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/${vName}_${rName}.png`, fullPage: false });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('done');
