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
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h2, h3')).find((el) => /trending destinations/i.test(el.textContent ?? ''));
    if (heading) heading.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/spotcards.png`, fullPage: false });

  // Measure alignment of body-pill "V" to the vibe pill "M" per card
  const metrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.spot-card'));
    return cards.map((card) => {
      const pill = card.querySelector('.body-pill');
      const cta = card.querySelector('.cta-link');
      const starIcon = card.querySelector('.rating-pill__star');
      const ratingPill = card.querySelector('.rating-pill');
      const p = pill?.getBoundingClientRect();
      const c = cta?.getBoundingClientRect();
      const pillPad = pill ? getComputedStyle(pill).paddingLeft : null;
      const ctaPad = cta ? getComputedStyle(cta).paddingLeft : null;
      return {
        pillLeft: p?.left,
        ctaLeft: c?.left,
        delta: (p && c) ? c.left - p.left : null,
        pillPad,
        ctaPad,
        hasStar: !!starIcon,
        starSize: starIcon ? { w: starIcon.getBoundingClientRect().width, h: starIcon.getBoundingClientRect().height } : null,
        ratingPillText: ratingPill?.textContent?.trim(),
      };
    });
  });
  console.log('Spot card metrics:');
  for (const m of metrics) console.log(JSON.stringify(m));

  await page.close();
  await context.close();
} finally {
  await browser.close();
}
