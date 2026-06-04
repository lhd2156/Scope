import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(testFilePath), '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('mobile safe-area and touch-action polish', () => {
  it('opts the app shell into viewport-fit=cover for standalone mobile PWAs', () => {
    const indexHtml = readProjectFile('index.html');

    expect(indexHtml).toContain('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
  });

  it('defines shared safe-area variables and tap-friendly touch handling in base styles', () => {
    const baseCss = readProjectFile('src/assets/base.css');

    expect(baseCss).toContain('--safe-area-top: env(safe-area-inset-top, 0px);');
    expect(baseCss).toContain('--safe-area-right: env(safe-area-inset-right, 0px);');
    expect(baseCss).toContain('--safe-area-bottom: env(safe-area-inset-bottom, 0px);');
    expect(baseCss).toContain('--safe-area-left: env(safe-area-inset-left, 0px);');
    expect(baseCss).toContain('--shell-content-top: calc(var(--shell-content-top-base) + var(--safe-area-top));');
    expect(baseCss).toContain('--shell-content-bottom: calc(var(--shell-content-bottom-base) + var(--safe-area-bottom));');
    expect(baseCss).toContain('touch-action: manipulation;');
    expect(baseCss).toContain("input[type='range'] {");
    expect(baseCss).toContain('touch-action: pan-x;');
  });

  it('keeps the fixed navbar and mobile map chrome clear of device cutouts', () => {
    const navbarVue = readProjectFile('src/components/common/Navbar.vue');
    const mapPageVue = readProjectFile('src/views/MapPage.vue');

    expect(navbarVue).toContain('padding: calc(var(--safe-area-top) + 0.85rem) 0 0.7rem;');
    expect(navbarVue).toContain('max-width: none;');
    expect(navbarVue).toContain('--navbar-edge-padding: var(--shell-side-padding);');
    expect(navbarVue).toContain('calc(var(--navbar-edge-padding) + var(--safe-area-right))');
    expect(navbarVue).toContain('calc(var(--navbar-edge-padding) + var(--safe-area-left))');
    expect(mapPageVue).toContain('--scope-map-controls-right: max(var(--space-3), var(--safe-area-right));');
    expect(mapPageVue).toContain('--scope-map-controls-panel-left: max(var(--space-3), var(--safe-area-left));');
    expect(mapPageVue).toContain('calc(var(--space-3) + var(--safe-area-bottom))');
  });
});
