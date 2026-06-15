import { BASE, OUT, createSnapContext, launchSnapBrowser } from './snap-runtime.mjs';

const browser = await launchSnapBrowser();
try {
  const context = await createSnapContext(browser);
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const panel = await page.$('.hero-panel');
  const actions = await page.$('.hero-actions');
  const tour = await page.$('.hero-tour-link');
  const panelBox = await panel.boundingBox();
  const actionsBox = await actions.boundingBox();
  const tourBox = await tour.boundingBox();
  const panelCenter = panelBox.x + panelBox.width / 2;
  const actionsCenter = actionsBox.x + actionsBox.width / 2;
  const tourCenter = tourBox.x + tourBox.width / 2;
  console.log('panel center:   ', panelCenter.toFixed(2));
  console.log('actions center: ', actionsCenter.toFixed(2), 'Δ', (actionsCenter - panelCenter).toFixed(2));
  console.log('tour center:    ', tourCenter.toFixed(2), 'Δ', (tourCenter - panelCenter).toFixed(2));
  await page.screenshot({ path: `${OUT}/hero_center.png`, fullPage: false, clip: { x: panelBox.x - 20, y: panelBox.y - 10, width: panelBox.width + 40, height: panelBox.height + 40 } });
  await page.close();
  await context.close();
} finally {
  await browser.close();
}
