import type {
  FeedItem,
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
  TripMember,
  TripPlannerInput,
  TripSpot,
  UserProfile,
} from '@/types';
import { DEFAULT_MAP_STYLE } from '@/services/mapboxLoader';
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
import { addCalendarDays, getInclusiveDaySpan } from '@/utils/formatters';
import { buildPravatarAvatarUrl } from '@/utils/travelMedia';
import { demoFeed, demoNotifications, demoSpotDetails, demoSpots, demoTrips, demoUsers, demoViewport } from '@/mock';
import { DEMO_MODE_ENABLED } from '@/services/demoMode';
import { buildTripPlannerPresetItinerary } from '@/services/tripPlannerPresets';

const users: UserProfile[] = [
  {
    id: 'user-1',
    username: 'scope-preview',
    email: 'traveler@preview.scope.local',
    displayName: 'Scope traveler',
    avatarUrl: buildPravatarAvatarUrl(12),
    bio: 'Sample preview profile used until a real account connects.',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  },
  {
    id: 'user-2',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Chen',
    avatarUrl: buildPravatarAvatarUrl(32),
    bio: 'Weekend explorer chasing river walks, gardens, and premium museum stops.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: { spots: 28, trips: 6, friends: 84 },
  },
  {
    id: 'user-3',
    username: 'elijah',
    email: 'elijah@example.com',
    displayName: 'Elijah Brooks',
    avatarUrl: buildPravatarAvatarUrl(45),
    bio: 'Adventure-first trip planner with a thing for steep hikes, vinyl rooms, and strong coffee.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: { spots: 36, trips: 11, friends: 64 },
  },
];

const friendRequestUsers: UserProfile[] = [
  {
    id: 'user-4',
    username: 'sofia.ramirez',
    email: 'sofia.ramirez@showcase.scope.local',
    displayName: 'Sofia Ramirez',
    avatarUrl: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for market mornings, heritage districts, and food-led itineraries.',
    homeBase: 'San Antonio, TX',
    interests: ['food', 'culture', 'shopping'],
    stats: { spots: 19, trips: 4, friends: 42 },
  },
  {
    id: 'user-5',
    username: 'jordan.reed',
    email: 'jordan.reed@showcase.scope.local',
    displayName: 'Jordan Reed',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for scenic overlooks, rail stations, and daylight-efficient routes.',
    homeBase: 'Denver, CO',
    interests: ['scenic', 'nature', 'adventure'],
    stats: { spots: 24, trips: 5, friends: 38 },
  },
  {
    id: 'user-13',
    username: 'aishabello',
    email: 'aisha@example.com',
    displayName: 'Aisha Bello',
    avatarUrl: buildPravatarAvatarUrl(47),
    bio: 'Curating culture-heavy city routes with rooftop dinners, galleries, and boutique hotels.',
    homeBase: 'Houston, TX',
    interests: ['culture', 'food', 'shopping'],
    stats: { spots: 31, trips: 7, friends: 56 },
  },
];

