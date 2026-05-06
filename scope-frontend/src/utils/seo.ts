import type { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import type { ThemeMode } from '@/types';

const APP_NAME = 'Scope';
const DEFAULT_TITLE = 'Scope — Discover spots, map stories, and plan smarter trips';
const DEFAULT_DESCRIPTION = 'Scope helps people discover community-loved spots, document real-world adventures with photos and stories, and build smarter itineraries with friends.';
const DEFAULT_ROBOTS = 'index,follow';
const DEFAULT_IMAGE_PATH = '/social-preview.png';
const DEFAULT_OG_TYPE = 'website';
const DEFAULT_IMAGE_ALT = 'Scope preview showing a map-led adventure planning workspace';
const THEME_COLOR_VARIABLE = '--bg-primary';

type MetaValue = string | false | ((route: RouteLocationNormalizedLoaded) => string | false);

interface ResolvedSeoMetadata {
  title: string;
  description: string;
  robots: string;
  canonicalUrl: string | null;
  imageUrl: string;
  type: string;
}

function resolveMetaValue(
  value: MetaValue | undefined,
  route: RouteLocationNormalizedLoaded,
  fallback: string | false,
): string | false {
  if (typeof value === 'function') {
    return value(route);
  }

  return value ?? fallback;
}

function buildAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function upsertMetaTag(selector: { name?: string; property?: string }, content: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const selectorAttribute = selector.name ? `meta[name="${selector.name}"]` : `meta[property="${selector.property}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selectorAttribute);

  if (!element) {
    element = document.createElement('meta');

    if (selector.name) {
      element.setAttribute('name', selector.name);
    }

    if (selector.property) {
      element.setAttribute('property', selector.property);
    }

    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertCanonicalLink(href: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const existingLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!href) {
    existingLink?.remove();
    return;
  }

  const canonicalLink = existingLink ?? document.createElement('link');
  canonicalLink.setAttribute('rel', 'canonical');
  canonicalLink.setAttribute('href', href);

  if (!existingLink) {
    document.head.appendChild(canonicalLink);
  }
}

function resolveRouteMetadata(route: RouteLocationNormalizedLoaded): ResolvedSeoMetadata {
  const title = resolveMetaValue(route.meta.title, route, DEFAULT_TITLE);
  const description = resolveMetaValue(route.meta.description, route, DEFAULT_DESCRIPTION);
  const robots = resolveMetaValue(route.meta.robots, route, DEFAULT_ROBOTS);
  const canonicalPath = resolveMetaValue(route.meta.canonicalPath, route, route.path);
  const imagePath = resolveMetaValue(route.meta.image, route, DEFAULT_IMAGE_PATH);
  const type = resolveMetaValue(route.meta.type, route, DEFAULT_OG_TYPE);

  return {
    title: title || DEFAULT_TITLE,
    description: description || DEFAULT_DESCRIPTION,
    robots: robots || DEFAULT_ROBOTS,
    canonicalUrl: canonicalPath ? buildAbsoluteUrl(canonicalPath) : null,
    imageUrl: buildAbsoluteUrl(typeof imagePath === 'string' ? imagePath : DEFAULT_IMAGE_PATH),
    type: type || DEFAULT_OG_TYPE,
  };
}

function applyRouteMetadata(route: RouteLocationNormalizedLoaded): void {
  if (typeof document === 'undefined') {
    return;
  }

  const metadata = resolveRouteMetadata(route);
  const url = metadata.canonicalUrl ?? buildAbsoluteUrl(route.fullPath || route.path || '/');

  document.title = metadata.title;

  upsertMetaTag({ name: 'description' }, metadata.description);
  upsertMetaTag({ name: 'robots' }, metadata.robots);
  upsertMetaTag({ name: 'application-name' }, APP_NAME);
  upsertMetaTag({ name: 'apple-mobile-web-app-title' }, APP_NAME);
  upsertMetaTag({ name: 'mobile-web-app-capable' }, 'yes');
  upsertMetaTag({ name: 'apple-mobile-web-app-capable' }, 'yes');
  upsertMetaTag({ property: 'og:site_name' }, APP_NAME);
  upsertMetaTag({ property: 'og:type' }, metadata.type);
  upsertMetaTag({ property: 'og:title' }, metadata.title);
  upsertMetaTag({ property: 'og:description' }, metadata.description);
  upsertMetaTag({ property: 'og:url' }, url);
  upsertMetaTag({ property: 'og:image' }, metadata.imageUrl);
  upsertMetaTag({ property: 'og:image:alt' }, DEFAULT_IMAGE_ALT);
  upsertMetaTag({ name: 'twitter:card' }, 'summary_large_image');
  upsertMetaTag({ name: 'twitter:title' }, metadata.title);
  upsertMetaTag({ name: 'twitter:description' }, metadata.description);
  upsertMetaTag({ name: 'twitter:image' }, metadata.imageUrl);
  upsertMetaTag({ name: 'twitter:image:alt' }, DEFAULT_IMAGE_ALT);
  upsertCanonicalLink(metadata.canonicalUrl);
  syncThemeColorMeta(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
}

export function initializeSeo(router: Router): void {
  if (typeof document === 'undefined') {
    return;
  }

  router.afterEach((to) => {
    applyRouteMetadata(to);
  });

  queueMicrotask(() => {
    applyRouteMetadata(router.currentRoute.value);
  });
}

function resolveThemeColor(): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const rootStyles = getComputedStyle(document.documentElement);
  return rootStyles.getPropertyValue(THEME_COLOR_VARIABLE).trim();
}

export function syncThemeColorMeta(theme: ThemeMode): void {
  const resolvedThemeColor = resolveThemeColor();

  if (resolvedThemeColor) {
    upsertMetaTag({ name: 'theme-color' }, resolvedThemeColor);
    upsertMetaTag({ name: 'msapplication-TileColor' }, resolvedThemeColor);
  }

  upsertMetaTag({ name: 'apple-mobile-web-app-status-bar-style' }, theme === 'dark' ? 'black-translucent' : 'default');
}
