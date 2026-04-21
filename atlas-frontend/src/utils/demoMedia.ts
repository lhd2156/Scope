import type { SpotCategory } from '@/types';

export const DEMO_HERO_IMAGES = {
  landing: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1280&q=60',
  auth: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&fm=webp&w=560&q=45',
} as const;

export const CATEGORY_TRAVEL_PHOTOS: Record<SpotCategory, string> = {
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&fm=webp&w=640&q=60',
  nature: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&fm=webp&w=640&q=60',
  nightlife: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&fm=webp&w=640&q=60',
  culture: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&fm=webp&w=640&q=60',
  adventure: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?auto=format&fit=crop&fm=webp&w=640&q=60',
  shopping: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&fm=webp&w=640&q=60',
  scenic: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&fm=webp&w=640&q=60',
  other: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&fm=webp&w=640&q=60',
};

export function buildPravatarAvatarUrl(imageId: number, _size = 150): string {
  const normalizedId = Math.min(70, Math.max(1, Math.trunc(imageId) || 1));
  return `https://i.pravatar.cc/150?img=${normalizedId}`;
}

export function getCategoryTravelPhoto(category: SpotCategory): string {
  return CATEGORY_TRAVEL_PHOTOS[category];
}
