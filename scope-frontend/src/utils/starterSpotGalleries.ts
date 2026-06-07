import type { Photo, SpotDetail } from '@/types';
import { CATEGORY_TRAVEL_PHOTO_POOL } from '@/utils/travelMedia';

interface StarterGalleryPlan {
  id: string;
  uuid: string;
  totalPhotos: number;
  captions: string[];
  photoOffset?: number;
}

const STARTER_GALLERY_PLANS = [
  {
    id: 'demo-spot-1',
    uuid: '90000000-0000-0000-0000-000000000001',
    totalPhotos: 4,
    captions: ['Covered storefront pass', 'Stockyards texture detail', 'Late afternoon window angle'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-2',
    uuid: '90000000-0000-0000-0000-000000000002',
    totalPhotos: 3,
    captions: ['Canal bend lights', 'Bridge-level walking view'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-3',
    uuid: '90000000-0000-0000-0000-000000000003',
    totalPhotos: 5,
    captions: ['Water wall scale check', 'Lower plaza mist frame', 'Concrete edge detail', 'Wide basin reset'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-4',
    uuid: '90000000-0000-0000-0000-000000000004',
    totalPhotos: 2,
    captions: ['Market counter close-up'],
    photoOffset: 3,
  },
  {
    id: 'demo-spot-5',
    uuid: '90000000-0000-0000-0000-000000000005',
    totalPhotos: 4,
    captions: ['Boardwalk skyline line', 'Waterfront pause point', 'Sunset route angle'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-6',
    uuid: '90000000-0000-0000-0000-000000000006',
    totalPhotos: 1,
    captions: [],
  },
  {
    id: 'demo-spot-7',
    uuid: '90000000-0000-0000-0000-000000000007',
    totalPhotos: 3,
    captions: ['Trail curve toward downtown', 'Bayou overlook frame'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-8',
    uuid: '90000000-0000-0000-0000-000000000008',
    totalPhotos: 5,
    captions: ['Canyon approach before the Window view', 'Desert ridge walking angle', 'Cliffside pause point', 'Trail texture close-up'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-9',
    uuid: '90000000-0000-0000-0000-000000000009',
    totalPhotos: 2,
    captions: ['Vendor row color hit'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-10',
    uuid: '90000000-0000-0000-0000-000000000010',
    totalPhotos: 4,
    captions: ['Public art reflection', 'Park path context', 'Downtown culture frame'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-11',
    uuid: '90000000-0000-0000-0000-000000000011',
    totalPhotos: 3,
    captions: ['Observation deck sightline', 'City grid from above'],
    photoOffset: 3,
  },
  {
    id: 'demo-spot-12',
    uuid: '90000000-0000-0000-0000-000000000012',
    totalPhotos: 5,
    captions: ['Morning market aisle', 'Fresh counter detail', 'Crowd flow checkpoint', 'Coffee stop angle'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-13',
    uuid: '90000000-0000-0000-0000-000000000013',
    totalPhotos: 2,
    captions: ['Wall detail color crop'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-14',
    uuid: '90000000-0000-0000-0000-000000000014',
    totalPhotos: 4,
    captions: ['Metal curve detail', 'Plaza approach angle', 'Evening arts district frame'],
    photoOffset: 3,
  },
  {
    id: 'demo-spot-15',
    uuid: '90000000-0000-0000-0000-000000000015',
    totalPhotos: 1,
    captions: [],
  },
  {
    id: 'demo-spot-16',
    uuid: '90000000-0000-0000-0000-000000000016',
    totalPhotos: 3,
    captions: ['Street corner rhythm', 'Square edge view'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-17',
    uuid: '90000000-0000-0000-0000-000000000017',
    totalPhotos: 5,
    captions: ['Crosswalk pulse angle', 'Neon corner context', 'Station approach frame', 'Night crowd energy'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-18',
    uuid: '90000000-0000-0000-0000-000000000018',
    totalPhotos: 2,
    captions: ['Lantern approach detail'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-19',
    uuid: '90000000-0000-0000-0000-000000000019',
    totalPhotos: 4,
    captions: ['Mosaic terrace detail', 'Garden overlook angle', 'Gaudi pathway frame'],
    photoOffset: 3,
  },
  {
    id: 'demo-spot-20',
    uuid: '90000000-0000-0000-0000-000000000020',
    totalPhotos: 3,
    captions: ['Market stall pass', 'Streetfront shopping detail'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-21',
    uuid: '90000000-0000-0000-0000-000000000021',
    totalPhotos: 5,
    captions: ['Garden canopy angle', 'Walkway under the trees', 'Night glow preview', 'Greenhouse route detail'],
    photoOffset: 2,
  },
  {
    id: 'demo-spot-22',
    uuid: '90000000-0000-0000-0000-000000000022',
    totalPhotos: 2,
    captions: ['Harbor view reset'],
    photoOffset: 3,
  },
  {
    id: 'demo-spot-23',
    uuid: '90000000-0000-0000-0000-000000000023',
    totalPhotos: 4,
    captions: ['Marble stair detail', 'Museum plaza frame', 'City arts route angle'],
    photoOffset: 1,
  },
  {
    id: 'demo-spot-24',
    uuid: '90000000-0000-0000-0000-000000000024',
    totalPhotos: 1,
    captions: [],
  },
] as const satisfies readonly StarterGalleryPlan[];

const STARTER_GALLERY_PLANS_BY_ID = new Map<string, StarterGalleryPlan>(
  STARTER_GALLERY_PLANS.flatMap((plan) => [
    [plan.id, plan],
    [plan.uuid, plan],
  ]),
);

const STARTER_GALLERY_PLANS_BY_PROVIDER_ID = new Map<string, StarterGalleryPlan>(
  STARTER_GALLERY_PLANS.flatMap((plan) => [
    [`showcase:${plan.id}`, plan],
    [`showcase:${plan.uuid}`, plan],
  ]),
);

function normalizeStarterId(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeGalleryUrl(value: string | undefined): string {
  const source = value?.trim();
  if (!source) {
    return '';
  }

  try {
    const url = new URL(source);
    return `${url.origin}${url.pathname}`;
  } catch {
    return source.split('?')[0] ?? source;
  }
}

function resolveStarterGalleryPlan(spot: SpotDetail): StarterGalleryPlan | undefined {
  const wireSpot = spot as SpotDetail & { provider_place_id?: unknown };
  const providerPlaceId = typeof spot.providerPlaceId === 'string'
    ? spot.providerPlaceId
    : typeof wireSpot.provider_place_id === 'string'
      ? wireSpot.provider_place_id
      : undefined;

  return (
    STARTER_GALLERY_PLANS_BY_ID.get(normalizeStarterId(spot.id)) ??
    STARTER_GALLERY_PLANS_BY_PROVIDER_ID.get(normalizeStarterId(providerPlaceId))
  );
}

function buildStarterGalleryExtras(spot: SpotDetail, plan: StarterGalleryPlan): Photo[] {
  const currentPhotos = Array.isArray(spot.photos) ? spot.photos : [];
  const existingUrls = new Set(
    [spot.photoUrl, ...currentPhotos.map((photo) => photo.url)]
      .map((url) => normalizeGalleryUrl(url))
      .filter(Boolean),
  );
  const existingGalleryCount = Math.max(1, existingUrls.size);
  const extraCount = Math.max(0, plan.totalPhotos - existingGalleryCount);
  const pool = CATEGORY_TRAVEL_PHOTO_POOL[spot.category] ?? CATEGORY_TRAVEL_PHOTO_POOL.other;
  const offset = plan.photoOffset ?? 0;
  const extras: Photo[] = [];

  for (let index = 0; extras.length < extraCount && index < pool.length * 2; index += 1) {
    const url = pool[(offset + index) % pool.length];
    const normalizedUrl = normalizeGalleryUrl(url);
    if (existingUrls.has(normalizedUrl)) {
      continue;
    }

    existingUrls.add(normalizedUrl);
    extras.push({
      id: `${spot.id}-starter-gallery-${extras.length + 2}`,
      url,
      caption: plan.captions[extras.length] ?? `${spot.title} travel angle ${extras.length + 2}`,
    });
  }

  return extras;
}

export function enrichStarterSpotGallery<T extends SpotDetail>(spot: T): T {
  const plan = resolveStarterGalleryPlan(spot);

  if (!plan || plan.totalPhotos <= 1) {
    return spot;
  }

  const extras = buildStarterGalleryExtras(spot, plan);

  if (!extras.length) {
    return spot;
  }

  return {
    ...spot,
    photos: [...(Array.isArray(spot.photos) ? spot.photos : []), ...extras],
  };
}
