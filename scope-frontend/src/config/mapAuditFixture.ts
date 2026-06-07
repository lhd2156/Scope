import type { SpotCategory } from '@/types';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/travelMedia';

// Static fixture used only when Scope QA Mode is active on the map page.
// Kept in a dedicated module so the main MapPage component isn't dominated by
// audit scaffolding that never ships to real users.
export interface MapWorkspaceSpot {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: SpotCategory;
  city: string;
  country: string;
  adminArea?: string;
  province?: string;
  region?: string;
  state?: string;
  stateCode?: string;
  vibe: string;
  rating: number;
  photoUrl?: string;
}

export interface MapRoutePreviewTrip {
  title: string;
  description: string;
  destination: string;
  coverImageUrl?: string;
  members: Array<{
    id: string;
    displayName: string;
  }>;
  spots: Array<{
    spotId: string;
    title: string;
    latitude: number;
    longitude: number;
    category: SpotCategory;
    city?: string;
    dayNumber?: number;
    timeSlot?: string;
    photoUrl?: string;
  }>;
}

export const MAP_AUDIT_SPOTS: MapWorkspaceSpot[] = [
  {
    id: 'map-audit-riverfront-lounge',
    title: 'Riverfront Lounge',
    description: 'Glass-lined rooftop seating with a polished skyline backdrop for the guest map preview.',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'nightlife',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'electric skyline',
    rating: 4.8,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.nightlife,
  },
  {
    id: 'map-audit-botanic-loop',
    title: 'Botanic Loop',
    description: 'Tree-lined paths and a calm water edge that balance the featured night route.',
    latitude: 32.7419,
    longitude: -97.3621,
    category: 'nature',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'garden reset',
    rating: 4.7,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.nature,
  },
  {
    id: 'map-audit-vinyl-room',
    title: 'Vinyl Room',
    description: 'Low-lit listening lounge with enough energy to anchor the quick-access map rail.',
    latitude: 32.7812,
    longitude: -96.8003,
    category: 'culture',
    city: 'Dallas',
    country: 'US',
    vibe: 'late set',
    rating: 4.6,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.culture,
  },
  {
    id: 'map-audit-sunrise-overlook',
    title: 'Sunrise Overlook',
    description: 'A scenic lookout that rounds out the audit route with a daylight stop.',
    latitude: 32.7791,
    longitude: -97.4012,
    category: 'scenic',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'golden hour',
    rating: 4.9,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
  },
];

export const MAP_AUDIT_ROUTE: MapRoutePreviewTrip = {
  title: 'North Texas Guest Sampler',
  description: 'A compact route preview that keeps the guest map fast while still showing categories, route order, and crew context.',
  destination: 'Fort Worth, TX',
  coverImageUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
  members: [
    { id: 'map-audit-guide', displayName: 'Scope Guide' },
    { id: 'map-audit-guest', displayName: 'Guest Preview' },
  ],
  spots: [
    {
      spotId: 'map-audit-riverfront-lounge',
      title: 'Riverfront Lounge',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'nightlife',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '18:30',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.nightlife,
    },
    {
      spotId: 'map-audit-botanic-loop',
      title: 'Botanic Loop',
      latitude: 32.7419,
      longitude: -97.3621,
      category: 'nature',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '20:00',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.nature,
    },
    {
      spotId: 'map-audit-sunrise-overlook',
      title: 'Sunrise Overlook',
      latitude: 32.7791,
      longitude: -97.4012,
      category: 'scenic',
      city: 'Fort Worth',
      dayNumber: 2,
      timeSlot: '07:15',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
    },
  ],
};