const networkUsers: UserProfile[] = [
  {
    id: 'user-6',
    username: 'priyanair',
    email: 'priya@example.com',
    displayName: 'Priya Nair',
    avatarUrl: buildPravatarAvatarUrl(14),
    bio: 'Collecting sunrise walks, boutique stays, and polished café stops with camera-ready light.',
    homeBase: 'Mexico City, MX',
    interests: ['adventure', 'scenic', 'food'],
    stats: { spots: 48, trips: 12, friends: 94 },
  },
  {
    id: 'user-7',
    username: 'theoalvarez',
    email: 'theo@example.com',
    displayName: 'Theo Alvarez',
    avatarUrl: buildPravatarAvatarUrl(19),
    bio: 'Mapping nightlife weekends and the best late-checkout brunches after every set.',
    homeBase: 'Barcelona, ES',
    interests: ['nightlife', 'food', 'culture'],
    stats: { spots: 27, trips: 9, friends: 73 },
  },
  {
    id: 'user-8',
    username: 'camillelaurent',
    email: 'camille@example.com',
    displayName: 'Camille Laurent',
    avatarUrl: buildPravatarAvatarUrl(41),
    bio: 'Design museums, hidden courtyards, and elegant retail lanes are always on my route.',
    homeBase: 'Paris, FR',
    interests: ['culture', 'shopping', 'scenic'],
    stats: { spots: 35, trips: 10, friends: 81 },
  },
  {
    id: 'user-9',
    username: 'noahkim',
    email: 'noah@example.com',
    displayName: 'Noah Kim',
    avatarUrl: buildPravatarAvatarUrl(57),
    bio: 'Snowy trails, mountain lookouts, and cinematic rail views year-round.',
    homeBase: 'Vancouver, CA',
    interests: ['nature', 'adventure', 'scenic'],
    stats: { spots: 40, trips: 13, friends: 88 },
  },
  {
    id: 'user-10',
    username: 'lucamoretti',
    email: 'luca@example.com',
    displayName: 'Luca Moretti',
    avatarUrl: buildPravatarAvatarUrl(29),
    bio: 'Always scouting elegant coastlines, aperitivo bars, and harbor walks that feel cinematic.',
    homeBase: 'Lisbon, PT',
    interests: ['scenic', 'food', 'nightlife'],
    stats: { spots: 22, trips: 6, friends: 44 },
  },
  {
    id: 'user-11',
    username: 'harpersingh',
    email: 'harper@example.com',
    displayName: 'Harper Singh',
    avatarUrl: buildPravatarAvatarUrl(34),
    bio: 'Finding trailhead cafés, alpine stays, and post-hike design shops.',
    homeBase: 'Denver, CO',
    interests: ['adventure', 'shopping', 'nature'],
    stats: { spots: 29, trips: 8, friends: 51 },
  },
  {
    id: 'user-12',
    username: 'emiliasoto',
    email: 'emilia@example.com',
    displayName: 'Emilia Soto',
    avatarUrl: buildPravatarAvatarUrl(64),
    bio: 'Urban architecture loops, market mornings, and boutique stays with strong coffee.',
    homeBase: 'Buenos Aires, AR',
    interests: ['culture', 'food', 'shopping'],
    stats: { spots: 33, trips: 9, friends: 67 },
  },
];

const allUsers: UserProfile[] = [...users, ...friendRequestUsers, ...networkUsers];

interface ReviewSeed {
  user: UserProfile;
  rating: number;
  comment: string;
  createdAt: string;
}

function buildTripMember(user: UserProfile, status: string): TripMember {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status,
  };
}

const baseSpots: SpotSummary[] = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    description: 'Open-air tacos, frozen palomas, and a downtown skyline that peaks right at blue hour.',
    latitude: 32.7555,
    longitude: -97.3308,
    address: '401 Houston St',
    city: 'Fort Worth',
    country: 'United States',
    category: 'food',
    vibe: 'electric',
    rating: 4.8,
    photoUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-26T20:00:00Z',
    author: users[0],
    liked: true,
    likesCount: 142,
  },
  {
    id: 'spot-2',
    title: 'Botanic River Walk',
    description: 'A shady riverside boardwalk with spring blooms, mirrored water, and soft morning light.',
    latitude: 32.7426,
    longitude: -97.3637,
    address: '3220 Botanic Garden Blvd',
    city: 'Fort Worth',
    country: 'United States',
    category: 'nature',
    vibe: 'calm',
    rating: 4.7,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-24T14:10:00Z',
    author: users[1],
    liked: false,
    likesCount: 88,
  },
  {
    id: 'spot-3',
    title: 'Midnight Vinyl Club',
    description: 'A velvet-lit listening room with live DJs, strong cocktails, and a packed late-night floor.',
    latitude: 32.7831,
    longitude: -96.7822,
    address: '2626 Main St',
    city: 'Dallas',
    country: 'United States',
    category: 'nightlife',
    vibe: 'moody',
    rating: 4.6,
    photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-21T23:40:00Z',
    author: users[2],
    liked: true,
    likesCount: 97,
  },
  {
    id: 'spot-4',
    title: 'Modern Art Garden',
    description: 'Sculpture lawns, reflective pools, and a quiet architecture break between downtown stops.',
    latitude: 30.2674,
    longitude: -97.7485,
    address: '705 Congress Ave',
    city: 'Austin',
    country: 'United States',
    category: 'culture',
    vibe: 'curated',
    rating: 4.7,
    photoUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-20T16:05:00Z',
    author: users[1],
    liked: false,
    likesCount: 79,
  },
  {
    id: 'spot-5',
    title: 'Cliffside Lookout Loop',
    description: 'A steep golden-hour loop with limestone ridges, windy overlooks, and a big summit payoff.',
    latitude: 30.3214,
    longitude: -97.7731,
    address: '3800 Mount Bonnell Rd',
    city: 'Austin',
    country: 'United States',
    category: 'adventure',
    vibe: 'wild',
    rating: 4.9,
    photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-18T18:45:00Z',
    author: users[2],
    liked: true,
    likesCount: 136,
  },
  {
    id: 'spot-6',
    title: 'Design District Gallery Row',
    description: 'Boutique storefronts, terrazzo cafés, and polished retail lanes made for a slower afternoon.',
    latitude: 30.2498,
    longitude: -97.7493,
    address: '1010 South Congress Ave',
    city: 'Austin',
    country: 'United States',
    category: 'shopping',
    vibe: 'luxury',
    rating: 4.5,
    photoUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-17T13:15:00Z',
    author: networkUsers[2],
    liked: false,
    likesCount: 84,
  },
  {
    id: 'spot-7',
    title: 'Trinity Bluff Sunrise',
    description: 'A river-facing bluff where first light hits the skyline and the whole city feels cinematic.',
    latitude: 32.7551,
    longitude: -97.3524,
    address: '2500 White Settlement Rd',
    city: 'Fort Worth',
    country: 'United States',
    category: 'scenic',
    vibe: 'cinematic',
    rating: 4.9,
    photoUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-16T11:20:00Z',
    author: networkUsers[3],
    liked: true,
    likesCount: 123,
  },
  {
    id: 'spot-8',
    title: 'Railcar Market Hall',
    description: 'A converted depot with indie makers, a coffee bar, and enough room to reset between neighborhoods.',
    latitude: 32.7899,
    longitude: -96.8065,
    address: '1401 Commerce St',
    city: 'Dallas',
    country: 'United States',
    category: 'other',
    vibe: 'social',
    rating: 4.4,
    photoUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80',
    createdAt: '2026-03-15T12:25:00Z',
    author: networkUsers[0],
    liked: false,
    likesCount: 67,
  },
];

