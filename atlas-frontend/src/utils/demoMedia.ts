import type { SpotCategory } from '@/types';

export const DEMO_HERO_IMAGES = {
  landing: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920',
  auth: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920',
} as const;

export const CATEGORY_TRAVEL_PHOTOS: Record<SpotCategory, string> = {
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  nature: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  nightlife: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
  culture: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
  adventure: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800',
  shopping: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
  scenic: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800',
  other: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800',
};

export function buildPravatarAvatarUrl(imageId: number, _size = 150): string {
  const normalizedId = Math.min(70, Math.max(1, Math.trunc(imageId) || 1));
  return `https://i.pravatar.cc/150?img=${normalizedId}`;
}

export function getCategoryTravelPhoto(category: SpotCategory): string {
  return CATEGORY_TRAVEL_PHOTOS[category];
}
