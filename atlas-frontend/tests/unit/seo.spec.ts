import { createMemoryHistory, createRouter } from 'vue-router';
import { initializeSeo, syncThemeColorMeta } from '@/utils/seo';

const StubPage = { template: '<div />' };

function getMetaByName(name: string): string | null {
  return document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

function getMetaByProperty(property: string): string | null {
  return document.head.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ?? null;
}

describe('seo shell metadata', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.setProperty('--bg-primary', 'rgb(15 15 26)');
  });

  it('applies route metadata, public shell tags, and canonical urls for indexable pages', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: StubPage,
          meta: {
            title: 'Atlas — Discover spots, map stories, and plan smarter trips',
            description: 'Atlas default home shell.',
            robots: 'index,follow',
          },
        },
        {
          path: '/explore',
          name: 'explore',
          component: StubPage,
          meta: {
            title: 'Explore community-loved spots | Atlas',
            description: 'Browse Atlas spots by category, city, and vibe to find your next outing.',
            robots: 'index,follow',
            image: '/social-preview.png',
          },
        },
      ],
    });

    initializeSeo(router);
    await router.push('/explore?city=Austin');
    await router.isReady();
    await Promise.resolve();

    const canonicalUrl = new URL('/explore', window.location.origin).toString();

    expect(document.title).toBe('Explore community-loved spots | Atlas');
    expect(getMetaByName('description')).toBe('Browse Atlas spots by category, city, and vibe to find your next outing.');
    expect(getMetaByName('robots')).toBe('index,follow');
    expect(getMetaByName('application-name')).toBe('Atlas');
    expect(getMetaByName('apple-mobile-web-app-title')).toBe('Atlas');
    expect(getMetaByName('apple-mobile-web-app-capable')).toBe('yes');
    expect(getMetaByName('mobile-web-app-capable')).toBe('yes');
    expect(getMetaByProperty('og:site_name')).toBe('Atlas');
    expect(getMetaByProperty('og:url')).toBe(canonicalUrl);
    expect(getMetaByProperty('og:image')).toBe(new URL('/social-preview.png', window.location.origin).toString());
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonicalUrl);
  });

  it('removes canonical tags for opt-out routes and keeps theme-color metadata in sync', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: StubPage,
          meta: {
            title: 'Atlas — Discover spots, map stories, and plan smarter trips',
            description: 'Atlas default home shell.',
            robots: 'index,follow',
          },
        },
        {
          path: '/missing',
          name: 'missing',
          component: StubPage,
          meta: {
            title: 'Page not found | Atlas',
            description: 'The requested Atlas route could not be found.',
            robots: 'noindex,nofollow',
            canonicalPath: false,
          },
        },
      ],
    });

    initializeSeo(router);
    await router.push('/missing');
    await router.isReady();
    await Promise.resolve();

    expect(getMetaByName('robots')).toBe('noindex,nofollow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(getMetaByName('theme-color')).toBe('rgb(15 15 26)');
    expect(getMetaByName('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');

    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.setProperty('--bg-primary', 'rgb(250 250 250)');
    syncThemeColorMeta('light');

    expect(getMetaByName('theme-color')).toBe('rgb(250 250 250)');
    expect(getMetaByName('msapplication-TileColor')).toBe('rgb(250 250 250)');
    expect(getMetaByName('apple-mobile-web-app-status-bar-style')).toBe('default');
  });
});
