import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const testsDirectory = dirname(currentFilePath);
const frontendRoot = resolve(testsDirectory, '..', '..');

function readFrontendFile(relativePath: string): string {
  return readFileSync(resolve(frontendRoot, relativePath), 'utf8');
}

describe('typography and spacing audit', () => {
  it('locks shared typography tokens to the Phase 13 spec', () => {
    const tokens = readFrontendFile('src/assets/tokens.css');

    expect(tokens).toContain('--font-size-hero: clamp(2.5rem, 5vw, 4rem);');
    expect(tokens).toContain('--font-size-h1: 2rem;');
    expect(tokens).toContain('--font-size-h2: 1.5rem;');
    expect(tokens).toContain('--font-size-h3: 1.125rem;');
    expect(tokens).toContain('--line-height-normal: 1.5;');
    expect(tokens).toContain('--line-height-relaxed: 1.5;');
    expect(tokens).toContain('--letter-spacing-display: -0.04em;');
    expect(tokens).toContain('--letter-spacing-eyebrow: 0.14em;');
    expect(tokens).toContain('--section-gap-page: clamp(var(--space-8), 5vw, var(--space-12));');
    expect(tokens).toContain('--section-gap-compact: clamp(var(--space-5), 2vw, var(--space-8));');
  });

  it('uses shared copy and eyebrow rules in the base shell and section heading', () => {
    const baseStyles = readFrontendFile('src/assets/base.css');
    const sectionHeading = readFrontendFile('src/components/common/SectionHeading.vue');

    expect(baseStyles).toContain('padding: var(--section-gap-compact) 0 var(--shell-content-bottom);');
    expect(baseStyles).toContain('gap: var(--section-gap);');
    expect(baseStyles).toContain('letter-spacing: var(--letter-spacing-eyebrow);');
    expect(baseStyles).toContain('line-height: var(--line-height-normal);');

    expect(sectionHeading).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, var(--copy-measure));');
    expect(sectionHeading).toContain('margin-bottom: var(--section-gap-compact);');
    expect(sectionHeading).toContain('line-height: var(--line-height-tight);');
    expect(sectionHeading).toContain('line-height: var(--line-height-normal);');
    expect(sectionHeading).not.toContain('letter-spacing: 0.12em;');
  });

  it('keeps non-hero view headings on the page-title scale', () => {
    const explorePage = readFrontendFile('src/views/ExplorePage.vue');
    const friendsPage = readFrontendFile('src/views/FriendsPage.vue');
    const settingsPage = readFrontendFile('src/views/SettingsPage.vue');
    const loginPage = readFrontendFile('src/views/LoginPage.vue');
    const registerPage = readFrontendFile('src/views/RegisterPage.vue');

    for (const source of [explorePage, friendsPage, settingsPage, loginPage, registerPage]) {
      expect(source).toContain('letter-spacing: var(--letter-spacing-display);');
      expect(source).toContain('line-height: var(--line-height-tight);');
    }

    expect(explorePage).toContain('font-size: var(--font-size-h1);');
    expect(explorePage).toContain('font-size: var(--font-size-h2);');
    expect(friendsPage).toContain('font-size: var(--font-size-h1);');
    expect(settingsPage).toContain('font-size: var(--font-size-h1);');
    expect(loginPage).toContain('font-size: var(--font-size-h1);');
    expect(registerPage).toContain('font-size: var(--font-size-h1);');
  });

  it('keeps premium detail screens aligned to the shared heading hierarchy', () => {
    const homePage = readFrontendFile('src/views/HomePage.vue');
    const mapPage = readFrontendFile('src/views/MapPage.vue');
    const profileHeader = readFrontendFile('src/components/profile/ProfileHeader.vue');
    const spotDetail = readFrontendFile('src/components/spots/SpotDetail.vue');
    const tripPlanner = readFrontendFile('src/components/trips/TripPlanner.vue');
    const authSplitShell = readFrontendFile('src/components/auth/AuthSplitShell.vue');

    expect(homePage).toContain('font-size: var(--font-size-hero);');
    expect(homePage).toContain('letter-spacing: var(--letter-spacing-display);');
    expect(mapPage).toContain('font-size: var(--font-size-h1);');
    expect(mapPage).toContain('font-size: var(--font-size-h2);');
    expect(profileHeader).toContain('clamp(var(--font-size-h1), 4vw, 3rem);');
    expect(spotDetail).toContain('clamp(var(--font-size-h1), 4vw, 3rem);');
    expect(tripPlanner).toContain('font-size: var(--font-size-h1);');
    expect(authSplitShell).toContain('font-size: var(--font-size-hero);');
    expect(authSplitShell).toContain('line-height: var(--line-height-normal);');
  });
});