const spotDetailPhotoSets: Record<string, Array<{ url: string; caption: string }>> = {
  'spot-1': [
    { url: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1600&q=80', caption: 'Rooftop taco spread at sunset' },
    { url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80', caption: 'Open-air dining angle' },
    { url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1400&q=80', caption: 'Signature taco trio' },
    { url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1400&q=80', caption: 'Cocktail bar glow' },
    { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80', caption: 'Late-night dinner crowd' },
  ],
  'spot-2': [
    { url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80', caption: 'River walk hero frame' },
    { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80', caption: 'Morning canopy light' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80', caption: 'Tree-lined trail segment' },
    { url: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1400&q=80', caption: 'Quiet boardwalk section' },
    { url: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1400&q=80', caption: 'Footbridge through the gardens' },
  ],
  'spot-3': [
    { url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80', caption: 'Dance floor hero frame' },
    { url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80', caption: 'Neon-lit crowd energy' },
    { url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80', caption: 'DJ booth close-up' },
    { url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80', caption: 'Live session setup' },
    { url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80', caption: 'After-dark street arrival' },
  ],
  'spot-4': [
    { url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1600&q=80', caption: 'Garden gallery hero view' },
    { url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80', caption: 'Sculpture courtyard detail' },
    { url: 'https://images.unsplash.com/photo-1491156855053-9cdff72c7f85?auto=format&fit=crop&w=1400&q=80', caption: 'Reflective pool composition' },
    { url: 'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=1400&q=80', caption: 'Architectural walkway lines' },
    { url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80', caption: 'Museum district pairing' },
  ],
  'spot-5': [
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80', caption: 'Cliffside hero view' },
    { url: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?auto=format&fit=crop&w=1400&q=80', caption: 'Ridgeline trail approach' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80', caption: 'Mountain pass perspective' },
    { url: 'https://images.unsplash.com/photo-1464820453369-31d2c0b651af?auto=format&fit=crop&w=1400&q=80', caption: 'Switchback detail' },
    { url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1400&q=80', caption: 'Golden-hour payoff' },
  ],
  'spot-6': [
    { url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80', caption: 'Gallery row storefronts' },
    { url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80', caption: 'Retail lane with big windows' },
    { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1400&q=80', caption: 'Coffee stop between shops' },
    { url: 'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1400&q=80', caption: 'Limited-run fashion pop-up' },
    { url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=80', caption: 'Window display detail' },
  ],
  'spot-7': [
    { url: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1600&q=80', caption: 'Sunrise overlook hero shot' },
    { url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80', caption: 'Mist lifting off the river' },
    { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80', caption: 'Wide skyline panorama' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80', caption: 'Trail approach through brush' },
    { url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80', caption: 'Blue-hour city lights' },
  ],
  'spot-8': [
    { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80', caption: 'Converted depot hero frame' },
    { url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1400&q=80', caption: 'Market aisle with ambient lighting' },
    { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80', caption: 'Coffee and pastry stop' },
    { url: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=1400&q=80', caption: 'Maker booths and textures' },
    { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80', caption: 'Live set in the hall' },
  ],
};

const spotReviewSeeds: Record<string, ReviewSeed[]> = {
  'spot-1': [
    {
      user: users[1],
      rating: 4.9,
      comment: 'Booked the first rooftop seating of the evening and the skyline really does flip from gold to navy in one perfect meal.',
      createdAt: '2026-03-26T22:00:00Z',
    },
    {
      user: friendRequestUsers[2],
      rating: 4.7,
      comment: 'Great anchor stop before a downtown culture crawl. Service was fast and the tacos travelled surprisingly well for a shared order.',
      createdAt: '2026-03-25T20:15:00Z',
    },
    {
      user: networkUsers[4],
      rating: 4.8,
      comment: 'Exactly the kind of dinner-to-nightlife handoff Scope routes need — strong food, better views, zero friction.',
      createdAt: '2026-03-24T18:45:00Z',
    },
  ],
  'spot-2': [
    {
      user: users[0],
      rating: 4.8,
      comment: 'Best if you get there before 9am. The water stays glassy, the boardwalk is quiet, and every turn feels photo-ready.',
      createdAt: '2026-03-26T14:20:00Z',
    },
    {
      user: networkUsers[3],
      rating: 4.6,
      comment: 'A mellow reset between city stops. We paired it with coffee nearby and kept far more daylight than expected.',
      createdAt: '2026-03-24T16:05:00Z',
    },
    {
      user: friendRequestUsers[0],
      rating: 4.7,
      comment: 'The blooms and footbridges make it feel bigger than the route length suggests. Ideal for a relaxed first pin of the day.',
      createdAt: '2026-03-23T10:30:00Z',
    },
  ],
  'spot-3': [
    {
      user: users[0],
      rating: 4.6,
      comment: 'Sound system is dialed in, the crowd actually dances, and the room still feels intimate enough to talk between sets.',
      createdAt: '2026-03-25T23:40:00Z',
    },
    {
      user: networkUsers[1],
      rating: 4.7,
      comment: 'The vinyl programming is the real differentiator. It feels curated instead of just loud, which is rare.',
      createdAt: '2026-03-24T23:05:00Z',
    },
    {
      user: networkUsers[6],
      rating: 4.5,
      comment: 'Strong late-night energy and easy to route after dinner. We stayed for one set and somehow closed the place.',
      createdAt: '2026-03-23T21:20:00Z',
    },
  ],
  'spot-4': [
    {
      user: users[2],
      rating: 4.8,
      comment: 'Cleanest pacing reset on the Austin loop. Ten minutes here and the whole weekend feels more intentional.',
      createdAt: '2026-03-24T15:00:00Z',
    },
    {
      user: networkUsers[2],
      rating: 4.7,
      comment: 'Loved the mix of sculpture lawns and quiet benches. Great light until late afternoon for detail shots.',
      createdAt: '2026-03-23T18:05:00Z',
    },
    {
      user: friendRequestUsers[2],
      rating: 4.6,
      comment: 'A culture stop that still feels relaxed. We tucked it between brunch and shopping and it fit perfectly.',
      createdAt: '2026-03-22T12:15:00Z',
    },
  ],
  'spot-5': [
    {
      user: users[1],
      rating: 4.9,
      comment: 'The climb is short enough to be friendly but still earns the view. Sunset from the bluff absolutely delivers.',
      createdAt: '2026-03-22T19:10:00Z',
    },
    {
      user: networkUsers[5],
      rating: 4.8,
      comment: 'Perfect adventure slot for a packed day. We finished with just enough energy left for dinner in town.',
      createdAt: '2026-03-21T17:25:00Z',
    },
    {
      user: networkUsers[3],
      rating: 4.9,
      comment: 'One of those lookout routes where every switchback hints at the payoff. Bring water and stay for the changing light.',
      createdAt: '2026-03-20T20:05:00Z',
    },
  ],
  'spot-6': [
    {
      user: users[1],
      rating: 4.6,
      comment: 'Easy place to spend a slow afternoon. The café stop in the middle makes the whole strip feel intentionally paced.',
      createdAt: '2026-03-21T16:15:00Z',
    },
    {
      user: networkUsers[2],
      rating: 4.5,
      comment: 'Good mix of independent fashion, clean architecture, and enough seating to actually relax between stores.',
      createdAt: '2026-03-20T14:30:00Z',
    },
    {
      user: friendRequestUsers[0],
      rating: 4.4,
      comment: 'A polished shopping stop that still feels local. Loved how easy it was to pair with nearby coffee and lunch.',
      createdAt: '2026-03-19T12:45:00Z',
    },
  ],
  'spot-7': [
    {
      user: users[0],
      rating: 5,
      comment: 'Pulled up before sunrise and the skyline reflection on the river looked unreal. This is the morning pin to beat.',
      createdAt: '2026-03-20T12:00:00Z',
    },
    {
      user: networkUsers[3],
      rating: 4.8,
      comment: 'Blue-hour city views with almost no crowd when we arrived. Bring a jacket and stay through first light.',
      createdAt: '2026-03-19T13:40:00Z',
    },
    {
      user: networkUsers[4],
      rating: 4.9,
      comment: 'Worth setting an alarm for. The overlook gives you the city, the river, and enough quiet to actually enjoy both.',
      createdAt: '2026-03-18T11:05:00Z',
    },
  ],
  'spot-8': [
    {
      user: users[2],
      rating: 4.5,
      comment: 'Great in-between stop when you want coffee, people-watching, and a few design finds without committing to a full shopping block.',
      createdAt: '2026-03-19T18:10:00Z',
    },
    {
      user: networkUsers[0],
      rating: 4.4,
      comment: 'The converted-station architecture is the hook, but the espresso bar and live set programming keep you there longer than planned.',
      createdAt: '2026-03-18T17:25:00Z',
    },
    {
      user: friendRequestUsers[1],
      rating: 4.3,
      comment: 'Perfect flex stop when your group wants different things. We split up for coffee, books, and vinyl and all left happy.',
      createdAt: '2026-03-17T19:45:00Z',
    },
  ],
};

function buildReviews(spotId: string): Review[] {
  const seeds = spotReviewSeeds[spotId] ?? [
    {
      user: users[1],
      rating: 4.7,
      comment: 'Premium pacing, strong visuals, and easy to build into a full Scope day.',
      createdAt: '2026-03-26T22:00:00Z',
    },
  ];

  return seeds.map((review, index) => ({
    id: `${spotId}-review-${index + 1}`,
    spotId,
    user: review.user,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  }));
}

function buildDetail(spot: SpotSummary): SpotDetail {
  const detailPhotos = (spotDetailPhotoSets[spot.id] ?? [
    { url: spot.photoUrl ?? '', caption: 'Primary hero shot' },
  ]).map((photo, index) => sanitizePhoto({
    id: `${spot.id}-photo-${index + 1}`,
    url: photo.url,
    caption: photo.caption,
  }));

  return {
    ...spot,
    photoUrl: spot.photoUrl ?? detailPhotos[0]?.url,
    photos: detailPhotos,
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
        date: addCalendarDays(options.startDate, dayNumber - 1),
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
  buildTripSpot(baseSpots[1], {
    dayNumber: 1,
    timeSlot: '09:00',
    duration: 70,
    estimatedCost: 0,
    notes: 'Start slow with river light and enough margin for coffee before lunch.',
  }),
  buildTripSpot(baseSpots[0], {
    dayNumber: 1,
    timeSlot: '12:30',
    duration: 85,
    estimatedCost: 28,
    notes: 'Make the rooftop lunch the social anchor for the first day.',
  }),
  buildTripSpot(baseSpots[6], {
    dayNumber: 1,
    timeSlot: '18:40',
    duration: 60,
    estimatedCost: 0,
    notes: 'Golden hour from the bluff is the visual crescendo before evening drinks.',
  }),
  buildTripSpot(baseSpots[7], {
    dayNumber: 2,
    timeSlot: '11:00',
    duration: 80,
    estimatedCost: 24,
    notes: 'Use the market hall as a flexible reset stop between neighborhoods.',
  }),
  buildTripSpot(baseSpots[2], {
    dayNumber: 2,
    timeSlot: '20:30',
    duration: 120,
    estimatedCost: 46,
    notes: 'Close the route once the vinyl room hits peak energy.',
  }),
];

const austinTripSpots: TripSpot[] = [
  buildTripSpot(baseSpots[4], {
    dayNumber: 1,
    timeSlot: '08:15',
    duration: 120,
    estimatedCost: 12,
    notes: 'Hit the overlook early before the trail warms up and the light gets harsh.',
  }),
  buildTripSpot(baseSpots[3], {
    dayNumber: 1,
    timeSlot: '13:00',
    duration: 95,
    estimatedCost: 18,
    notes: 'Recover with architecture, sculpture, and a slower design-forward pace.',
  }),
  buildTripSpot(baseSpots[5], {
    dayNumber: 2,
    timeSlot: '11:30',
    duration: 90,
    estimatedCost: 34,
    notes: 'Reserve the gallery row for coffee, shopping, and gifts before heading home.',
  }),
];

const weekendCityTripSpots: TripSpot[] = [
  buildTripSpot(baseSpots[1], {
    dayNumber: 1,
    timeSlot: '08:45',
    duration: 60,
    estimatedCost: 0,
    notes: 'Ease into the day with a scenic walk and clean morning light.',
  }),
  buildTripSpot(baseSpots[6], {
    dayNumber: 1,
    timeSlot: '10:30',
    duration: 55,
    estimatedCost: 0,
    notes: 'Short climb, huge payoff, and the strongest skyline frame in the city.',
  }),
  buildTripSpot(baseSpots[0], {
    dayNumber: 1,
    timeSlot: '12:30',
    duration: 75,
    estimatedCost: 24,
    notes: 'Lunch anchor with a strong Scope cover-photo moment.',
  }),
  buildTripSpot(baseSpots[7], {
    dayNumber: 1,
    timeSlot: '16:30',
    duration: 80,
    estimatedCost: 22,
    notes: 'Finish with a flexible hall stop for coffee, records, and one last reset.',
  }),
];

const northTexasItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-1',
  destination: 'Fort Worth + Dallas',
  startDate: '2026-04-01',
  spots: northTexasTripSpots,
  weatherForecast: 'Sunny, 75°F with a clear blue-hour finish.',
});

const austinItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-2',
  destination: 'Austin, TX',
  startDate: '2026-04-10',
  spots: austinTripSpots,
  weatherForecast: 'Warm morning, breezy ridge lines, and a mild evening.',
});

const weekendCityItinerary = buildItineraryFromTripSpots({
  id: 'itinerary-3',
  destination: 'Fort Worth, TX',
  startDate: '2026-05-14',
  spots: weekendCityTripSpots,
  weatherForecast: 'Clear skies with crisp sunrise light and a golden-hour close.',
});

const trips: Trip[] = [
  {
    id: 'trip-1',
    title: 'North Texas Night + Food Loop',
    destination: 'Fort Worth, TX',
    description: 'Two days of river walks, rooftop tacos, skyline overlooks, and a final vinyl-club finish sequenced for a premium downtown circuit.',
    isPublic: true,
    startDate: '2026-04-01',
    endDate: '2026-04-02',
    spots: northTexasTripSpots,
    members: [
      buildTripMember(users[0], 'owner'),
      buildTripMember(users[1], 'editor'),
      buildTripMember(friendRequestUsers[2], 'viewer'),
    ],
    itinerary: northTexasItinerary,
    /* Rooftop food + skyline matches the trip name; avoid scenic water stock that reads as “beach”. */
    coverImageUrl: baseSpots[0].photoUrl,
    budget: 340,
    currency: 'USD',
    status: 'planning',
  },
  {
    id: 'trip-2',
    title: 'Austin Scenic Sprint',
    destination: 'Austin, TX',
    description: 'A two-day mix of limestone views, sculpture lawns, and polished shopping stops with enough margin to keep the pace relaxed.',
    isPublic: true,
    startDate: '2026-04-10',
    endDate: '2026-04-11',
    spots: austinTripSpots,
    members: [
      buildTripMember(users[2], 'owner'),
      buildTripMember(networkUsers[5], 'editor'),
      buildTripMember(networkUsers[2], 'viewer'),
    ],
    itinerary: austinItinerary,
    coverImageUrl: baseSpots[4].photoUrl,
    budget: 220,
    currency: 'USD',
    status: 'planning',
  },
  {
    id: 'trip-3',
    title: 'Weekend City Reset',
    destination: 'Fort Worth, TX',
    description: 'A one-day city reset balancing nature, skyline moments, lunch, and a final market-hall sweep before the evening rush.',
    isPublic: true,
    startDate: '2026-05-14',
    endDate: '2026-05-14',
    spots: weekendCityTripSpots,
    members: [
      buildTripMember(users[1], 'owner'),
      buildTripMember(networkUsers[3], 'editor'),
      buildTripMember(friendRequestUsers[0], 'viewer'),
    ],
    itinerary: weekendCityItinerary,
    coverImageUrl: baseSpots[1].photoUrl,
    budget: 140,
    currency: 'USD',
    status: 'planning',
  },
];

const notifications: NotificationItem[] = [
  {
    id: 'notification-1',
    title: 'Trip member joined',
    body: 'Aisha joined North Texas Night + Food Loop and synced the dinner shortlist.',
    isRead: false,
    createdAt: '2026-03-27T03:00:00Z',
    type: 'trip.member.added',
  },
  {
    id: 'notification-2',
    title: 'Spot liked',
    body: 'Elijah liked Sunset Rooftop Tacos and saved it into his Austin-to-Dallas route.',
    isRead: true,
    createdAt: '2026-03-26T21:14:00Z',
    type: 'spot.liked',
  },
  {
    id: 'notification-3',
    title: 'Review posted',
    body: 'Maya left a new 4.8-star review on Trinity Bluff Sunrise.',
    isRead: false,
    createdAt: '2026-03-26T15:20:00Z',
    type: 'spot.reviewed',
  },
  {
    id: 'notification-4',
    title: 'Friend request accepted',
    body: 'Sofia accepted your request and shared a brunch-heavy San Antonio guide.',
    isRead: true,
    createdAt: '2026-03-25T17:45:00Z',
    type: 'friend.accepted',
  },
];

const feed: FeedItem[] = [
  {
    id: 'feed-1',
    type: 'spot',
    actor: users[1],
    title: 'Maya pinned Botanic River Walk',
    excerpt: 'Golden-hour river light, low-crowd boardwalks, and a premium scenic reset for any Fort Worth route.',
    createdAt: '2026-03-27T00:20:00Z',
    imageUrl: baseSpots[1].photoUrl,
    targetId: baseSpots[1].id,
  },
  {
    id: 'feed-2',
    type: 'trip',
    actor: {
      ...users[0],
      username: 'milescarter',
      email: 'miles@example.com',
      displayName: 'Miles Carter',
    },
    title: 'Miles planned North Texas Night + Food Loop',
    excerpt: 'A two-day itinerary built around rooftop lunches, skyline overlooks, and a vinyl-club close.',
    createdAt: '2026-03-26T18:05:00Z',
    imageUrl: trips[0].coverImageUrl,
    targetId: trips[0].id,
  },
  {
    id: 'feed-3',
    type: 'spot',
    actor: networkUsers[3],
    title: 'Noah pinned Trinity Bluff Sunrise',
    excerpt: 'First light over the river, zero crowd pressure, and the cleanest skyline frame in the whole city.',
    createdAt: '2026-03-26T13:40:00Z',
    imageUrl: baseSpots[6].photoUrl,
    targetId: baseSpots[6].id,
  },
  {
    id: 'feed-4',
    type: 'trip',
    actor: users[2],
    title: 'Elijah planned Austin Scenic Sprint',
    excerpt: 'Short hikes, sculpture lawns, and a polished shopping close with minimal backtracking.',
    createdAt: '2026-03-25T21:35:00Z',
    imageUrl: trips[1].coverImageUrl,
    targetId: trips[1].id,
  },
  {
    id: 'feed-5',
    type: 'spot',
    actor: networkUsers[0],
    title: 'Priya pinned Railcar Market Hall',
    excerpt: 'Coffee, design finds, and live-set energy in a converted depot that works for almost any group.',
    createdAt: '2026-03-24T19:25:00Z',
    imageUrl: baseSpots[7].photoUrl,
    targetId: baseSpots[7].id,
  },
];

const defaultViewport: MapViewport = {
  center: [-97.0, 32.9],
  zoom: 7,
  style: DEFAULT_MAP_STYLE,
};

const defaultMockUsers = allUsers.map((user) => sanitizeUserProfile(user, { allowGeneratedAvatar: true }));
const defaultMockSpots = baseSpots.map((spot) =>
  sanitizeSpotSummary(spot, { allowGeneratedAuthorAvatar: true }),
);
const defaultMockSpotDetails = baseSpots.reduce<Record<string, SpotDetail>>((accumulator, spot) => {
  accumulator[spot.id] = sanitizeSpotDetail(buildDetail(spot), {
    allowGeneratedAuthorAvatar: true,
    allowGeneratedReviewAvatars: true,
  });
  return accumulator;
}, {});
const defaultMockTrips = trips.map((trip) => sanitizeTrip(trip, { allowGeneratedMemberAvatars: true }));
const defaultMockNotifications = notifications.map((notification) => sanitizeNotificationItem(notification));
const defaultMockFeed = feed.map((item) => sanitizeFeedItem(item, { allowGeneratedActorAvatar: true }));

export const mockUsers = DEMO_MODE_ENABLED ? demoUsers : defaultMockUsers;
export const mockSpots = DEMO_MODE_ENABLED ? demoSpots : defaultMockSpots;
export const mockSpotDetails = DEMO_MODE_ENABLED ? demoSpotDetails : defaultMockSpotDetails;
export const mockTrips = DEMO_MODE_ENABLED ? demoTrips : defaultMockTrips;
export const mockNotifications = DEMO_MODE_ENABLED ? demoNotifications : defaultMockNotifications;
export const mockFeed = DEMO_MODE_ENABLED ? demoFeed : defaultMockFeed;
export const mockViewport = DEMO_MODE_ENABLED ? demoViewport : defaultViewport;

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
    pillars: spot.pillars,
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
    pillars: sanitizedSubmission.spot.pillars,
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
    pillars: sanitizedSubmission.spot.pillars,
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
  return spot
    ? sanitizeSpotDetail(spot, {
      allowGeneratedAuthorAvatar: true,
      allowGeneratedReviewAvatars: true,
    })
    : undefined;
}

export function getTripById(tripId: string): Trip | undefined {
  const trip = mockTrips.find((entry) => entry.id === tripId);
  return trip ? sanitizeTrip(trip, { allowGeneratedMemberAvatars: true }) : undefined;
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

function buildPlannerRouteLabel(input: TripPlannerInput): string {
  const startDestination = input.destination.trim();
  const endDestination = input.endDestination?.trim();

  return endDestination ? `${startDestination} to ${endDestination}` : startDestination;
}

export function buildItineraryPreview(input: TripPlannerInput): Itinerary {
  const sanitizedInput = sanitizeTripPlannerInput(input);
  const presetItinerary = buildTripPlannerPresetItinerary(sanitizedInput);

  if (presetItinerary) {
    return sanitizeItinerary(presetItinerary);
  }

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
  const totalDays = getInclusiveDaySpan(sanitizedInput.startDate, sanitizedInput.endDate);
  const days: Itinerary['days'] = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: addCalendarDays(sanitizedInput.startDate, index),
    spots: [],
  }));

  scoredSpots.forEach(({ spot }, index) => {
    const dayIndex = Math.min(Math.floor(index / dailyPace), Math.max(0, totalDays - 1));
    const day = days[dayIndex];
    if (!day) {
      return;
    }

    day.spots.push({
      spotId: spot.id,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      timeSlot: ['09:00', '12:00', '15:00', '19:00'][day.spots.length] ?? '20:00',
      duration: 90,
      estimatedCost: 20 + index * 8,
      photoUrl: spot.photoUrl,
      city: spot.city,
      dayNumber: dayIndex + 1,
      notes: `Strong ${spot.category} fit for a ${sanitizedInput.pace} pace route.`,
    });
  });

  const totalEstimatedCost = days.flatMap((day) => day.spots).reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);

  const routeLabel = buildPlannerRouteLabel(sanitizedInput);

  return sanitizeItinerary({
    id: `itinerary-${routeLabel.replace(/\s+/g, '-').toLowerCase()}`,
    destination: routeLabel,
    days,
    totalEstimatedCost,
    weatherForecast: 'Clear skies with mild evening temps.',
  });
}
