import type {
  FeedItem,
  Itinerary,
  MapViewport,
  NotificationItem,
  Review,
  SpotCategory,
  SpotDetail,
  SpotSummary,
  Trip,
  TripPlannerInput,
  TripSpot,
  UserProfile,
} from '@/types';

const users: UserProfile[] = [
  {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    bio: 'Collecting food, skyline, and nightlife pins across Texas.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  },
  {
    id: 'user-2',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Chen',
    bio: 'Weekend explorer chasing scenic and cultural spots.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: { spots: 28, trips: 6, friends: 84 },
  },
  {
    id: 'user-3',
    username: 'elijah',
    email: 'elijah@example.com',
    displayName: 'Elijah Brooks',
    bio: 'Adventure-first trip planner with a thing for great coffee.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: { spots: 36, trips: 11, friends: 64 },
  },
];

const baseSpots: SpotSummary[] = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    description: 'Street tacos, skyline views, and a late-night crowd.',
    latitude: 32.7555,
    longitude: -97.3308,
    address: '123 Main St',
    city: 'Fort Worth',
    country: 'US',
    category: 'food',
    vibe: 'electric',
    rating: 4.8,
    photoUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-26T20:00:00Z',
    author: users[0],
    liked: true,
    likesCount: 118,
  },
  {
    id: 'spot-2',
    title: 'Botanic River Walk',
    description: 'A scenic river trail with sunrise light and glassy water.',
    latitude: 32.749,
    longitude: -97.363,
    address: '2400 Botanical Ln',
    city: 'Fort Worth',
    country: 'US',
    category: 'nature',
    vibe: 'calm',
    rating: 4.7,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-24T14:10:00Z',
    author: users[1],
    liked: false,
    likesCount: 73,
  },
  {
    id: 'spot-3',
    title: 'Midnight Vinyl Club',
    description: 'Live DJs, moody lighting, and one of the best dance floors downtown.',
    latitude: 32.7812,
    longitude: -96.8003,
    address: '88 Elm St',
    city: 'Dallas',
    country: 'US',
    category: 'nightlife',
    vibe: 'moody',
    rating: 4.5,
    photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-21T23:40:00Z',
    author: users[2],
    liked: true,
    likesCount: 91,
  },
  {
    id: 'spot-4',
    title: 'Modern Art Garden',
    description: 'Sculptures, reflective pools, and a clean architectural backdrop.',
    latitude: 30.2672,
    longitude: -97.7431,
    address: '500 Congress Ave',
    city: 'Austin',
    country: 'US',
    category: 'culture',
    vibe: 'curated',
    rating: 4.6,
    photoUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-20T16:05:00Z',
    author: users[1],
    liked: false,
    likesCount: 54,
  },
  {
    id: 'spot-5',
    title: 'Cliffside Lookout Loop',
    description: 'A rugged loop trail ending with a premium overlook at golden hour.',
    latitude: 30.305,
    longitude: -97.777,
    address: '1100 Ridge Rd',
    city: 'Austin',
    country: 'US',
    category: 'adventure',
    vibe: 'wild',
    rating: 4.9,
    photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-18T18:45:00Z',
    author: users[2],
    liked: true,
    likesCount: 134,
  },
  {
    id: 'spot-6',
    title: 'Design District Gallery Row',
    description: 'Independent shops, fashion pop-ups, and polished café stops.',
    latitude: 32.8028,
    longitude: -96.8286,
    address: '77 District Ave',
    city: 'Dallas',
    country: 'US',
    category: 'shopping',
    vibe: 'luxury',
    rating: 4.4,
    photoUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-17T13:15:00Z',
    author: users[0],
    liked: false,
    likesCount: 49,
  },
];

function buildReviews(spotId: string): Review[] {
  return [
    {
      id: `${spotId}-review-1`,
      spotId,
      user: users[1],
      rating: 4.8,
      comment: 'Premium vibe, excellent pacing, and easy to build into a full evening plan.',
      createdAt: '2026-03-26T22:00:00Z',
    },
    {
      id: `${spotId}-review-2`,
      spotId,
      user: users[2],
      rating: 4.5,
      comment: 'Would absolutely route friends here again. Great anchor stop for an itinerary.',
      createdAt: '2026-03-25T19:30:00Z',
    },
  ];
}

function buildDetail(spot: SpotSummary): SpotDetail {
  return {
    ...spot,
    photos: [
      { id: `${spot.id}-photo-1`, url: spot.photoUrl ?? '', caption: 'Primary hero shot' },
      { id: `${spot.id}-photo-2`, url: spot.photoUrl ?? '', caption: 'Alternate angle' },
    ],
    reviews: buildReviews(spot.id),
  };
}

const tripSpots: TripSpot[] = baseSpots.slice(0, 4).map((spot, index) => ({
  spotId: spot.id,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
  timeSlot: ['10:00', '12:30', '16:00', '20:00'][index],
  duration: 90,
  estimatedCost: [0, 24, 18, 42][index],
}));

const itinerary: Itinerary = {
  id: 'itinerary-1',
  destination: 'Fort Worth + Dallas',
  totalEstimatedCost: 274,
  weatherForecast: 'Sunny, 75F',
  days: [
    {
      dayNumber: 1,
      date: '2026-04-01',
      spots: tripSpots.slice(0, 2),
    },
    {
      dayNumber: 2,
      date: '2026-04-02',
      spots: tripSpots.slice(2, 4),
    },
  ],
};

