import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

const browser = await launchSnapBrowser();
try {
  const context = await createSnapContext(browser);
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
