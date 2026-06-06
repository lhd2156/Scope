import type { SpotSummary } from '@/types';
import { sanitizeSingleLineText } from '@/utils/sanitizers';

type SpotRouteLike = Pick<SpotSummary, 'id' | 'title'> & Partial<Pick<SpotSummary, 'city' | 'country'>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(value: string): string {
  return sanitizeSingleLineText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isUuidLike(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function buildSpotSlug(spot: SpotRouteLike): string {
  const titleSlug = slugify(spot.title);
  const citySlug = slugify(spot.city ?? '');
  const countrySlug = !citySlug ? slugify(spot.country ?? '') : '';
  const locationSlug = citySlug || countrySlug;
  const slug = [titleSlug, locationSlug].filter(Boolean).join('-');

  if (slug) {
    return slug;
  }

  return slugify(spot.id) || encodeURIComponent(spot.id);
}

export function buildSpotPath(spot: SpotRouteLike): string {
  return `/spots/${buildSpotSlug(spot)}`;
}

export function normalizeSpotRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
