import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(import.meta.dirname, '..', '..', relativePath), 'utf8');
}

describe('iOS safe-area and touch audit', () => {
  it('configures viewport-fit=cover and shared shell safe-area tokens for the app shell', () => {
    const indexHtml = readSource('index.html');
    const baseCss = readSource('src/assets/base.css');
    const tripPlannerPage = readSource('src/views/TripPlannerPage.vue');

    expect(indexHtml).toContain('viewport-fit=cover');
    expect(baseCss).toContain('--safe-area-top: env(safe-area-inset-top, 0px);');
    expect(baseCss).toContain('--safe-area-right: env(safe-area-inset-right, 0px);');
    expect(baseCss).toContain('--safe-area-bottom: env(safe-area-inset-bottom, 0px);');
    expect(baseCss).toContain('--safe-area-left: env(safe-area-inset-left, 0px);');
    expect(baseCss).toContain('--shell-content-top: calc(var(--shell-content-top-base) + var(--safe-area-top));');
    expect(baseCss).toContain('--shell-content-bottom: calc(var(--shell-content-bottom-base) + var(--safe-area-bottom));');
    expect(baseCss).toContain('max-width: var(--shell-max-width-with-safe-area);');
    expect(baseCss).toContain('padding-top: var(--shell-content-top);');
    expect(baseCss).toContain('min-height: 100dvh;');
    expect(tripPlannerPage).toContain('var(--safe-area-left)');
    expect(tripPlannerPage).toContain('var(--safe-area-right)');
  });

  it('applies safe-area offsets and touch-action rules to mobile interaction surfaces', () => {
    const baseCss = readSource('src/assets/base.css');
    const navbar = readSource('src/components/common/Navbar.vue');
    const mapPage = readSource('src/views/MapPage.vue');

    expect(baseCss).toContain("touch-action: manipulation;");
    expect(baseCss).toContain("input[type='range']");
    expect(baseCss).toContain("touch-action: pan-x;");
    expect(navbar).toContain('var(--safe-area-top)');
    expect(navbar).toContain('env(safe-area-inset-left, 0px)');
    expect(navbar).toContain('env(safe-area-inset-bottom, 0px)');
    expect(mapPage).toContain('var(--safe-area-left)');
    expect(mapPage).toContain('var(--safe-area-bottom)');
    expect(mapPage).toContain('touch-action: none;');
  });
});
