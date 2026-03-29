import type {
  FeedItem,
  FriendConnection,
  FriendRequest,
  Itinerary,
  MapViewport,
  NotificationItem,
  Photo,
  Review,
  SpotCategory,
  SpotDetail,
  SpotFormSubmission,
  SpotSummary,
  Trip,
  TripPlannerInput,
  TripSpot,
  UserProfile,
} from '@/types';
import {
  sanitizeFeedItem,
  sanitizeItinerary,
  sanitizeNotificationItem,
  sanitizePhoto,
  sanitizeSingleLineText,
  sanitizeSpotDetail,
  sanitizeSpotFormSubmission,
  sanitizeSpotSummary,
  sanitizeTrip,
  sanitizeTripPlannerInput,
  sanitizeUserProfile,
} from '@/utils/sanitizers';

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

const friendRequestUsers: UserProfile[] = [
  {
    id: 'user-4',
    username: 'sofiaramirez',
    email: 'sofia@example.com',
    displayName: 'Sofia Ramirez',
    bio: 'Building food-first city breaks with strong coffee and stronger itineraries.',
    homeBase: 'San Antonio, TX',
    interests: ['food', 'culture', 'shopping'],
    stats: { spots: 19, trips: 4, friends: 42 },
  },
  {
    id: 'user-5',
    username: 'jordanreed',
    email: 'jordan@example.com',
    displayName: 'Jordan Reed',
    bio: 'Always looking for the next scenic overlook and a clean route between stops.',
    homeBase: 'Waco, TX',
    interests: ['scenic', 'nature', 'adventure'],
    stats: { spots: 24, trips: 5, friends: 38 },
  },
];

const friendConnections: FriendConnection[] = [
  {
    id: 'connection-1',
    user: users[1],
    presence: 'online',
    sharedTrips: 3,
    mutualFriends: 18,
    favoriteCategories: ['scenic', 'culture'],
    nextAdventure: 'Dallas culture sprint',
    lastActiveAt: '2026-03-27T04:10:00Z',
  },
  {
    id: 'connection-2',
    user: users[2],
    presence: 'planning',
    sharedTrips: 2,
    mutualFriends: 12,
    favoriteCategories: ['adventure', 'food'],
    nextAdventure: 'Austin sunrise loop',
    lastActiveAt: '2026-03-27T02:45:00Z',
  },
];

