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
  scenic: 'photo-1506929562872-bb421503ef21',
  other: 'photo-1488646953014-85cb44e25828',
};

const feedFallbackCategories: Record<FeedItem['type'], SpotCategory> = {
  spot: 'scenic',
  trip: 'adventure',
};

function buildUnsplashUrl(photoId: string, width = DEFAULT_PHOTO_WIDTH): string {
  return `https://images.unsplash.com/${photoId}?w=${width}`;
}

function normalizeSource(source?: string | null): string {
  return source?.trim() ?? '';
}

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
}

export function buildPravatarUrl(seed: string, _size = DEFAULT_AVATAR_SIZE): string {
  const normalizedSeed = seed.trim() || 'atlas-traveler';
  const imageIndex = (hashSeed(normalizedSeed) % PRAVATAR_IMAGE_COUNT) + 1;
  return `https://i.pravatar.cc/${DEFAULT_AVATAR_SIZE}?img=${imageIndex}`;
}

export function resolveAvatarUrl(source: string | null | undefined, seed: string, size = DEFAULT_AVATAR_SIZE): string {
  return normalizeSource(source) || buildPravatarUrl(seed, size);
}

export function getSpotPhotoFallback(category: SpotCategory, width = DEFAULT_PHOTO_WIDTH): string {
  return buildUnsplashUrl(categoryPhotoIds[category] ?? categoryPhotoIds.other, width);
}

export function resolveSpotPhotoUrl(category: SpotCategory, source?: string | null, width = DEFAULT_PHOTO_WIDTH): string {
  return normalizeSource(source) || getSpotPhotoFallback(category, width);
}

function getTripFallbackCategory(trip: Pick<Trip, 'spots'>): SpotCategory {
  return trip.spots.find((spot) => Boolean(spot.category))?.category ?? 'scenic';
}

export function getTripCoverFallback(trip: Pick<Trip, 'spots'>, width = DEFAULT_PHOTO_WIDTH): string {
  return getSpotPhotoFallback(getTripFallbackCategory(trip), width);
}

export function resolveTripCoverImageUrl(trip: Pick<Trip, 'coverImageUrl' | 'spots'>, width = DEFAULT_PHOTO_WIDTH): string {
  return normalizeSource(trip.coverImageUrl)
    || trip.spots.map((spot) => normalizeSource(spot.photoUrl)).find(Boolean)
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
  return normalizeSource(item.imageUrl) || getFeedPhotoFallback(item, width);
}
