import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

const viewports = [
  ['full', { width: 1440, height: 900 }],
  ['half', { width: 720, height: 900 }],
];

const browser = await launchSnapBrowser();
try {
  for (const [vName, viewport] of viewports) {
    const context = await createSnapContext(browser, { viewport });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.warn('goto timed out:', e.message);
    }
    await page.waitForTimeout(1500);
    // Scroll to the Activity Feed section
    await page.evaluate(() => {
      const el = document.querySelector('[data-onboarding-target="activity-feed-list"]');
      el?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${vName}_feed.png`, fullPage: false });
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('done');
