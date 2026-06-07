import type { FeedItem, SpotCategory, Trip, TripSpot } from '@/types';

const DEFAULT_AVATAR_SIZE = 150;
const DEFAULT_PHOTO_WIDTH = 800;
const PRAVATAR_IMAGE_COUNT = 70;

const categoryPhotoIds: Record<SpotCategory, string> = {
  food: 'photo-1504674900247-0877df9cc836',
  nature: 'photo-1506905925346-21bda4d32df4',
  nightlife: 'photo-1516450360452-9312f5e86fc7',
  culture: 'photo-1493976040374-85c8e12f0c0e',
  adventure: 'photo-1527004013197-933c4bb611b3',
  shopping: 'photo-1441986300917-64674bd600d8',
  entertainment: 'photo-1501281668745-f7f57925c3b4',
  scenic: 'photo-1506929562872-bb421503ef21',
  other: 'photo-1488646953014-85cb44e25828',
};

const feedFallbackCategories: Record<FeedItem['type'], SpotCategory> = {
  spot: 'scenic',
  trip: 'adventure',
  review: 'scenic',
};

function buildUnsplashUrl(photoId: string, width = DEFAULT_PHOTO_WIDTH): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=70`;
}

function normalizeSource(source?: string | null): string {
  return source?.trim() ?? '';
}

function resizeImageSource(source: string, width = DEFAULT_PHOTO_WIDTH): string {
  if (!source) {
    return source;
  }

  try {
    const url = new URL(source);

    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', '70');
      return url.toString();
    }

    if (url.hostname === 'images.pexels.com') {
      url.searchParams.set('auto', 'compress');
      url.searchParams.set('cs', 'tinysrgb');
      url.searchParams.set('w', String(width));
      return url.toString();
    }

    return source;
  } catch {
    return source;
  }
}

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
}

export function buildPravatarUrl(seed: string, _size = DEFAULT_AVATAR_SIZE): string {
  const normalizedSeed = seed.trim() || 'scope-traveler';
  const imageIndex = (hashSeed(normalizedSeed) % PRAVATAR_IMAGE_COUNT) + 1;
  return `https://i.pravatar.cc/${DEFAULT_AVATAR_SIZE}?img=${imageIndex}`;
}

/*
 * Returns the sanitized avatar URL when one is provided. When nothing
 * explicit is set we intentionally return an empty string so the Avatar
 * component can render its neutral silhouette placeholder (Instagram
 * style) rather than a seeded pravatar face that isn't actually the
 * user's. Preview users that want a stock face can still call
 * `buildPravatarUrl` directly when seeding their avatarUrl.
 */
export function resolveAvatarUrl(source: string | null | undefined, _seed: string, _size = DEFAULT_AVATAR_SIZE): string {
  return normalizeSource(source);
}

export function getSpotPhotoFallback(category: SpotCategory, width = DEFAULT_PHOTO_WIDTH): string {
  return buildUnsplashUrl(categoryPhotoIds[category] ?? categoryPhotoIds.other, width);
}

export function isSpotPhotoFallbackUrl(source?: string | null): boolean {
  const normalizedSource = normalizeSource(source);
  if (!normalizedSource) {
    return false;
  }

  const fallbackPhotoIds = Object.values(categoryPhotoIds);
  try {
    const url = new URL(normalizedSource);
    return url.hostname === 'images.unsplash.com' && fallbackPhotoIds.some((photoId) => url.pathname.includes(photoId));
  } catch {
    return fallbackPhotoIds.some((photoId) => normalizedSource.includes(photoId));
  }
}

export function resolveSpotPhotoUrl(category: SpotCategory, source?: string | null, width = DEFAULT_PHOTO_WIDTH): string {
  return resizeImageSource(normalizeSource(source), width) || getSpotPhotoFallback(category, width);
}

function getTripFallbackCategory(trip: Pick<Trip, 'spots'>): SpotCategory {
  return trip.spots.find((spot) => Boolean(spot.category))?.category ?? 'scenic';
}

export function getTripCoverFallback(trip: Pick<Trip, 'spots'>, width = DEFAULT_PHOTO_WIDTH): string {
  return getSpotPhotoFallback(getTripFallbackCategory(trip), width);
}

export function resolveTripCoverImageUrl(trip: Pick<Trip, 'coverImageUrl' | 'spots'>, width = DEFAULT_PHOTO_WIDTH): string {
  return resizeImageSource(normalizeSource(trip.coverImageUrl), width)
    || trip.spots.map((spot) => resizeImageSource(normalizeSource(spot.photoUrl), width)).find(Boolean)
    || getTripCoverFallback(trip, width);
}

export function resolveTripSpotPhotoUrl(spot: Pick<TripSpot, 'category' | 'photoUrl'>, width = DEFAULT_PHOTO_WIDTH): string {
  return resolveSpotPhotoUrl(spot.category, spot.photoUrl, width);
}

export function resolveTripStopPhotoUrl(spot: Pick<TripSpot, 'category' | 'photoUrl'>, width = DEFAULT_PHOTO_WIDTH): string {
  return resolveTripSpotPhotoUrl(spot, width);
}

export function getFeedPhotoFallback(item: Pick<FeedItem, 'type'>, width = DEFAULT_PHOTO_WIDTH): string {
  return getSpotPhotoFallback(feedFallbackCategories[item.type] ?? 'scenic', width);
}

export function resolveFeedImageUrl(item: Pick<FeedItem, 'type' | 'imageUrl'>, width = DEFAULT_PHOTO_WIDTH): string {
  return resizeImageSource(normalizeSource(item.imageUrl), width) || getFeedPhotoFallback(item, width);
}