const friendRequests: FriendRequest[] = [
  {
    id: 'request-1',
    user: friendRequestUsers[0],
    direction: 'incoming',
    createdAt: '2026-03-27T01:30:00Z',
    mutualFriends: 9,
    note: 'Would love to trade Texas food routes.',
  },
  {
    id: 'request-2',
    user: friendRequestUsers[1],
    direction: 'incoming',
    createdAt: '2026-03-26T18:55:00Z',
    mutualFriends: 6,
    note: 'Saw your scenic pins and wanted to connect.',
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

function buildTripSpot(
  spot: SpotSummary,
  config: {
    dayNumber: number;
    timeSlot: string;
    duration: number;
    estimatedCost: number;
    notes: string;
  },
): TripSpot {
  return {
    spotId: spot.id,
    title: spot.title,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    timeSlot: config.timeSlot,
    duration: config.duration,
    estimatedCost: config.estimatedCost,
    photoUrl: spot.photoUrl,
    city: spot.city,
    dayNumber: config.dayNumber,
    notes: config.notes,
  };
}

function getDateOffset(startDate: string, offsetDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildItineraryFromTripSpots(options: {
  id: string;
  destination: string;
  startDate: string;
  spots: TripSpot[];
  weatherForecast: string;
}): Itinerary {
  const days = options.spots.reduce<Itinerary['days']>((accumulator, spot) => {
    const dayNumber = spot.dayNumber ?? 1;
    let day = accumulator.find((entry) => entry.dayNumber === dayNumber);

    if (!day) {
      day = {
        dayNumber,
        date: getDateOffset(options.startDate, dayNumber - 1),
        spots: [],
      };
      accumulator.push(day);
    }

    day.spots.push(spot);
    day.spots.sort((left, right) => (left.timeSlot ?? '').localeCompare(right.timeSlot ?? ''));
    return accumulator;
  }, []);

  const totalEstimatedCost = days
    .flatMap((day) => day.spots)
    .reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);

  return {
    id: options.id,
    destination: options.destination,
    days: days.sort((left, right) => left.dayNumber - right.dayNumber),
    totalEstimatedCost,
    weatherForecast: options.weatherForecast,
  };
}

const northTexasTripSpots: TripSpot[] = [
  buildTripSpot(baseSpots[0], {
    dayNumber: 1,
    timeSlot: '11:00',
    duration: 75,
    estimatedCost: 26,
    notes: 'Open with rooftop tacos while the skyline is still bright.',
  }),
  buildTripSpot(baseSpots[1], {
    dayNumber: 1,
    timeSlot: '14:30',
    duration: 90,
    estimatedCost: 0,
    notes: 'Slow the route down with a river walk and photo break.',
  }),
  buildTripSpot(baseSpots[3], {
    dayNumber: 2,
    timeSlot: '10:00',
    duration: 105,
    estimatedCost: 18,
    notes: 'Use the gallery district as the culture anchor for day two.',
  }),
  buildTripSpot(baseSpots[2], {
    dayNumber: 2,
    timeSlot: '20:30',
    duration: 120,
    estimatedCost: 42,
    notes: 'Close out with a nightlife stop once the downtown energy peaks.',
  }),
];

const austinTripSpots: TripSpot[] = [
  buildTripSpot(baseSpots[4], {
    dayNumber: 1,
    timeSlot: '08:30',
    duration: 120,
    estimatedCost: 12,
    notes: 'Hit the overlook early before the trail fills in.',
  }),
  buildTripSpot(baseSpots[3], {
    dayNumber: 1,
    timeSlot: '13:00',
    duration: 90,
    estimatedCost: 16,
    notes: 'Recover with architecture, sculpture, and slower pacing.',
  }),
  buildTripSpot(baseSpots[5], {
    dayNumber: 2,
    timeSlot: '11:30',
    duration: 85,
    estimatedCost: 36,
    notes: 'Reserve the design district for coffee, shopping, and gifts.',
  }),
];

const weekendCityTripSpots: TripSpot[] = [
  buildTripSpot(baseSpots[1], {
    dayNumber: 1,
    timeSlot: '09:00',
    duration: 60,
    estimatedCost: 0,
    notes: 'Ease into the trip with a scenic trail and good light.',
  }),
  buildTripSpot(baseSpots[0], {
    dayNumber: 1,
    timeSlot: '12:00',
    duration: 75,
    estimatedCost: 24,
    notes: 'Lunch anchor with a strong Atlas cover-photo moment.',
  }),
  buildTripSpot(baseSpots[5], {
    dayNumber: 1,
    timeSlot: '16:30',
    duration: 80,
    estimatedCost: 30,
    notes: 'Finish with a polished district loop before dinner.',
  }),
];

const northTexasItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-1',
  destination: 'Fort Worth + Dallas',
  startDate: '2026-04-01',
  spots: northTexasTripSpots,
  weatherForecast: 'Sunny, 75F',
});

const austinItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-2',
  destination: 'Austin, TX',
  startDate: '2026-04-10',
  spots: austinTripSpots,
  weatherForecast: 'Warm morning, breezy afternoon.',
});

const weekendCityItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-3',
  destination: 'Fort Worth, TX',
  startDate: '2026-05-14',
  spots: weekendCityTripSpots,
  weatherForecast: 'Clear skies with a golden-hour finish.',
});

