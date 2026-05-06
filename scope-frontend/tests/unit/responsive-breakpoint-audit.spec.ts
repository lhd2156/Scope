import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(import.meta.dirname, '..', '..', relativePath), 'utf8');
}

describe('responsive breakpoint audit', () => {
  it('defines the shared tablet and mobile breakpoint guardrails in base.css', () => {
    const baseCss = readSource('src/assets/base.css');

    expect(baseCss).toContain('@media (max-width: 1024px)');
    expect(baseCss).toContain('@media (max-width: 640px)');
    expect(baseCss).toContain(':where(.page-container)');
    expect(baseCss).toContain(':where(.glass-panel)');
    expect(baseCss).toContain(':where(.page-grid, .content-grid, .map-layout, .profile-grid, .friends-grid, .settings-layout, .trip-layout, .trip-planner-layout, .detail-layout)');
  });

  it('keeps the breakpoint-sensitive shell/pages anchored to shared responsive layout primitives', () => {
    const filesToAudit = [
      'src/components/common/AppShell.vue',
      'src/components/common/Navbar.vue',
      'src/components/common/Sidebar.vue',
      'src/views/MapPage.vue',
      'src/views/ExplorePage.vue',
      'src/views/ProfilePage.vue',
      'src/views/FriendsPage.vue',
      'src/views/SettingsPage.vue',
      'src/views/TripPlannerPage.vue',
      'src/views/TripDetailPage.vue',
    ];

    const missingSharedLayoutHooks = filesToAudit.filter((relativePath) => {
      const source = readSource(relativePath);
      return !/(page-container|page-grid|page-stack|glass-panel|map-layout|profile-grid|friends-grid|settings-layout|trip-layout|trip-planner-layout|detail-layout|layout-shell|navbar|sidebar)/i.test(source);
    });

    expect(missingSharedLayoutHooks).toEqual([]);
  });
});
