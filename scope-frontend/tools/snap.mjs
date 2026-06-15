import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

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

const browser = await launchSnapBrowser();
try {
  for (const [vName, viewport] of viewports) {
    const context = await createSnapContext(browser, { viewport });
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
