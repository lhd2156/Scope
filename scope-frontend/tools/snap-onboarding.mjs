import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.SNAP_BASE ?? 'http://localhost:8088';
const OUT = 'snaps';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Force onboarding to show by clearing any completion flag
  await context.addInitScript(() => {
    try {
      localStorage.removeItem('scope-onboarding-completed-v1');
      localStorage.setItem('scope-analytics-consent', 'granted');
      localStorage.setItem('scope-cookie-consent', 'dismissed');
    } catch {}
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE ERR:', msg.text());
  });
  page.on('requestfailed', (req) => console.log('REQ FAIL:', req.url(), req.failure()?.errorText));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if onboarding overlay is visible
  const visible = await page.$('.onboarding-overlay__card');
  console.log('onboarding visible:', Boolean(visible));
  if (visible) {
    const box = await visible.boundingBox();
    console.log('card box:', box);
  }

  // Probe whether icons render (check for shadow use resolution)
  const iconsOk = await page.evaluate(() => {
    const cards = document.querySelectorAll('.onboarding-overlay__highlight-card');
    return Array.from(cards).map((card) => {
      const useEl = card.querySelector('use');
      const box = useEl?.getBoundingClientRect();
      return {
        href: useEl?.getAttribute('href'),
        w: box?.width,
        h: box?.height,
      };
    });
  });
  console.log('icon probes:', JSON.stringify(iconsOk, null, 2));

  await page.screenshot({ path: `${OUT}/onboarding.png`, fullPage: false });
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
