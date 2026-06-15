import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

const browser = await launchSnapBrowser();
try {
  const context = await createSnapContext(browser);
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