const trips: Trip[] = [
  {
    id: 'trip-1',
    title: 'North Texas Night + Food Loop',
    destination: 'Fort Worth, TX',
    description: 'Two days of tacos, skyline views, galleries, and nightlife sequenced for a premium downtown circuit.',
    isPublic: true,
    startDate: '2026-04-01',
    endDate: '2026-04-02',
    spots: northTexasTripSpots,
    members: [
      { id: users[0].id, displayName: users[0].displayName, status: 'owner' },
      { id: users[1].id, displayName: users[1].displayName, status: 'editor' },
      { id: users[2].id, displayName: users[2].displayName, status: 'viewer' },
    ],
    itinerary: northTexasItinerary,
    coverImageUrl: baseSpots[0].photoUrl,
    budget: 320,
    currency: 'USD',
    status: 'planning',
  },
  {
    id: 'trip-2',
    title: 'Austin Scenic Sprint',
    destination: 'Austin, TX',
    description: 'Architecture, hikes, and late brunch with enough margin to keep the weekend relaxed.',
    isPublic: true,
    startDate: '2026-04-10',
    endDate: '2026-04-11',
    spots: austinTripSpots,
    members: [{ id: users[2].id, displayName: users[2].displayName, status: 'owner' }],
    itinerary: austinItinerary,
    coverImageUrl: baseSpots[4].photoUrl,
    budget: 180,
    currency: 'USD',
    status: 'planning',
  },
  {
    id: 'trip-3',
    title: 'Weekend City Reset',
    destination: 'Fort Worth, TX',
    description: 'A one-day city reset balancing nature, lunch, and a final design-district sweep.',
    isPublic: true,
    startDate: '2026-05-14',
    endDate: '2026-05-14',
    spots: weekendCityTripSpots,
    members: [
      { id: users[1].id, displayName: users[1].displayName, status: 'owner' },
      { id: users[0].id, displayName: users[0].displayName, status: 'viewer' },
    ],
    itinerary: weekendCityItinerary,
    coverImageUrl: baseSpots[1].photoUrl,
    budget: 120,
    currency: 'USD',
    status: 'planning',
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

export const mockUsers = users.map((user) => sanitizeUserProfile(user));
export const mockFriendConnections = friendConnections.map((connection) => ({
  ...connection,
  user: sanitizeUserProfile(connection.user),
}));
export const mockFriendRequests = friendRequests.map((request) => ({
  ...request,
  user: sanitizeUserProfile(request.user),
  note: request.note ? sanitizeSingleLineText(request.note) : undefined,
}));
export const mockSpots = baseSpots.map((spot) => sanitizeSpotSummary(spot));
export const mockSpotDetails = baseSpots.reduce<Record<string, SpotDetail>>((accumulator, spot) => {
  accumulator[spot.id] = sanitizeSpotDetail(buildDetail(spot));
  return accumulator;
}, {});
export const mockTrips = trips.map((trip) => sanitizeTrip(trip));
export const mockNotifications = notifications.map((notification) => sanitizeNotificationItem(notification));
export const mockFeed = feed.map((item) => sanitizeFeedItem(item));
export const mockViewport = defaultViewport;

function mapSubmissionPhotos(submission: SpotFormSubmission, fallbackCaption: string): Photo[] {
  const existingPhotos = submission.existingPhotos.map((photo) =>
    sanitizePhoto({
      ...photo,
      caption: photo.caption?.trim() || fallbackCaption,
    }),
  );

  const uploadedPhotos = submission.newPhotos.map((photo) =>
    sanitizePhoto({
      id: photo.id,
      url: photo.previewUrl,
      caption: photo.caption.trim() || fallbackCaption,
    }),
  );

  return [...existingPhotos, ...uploadedPhotos];
}

function toSpotSummary(spot: SpotDetail): SpotSummary {
  return sanitizeSpotSummary({
    id: spot.id,
    title: spot.title,
    description: spot.description,
    latitude: spot.latitude,
    longitude: spot.longitude,
    address: spot.address,
    city: spot.city,
    country: spot.country,
    category: spot.category,
    vibe: spot.vibe,
    rating: spot.rating,
    photoUrl: spot.photoUrl ?? spot.photos[0]?.url,
    createdAt: spot.createdAt,
    author: spot.author,
    liked: spot.liked,
    likesCount: spot.likesCount,
  });
}

function upsertSpot(spot: SpotDetail): void {
  const sanitizedSpot = sanitizeSpotDetail(spot);
  mockSpotDetails[sanitizedSpot.id] = sanitizedSpot;
  const summary = toSpotSummary(sanitizedSpot);
  const existingIndex = mockSpots.findIndex((entry) => entry.id === sanitizedSpot.id);

  if (existingIndex === -1) {
    mockSpots.unshift(summary);
    return;
  }

  mockSpots.splice(existingIndex, 1, summary);
}

export function createMockSpot(submission: SpotFormSubmission, author?: UserProfile | null): SpotDetail {
  const sanitizedSubmission = sanitizeSpotFormSubmission(submission);
  const now = new Date().toISOString();
  const photos = mapSubmissionPhotos(sanitizedSubmission, sanitizedSubmission.spot.title);
  const nextSpot = sanitizeSpotDetail({
    id: `spot-${Date.now()}`,
    title: sanitizedSubmission.spot.title,
    description: sanitizedSubmission.spot.description,
    latitude: sanitizedSubmission.spot.latitude,
    longitude: sanitizedSubmission.spot.longitude,
    address: sanitizedSubmission.spot.address,
    city: sanitizedSubmission.spot.city,
    country: sanitizedSubmission.spot.country,
    category: sanitizedSubmission.spot.category,
    vibe: sanitizedSubmission.spot.vibe,
    rating: sanitizedSubmission.spot.rating,
    photoUrl: photos[0]?.url,
    createdAt: now,
    author: author ? sanitizeUserProfile(author) : undefined,
    liked: false,
    likesCount: 0,
    photos,
    reviews: [],
  });

  upsertSpot(nextSpot);
  return nextSpot;
}

export function updateMockSpot(spotId: string, submission: SpotFormSubmission, author?: UserProfile | null): SpotDetail {
  const existingSpot = mockSpotDetails[spotId];
  if (!existingSpot) {
    throw new Error(`Spot ${spotId} not found`);
  }

  const sanitizedSubmission = sanitizeSpotFormSubmission(submission);
  const photos = mapSubmissionPhotos(sanitizedSubmission, sanitizedSubmission.spot.title);
  const updatedSpot = sanitizeSpotDetail({
    ...existingSpot,
    title: sanitizedSubmission.spot.title,
    description: sanitizedSubmission.spot.description,
    latitude: sanitizedSubmission.spot.latitude,
    longitude: sanitizedSubmission.spot.longitude,
    address: sanitizedSubmission.spot.address,
    city: sanitizedSubmission.spot.city,
    country: sanitizedSubmission.spot.country,
    category: sanitizedSubmission.spot.category,
    vibe: sanitizedSubmission.spot.vibe,
    rating: sanitizedSubmission.spot.rating,
    photoUrl: photos[0]?.url,
    author: existingSpot.author ?? (author ? sanitizeUserProfile(author) : undefined),
    photos,
  });

  upsertSpot(updatedSpot);
  return updatedSpot;
}

export function getSpotById(spotId: string): SpotDetail | undefined {
  const spot = mockSpotDetails[spotId];
  return spot ? sanitizeSpotDetail(spot) : undefined;
}

export function getTripById(tripId: string): Trip | undefined {
  const trip = mockTrips.find((entry) => entry.id === tripId);
  return trip ? sanitizeTrip(trip) : undefined;
}

export function filterSpots(filters: { category?: SpotCategory | ''; city?: string; vibe?: string }): SpotSummary[] {
  const normalizedCity = sanitizeSingleLineText(filters.city).toLowerCase();
  const normalizedVibe = sanitizeSingleLineText(filters.vibe).toLowerCase();

  return mockSpots.filter((spot) => {
    const matchesCategory = !filters.category || spot.category === filters.category;
    const matchesCity = !normalizedCity || spot.city?.toLowerCase().includes(normalizedCity);
    const matchesVibe = !normalizedVibe || spot.vibe?.toLowerCase().includes(normalizedVibe);
    return matchesCategory && matchesCity && matchesVibe;
  });
}

export function buildItineraryPreview(input: TripPlannerInput): Itinerary {
  const sanitizedInput = sanitizeTripPlannerInput(input);
  const interests = new Set(sanitizedInput.interests);
  const scoredSpots = mockSpots
    .map((spot) => ({
      spot,
      score:
        (interests.has(spot.category) ? 3 : 0) +
        spot.rating +
        (spot.likesCount ?? 0) / 100,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(2, Math.min(6, sanitizedInput.groupSize + 2)));

  const dailyPace = sanitizedInput.pace === 'relaxed' ? 2 : sanitizedInput.pace === 'packed' ? 4 : 3;
  const days: Itinerary['days'] = [];
  const start = new Date(sanitizedInput.startDate);

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
      photoUrl: spot.photoUrl,
      city: spot.city,
      dayNumber: dayIndex + 1,
      notes: `Strong ${spot.category} fit for a ${sanitizedInput.pace} pace route.`,
    });
  });

  const totalEstimatedCost = days.flatMap((day) => day.spots).reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);

  return sanitizeItinerary({
    id: `itinerary-${sanitizedInput.destination.replace(/\s+/g, '-').toLowerCase()}`,
    destination: sanitizedInput.destination,
    days,
    totalEstimatedCost,
    weatherForecast: 'Clear skies with mild evening temps.',
  });
}