const trips: Trip[] = [
  {
    id: 'trip-1',
    title: 'North Texas Night + Food Loop',
    destination: 'Fort Worth, TX',
    description: 'Two days of tacos, skyline views, galleries, and nightlife.',
    isPublic: true,
    startDate: '2026-04-01',
    endDate: '2026-04-02',
    spots: tripSpots,
    members: [
      { id: users[0].id, displayName: users[0].displayName, status: 'owner' },
      { id: users[1].id, displayName: users[1].displayName, status: 'editor' },
      { id: users[2].id, displayName: users[2].displayName, status: 'viewer' },
    ],
    itinerary,
  },
  {
    id: 'trip-2',
    title: 'Austin Scenic Sprint',
    destination: 'Austin, TX',
    description: 'Architecture, hikes, and late brunch.',
    isPublic: true,
    startDate: '2026-04-10',
    endDate: '2026-04-11',
    spots: tripSpots.slice(1, 4),
    members: [{ id: users[2].id, displayName: users[2].displayName, status: 'owner' }],
  },
];

const notifications: NotificationItem[] = [
  {
    id: 'notification-1',
    title: 'Trip member joined',
    body: 'Maya joined North Texas Night + Food Loop.',
    isRead: false,
    createdAt: '2026-03-27T03:00:00Z',
    type: 'trip.member.added',
  },
  {
    id: 'notification-2',
    title: 'Spot liked',
    body: 'Elijah liked Sunset Rooftop Tacos.',
    isRead: true,
    createdAt: '2026-03-26T21:14:00Z',
    type: 'spot.liked',
  },
];

const feed: FeedItem[] = [
  {
    id: 'feed-1',
    type: 'spot',
    actor: users[1],
    title: 'Maya pinned Botanic River Walk',
    excerpt: 'Golden-hour river trail with a premium scenic payoff.',
    createdAt: '2026-03-27T00:20:00Z',
    imageUrl: baseSpots[1].photoUrl,
    targetId: baseSpots[1].id,
  },
  {
    id: 'feed-2',
    type: 'trip',
    actor: users[0],
    title: 'Louis planned North Texas Night + Food Loop',
    excerpt: 'A two-day itinerary built around food, culture, and nightlife.',
    createdAt: '2026-03-26T18:05:00Z',
    imageUrl: baseSpots[0].photoUrl,
    targetId: trips[0].id,
  },
];

const defaultViewport: MapViewport = {
  center: [-97.0, 32.9],
  zoom: 7,
  style: 'mapbox://styles/mapbox/dark-v11',
};

export const mockUsers = users;
export const mockSpots = baseSpots;
export const mockSpotDetails = baseSpots.reduce<Record<string, SpotDetail>>((accumulator, spot) => {
  accumulator[spot.id] = buildDetail(spot);
  return accumulator;
}, {});
export const mockTrips = trips;
export const mockNotifications = notifications;
export const mockFeed = feed;
export const mockViewport = defaultViewport;

export function getSpotById(spotId: string): SpotDetail | undefined {
  return mockSpotDetails[spotId];
}

export function getTripById(tripId: string): Trip | undefined {
  return mockTrips.find((trip) => trip.id === tripId);
}

export function filterSpots(filters: { category?: SpotCategory | ''; city?: string; vibe?: string }): SpotSummary[] {
  return mockSpots.filter((spot) => {
    const matchesCategory = !filters.category || spot.category === filters.category;
    const matchesCity = !filters.city || spot.city?.toLowerCase().includes(filters.city.toLowerCase());
    const matchesVibe = !filters.vibe || spot.vibe?.toLowerCase().includes(filters.vibe.toLowerCase());
    return matchesCategory && matchesCity && matchesVibe;
  });
}

export function buildItineraryPreview(input: TripPlannerInput): Itinerary {
  const interests = new Set(input.interests);
  const scoredSpots = mockSpots
    .map((spot) => ({
      spot,
      score:
        (interests.has(spot.category) ? 3 : 0) +
        spot.rating +
        (spot.likesCount ?? 0) / 100,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(2, Math.min(6, input.groupSize + 2)));

  const dailyPace = input.pace === 'relaxed' ? 2 : input.pace === 'packed' ? 4 : 3;
  const days: Itinerary['days'] = [];
  const start = new Date(input.startDate);

  scoredSpots.forEach(({ spot }, index) => {
    const dayIndex = Math.floor(index / dailyPace);
    if (!days[dayIndex]) {
      const date = new Date(start);
      date.setDate(start.getDate() + dayIndex);
      days[dayIndex] = {
        dayNumber: dayIndex + 1,
        date: date.toISOString().slice(0, 10),
        spots: [],
      };
    }

    days[dayIndex].spots.push({
      spotId: spot.id,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      timeSlot: ['09:00', '12:00', '15:00', '19:00'][days[dayIndex].spots.length] ?? '20:00',
      duration: 90,
      estimatedCost: 20 + index * 8,
    });
  });

  const totalEstimatedCost = days.flatMap((day) => day.spots).reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);

  return {
    id: `itinerary-${input.destination.replace(/\s+/g, '-').toLowerCase()}`,
    destination: input.destination,
    days,
    totalEstimatedCost,
    weatherForecast: 'Clear skies with mild evening temps.',
  };
}
