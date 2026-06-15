import type { SpotCategory } from '@/types';

export const TRAVEL_HERO_IMAGES = {
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
  entertainment: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&fm=webp&w=640&q=60',
  scenic: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&fm=webp&w=640&q=60',
  other: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&fm=webp&w=640&q=60',
};

export const CATEGORY_TRAVEL_PHOTO_POOL: Record<SpotCategory, string[]> = {
  food: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  nature: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  nightlife: [
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1571266028243-d220bc2f4a6c?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  culture: [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1552084117-56a987666449?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  adventure: [
    'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  shopping: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1555529669-2269763671c0?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1523848309072-c199db53f137?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  scenic: [
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1502786129293-79981df4e689?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
  other: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&fm=webp&w=640&q=60',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&fm=webp&w=640&q=60',
  ],
};

function stableHash(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function pickTravelPhotoForSeed(category: SpotCategory, seed: string): string {
  const pool = CATEGORY_TRAVEL_PHOTO_POOL[category] ?? CATEGORY_TRAVEL_PHOTO_POOL.other;
  if (!seed) return pool[0];
  return pool[stableHash(seed) % pool.length];
}

export function getCategoryTravelPhoto(category: SpotCategory): string {
  return CATEGORY_TRAVEL_PHOTOS[category];
}
