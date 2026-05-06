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

  // Scroll to feed
  await page.evaluate(() => {
    const el = document.querySelector('[data-onboarding-target="activity-feed-list"], .feed-grid');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/fix_feed.png`, fullPage: false });

  // Measure Create account button text centering
  const createAcctMetrics = await page.evaluate(() => {
    const btn = document.querySelector('.guest-navbar__accent-link');
    const label = document.querySelector('.guest-navbar__accent-label');
    if (!btn || !label) return null;
    const b = btn.getBoundingClientRect();
    const l = label.getBoundingClientRect();
    return {
      btnCenterX: b.left + b.width / 2,
      labelCenterX: l.left + l.width / 2,
      delta: (l.left + l.width / 2) - (b.left + b.width / 2),
    };
  });
  console.log('Create account centering:', createAcctMetrics);

  // Scroll to top and capture hero with hover on replay
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const tourLink = await page.$('.hero-tour-link');
  if (tourLink) {
    await tourLink.hover();
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const btn = document.querySelector('.hero-tour-link');
      const label = document.querySelector('.hero-tour-link__label');
      if (!btn || !label) return null;
      const b = btn.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      return {
        btnCenterX: b.left + b.width / 2,
        labelCenterX: l.left + l.width / 2,
        delta: (l.left + l.width / 2) - (b.left + b.width / 2),
        btnBounds: { l: b.left, r: b.right, w: b.width },
      };
    });
    console.log('Replay tour hover centering:', metrics);
    await page.screenshot({ path: `${OUT}/fix_hero_hover.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 600 } });
  }

  await page.close();
  await context.close();
} finally {
  await browser.close();
}
