import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

const browser = await launchSnapBrowser();
try {
  const context = await createSnapContext(browser);
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
