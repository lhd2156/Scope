import type { Page, Request, Route } from '@playwright/test';
import { expect as baseExpect, test as base } from './coverage-test';

const VISUAL_QA_FLAG = '__SCOPE_VISUAL_QA__';
const DEFAULT_PASSWORD = 'SecurePass123!';
const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
const AUTH_SESSION_HINT_CHANGE_EVENT = 'scope-auth-session-hint-change';
const AUTH_SESSION_HINT_VERSION = 1;
const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'scope-auth-refresh-token-v1';
const ANALYTICS_CONSENT_STORAGE_KEY = 'scope-analytics-consent';
const ANALYTICS_CONSENT_VALUE = 'denied';
const ONBOARDING_COMPLETION_STORAGE_KEY = 'scope-onboarding-completed-v1';
const ONBOARDING_COMPLETION_VALUE = 'completed';
const PLAYWRIGHT_SESSION_COOKIE_NAME = 'scope-playwright-session';
const DEFAULT_APP_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

interface ScopeAuthSession {
  id: string;
  username: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

interface ScopeUserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests: string[];
  showActivityStatus?: boolean;
  stats?: {
    spots: number;
    trips: number;
    friends: number;
  };
}

type ScopeSpotCategory = 'food' | 'nature' | 'nightlife' | 'culture' | 'adventure' | 'shopping' | 'entertainment' | 'scenic' | 'other';
type ScopeSpotVerificationStatus = 'legacy' | 'unverified' | 'verified' | 'rejected';
type ScopeSpotSafetyStatus = 'legacy' | 'clean' | 'blocked';

interface ScopePhoto {
  id: string;
  url: string;
  caption?: string;
}

interface ScopeReview {
  id: string;
  spotId: string;
  user: ScopeUserProfile;
  rating: number;
  comment: string;
  createdAt: string;
  sentiment_score?: number | null;
}

interface ScopeSpotSummary {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  category: ScopeSpotCategory;
  pillars?: string[];
  vibe?: string;
  rating: number;
  photoUrl?: string;
  createdAt: string;
  isPublic?: boolean;
  author?: ScopeUserProfile;
  liked?: boolean;
  likesCount?: number;
  verificationStatus?: ScopeSpotVerificationStatus;
  verificationSource?: string;
  providerPlaceId?: string;
  providerPlaceName?: string;
  providerPlaceAddress?: string;
  verificationDistanceMeters?: number | null;
  verifiedAt?: string | null;
  safetyStatus?: ScopeSpotSafetyStatus;
  safetyReason?: string;
}

interface ScopeSpotDetail extends ScopeSpotSummary {
  photos: ScopePhoto[];
  reviews: ScopeReview[];
}

interface ScopeTripSpot {
  spotId: string;
  title: string;
  latitude: number;
  longitude: number;
  category: string;
  city?: string;
  dayNumber?: number;
  timeSlot?: string;
  duration?: number;
  estimatedCost?: number;
  photoUrl?: string;
  notes?: string;
}

interface ScopeTripMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status?: string;
  inviteStatus?: string;
  presence?: string;
}

interface ScopeItineraryDay {
  dayNumber: number;
  date: string;
  spots: ScopeTripSpot[];
}

interface ScopeItinerary {
  id: string;
  destination: string;
  days: ScopeItineraryDay[];
  totalEstimatedCost: number;
  weatherForecast: string;
}

interface ScopeTrip {
  id: string;
  title: string;
  destination: string;
  description?: string;
  isPublic: boolean;
  startDate: string;
  endDate: string;
  spots: ScopeTripSpot[];
  members: ScopeTripMember[];
  itinerary?: ScopeItinerary;
  coverImageUrl?: string;
  budget?: number;
  currency?: string;
  status?: string;
}

interface ScopeFeedItem {
  id: string;
  type: 'spot' | 'trip';
  actor: ScopeUserProfile;
  title: string;
  excerpt: string;
  createdAt: string;
  imageUrl?: string;
  targetId: string;
}

interface ScopeNotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

interface ScopeNotificationPreference {
  id: string;
  category: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  digestCadence: 'instant' | 'daily' | 'weekly' | 'off';
  quietHoursStartMinutes: number | null;
  quietHoursEndMinutes: number | null;
  timeZoneId: string;
}

interface ScopeFriendConnection {
  id: string;
  user: ScopeUserProfile;
  presence: 'planning' | 'online' | 'idle' | 'offline' | 'hidden';
  sharedTrips: number;
  mutualFriends: number;
  favoriteCategories: ScopeSpotCategory[];
  coverPhotoUrl?: string;
  nextAdventure?: string;
  lastActiveAt: string;
}

interface ScopeFriendRequest {
  id: string;
  user: ScopeUserProfile;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  mutualFriends: number;
  note?: string;
}

interface ScopeFriendSuggestion {
  id: string;
  user: ScopeUserProfile;
  mutualFriends: number;
  sharedInterests: string[];
  favoriteCategories: ScopeSpotCategory[];
  presence: 'planning' | 'online' | 'idle' | 'offline' | 'hidden';
  reason: string;
  score?: number;
}

export interface ScopeApiMock {
  getCurrentSession: () => ScopeAuthSession | null;
  seedSession: (page: Page, overrides?: Partial<ScopeAuthSession>) => Promise<ScopeAuthSession>;
  clearSession: (page: Page) => Promise<void>;
}

const seedUsers: ScopeUserProfile[] = [
  {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    avatarUrl: 'https://i.pravatar.cc/160?img=12',
    bio: 'Collecting rooftop dinners, skyline pins, and story-worthy city nights across Texas.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: {
      spots: 42,
      trips: 8,
      friends: 126,
    },
  },
  {
    id: 'user-2',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Chen',
    avatarUrl: 'https://i.pravatar.cc/160?img=32',
    bio: 'Weekend explorer chasing river walks, gardens, and premium museum stops.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: {
      spots: 28,
      trips: 6,
      friends: 84,
    },
  },
  {
    id: 'user-3',
    username: 'elijah',
    email: 'elijah@example.com',
    displayName: 'Elijah Brooks',
    avatarUrl: 'https://i.pravatar.cc/160?img=45',
    bio: 'Adventure-first trip planner with a thing for steep hikes, vinyl rooms, and strong coffee.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: {
      spots: 36,
      trips: 11,
      friends: 64,
    },
  },
];

function cloneUserProfile(user: ScopeUserProfile): ScopeUserProfile {
  return {
    ...user,
    interests: [...user.interests],
    stats: user.stats ? { ...user.stats } : undefined,
  };
}

function clonePhoto(photo: ScopePhoto): ScopePhoto {
  return {
    ...photo,
  };
}

function cloneReview(review: ScopeReview): ScopeReview {
  return {
    ...review,
    user: cloneUserProfile(review.user),
  };
}

function cloneSpotSummary(spot: ScopeSpotDetail): ScopeSpotSummary {
  const { photos: _photos, reviews: _reviews, ...summary } = spot;
  return {
    ...summary,
    pillars: summary.pillars ? [...summary.pillars] : undefined,
    author: summary.author ? cloneUserProfile(summary.author) : undefined,
  };
}

function cloneSpotDetail(spot: ScopeSpotDetail): ScopeSpotDetail {
  return {
    ...spot,
    pillars: spot.pillars ? [...spot.pillars] : undefined,
    author: spot.author ? cloneUserProfile(spot.author) : undefined,
    photos: spot.photos.map(clonePhoto),
    reviews: spot.reviews.map(cloneReview),
  };
}

function cloneTripSpot(spot: ScopeTripSpot): ScopeTripSpot {
  return {
    ...spot,
  };
}

function cloneTripMember(member: ScopeTripMember): ScopeTripMember {
  return {
    ...member,
  };
}

function cloneItinerary(itinerary: ScopeItinerary): ScopeItinerary {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      spots: day.spots.map(cloneTripSpot),
    })),
  };
}

function cloneTrip(trip: ScopeTrip): ScopeTrip {
  return {
    ...trip,
    spots: trip.spots.map(cloneTripSpot),
    members: trip.members.map(cloneTripMember),
    itinerary: trip.itinerary ? cloneItinerary(trip.itinerary) : undefined,
  };
}

function cloneFeedItem(feedItem: ScopeFeedItem): ScopeFeedItem {
  return {
    ...feedItem,
    actor: cloneUserProfile(feedItem.actor),
  };
}

function cloneNotification(notification: ScopeNotificationItem): ScopeNotificationItem {
  return {
    ...notification,
  };
}

function cloneFriendConnection(connection: ScopeFriendConnection): ScopeFriendConnection {
  return {
    ...connection,
    user: cloneUserProfile(connection.user),
    favoriteCategories: [...connection.favoriteCategories],
  };
}

function cloneFriendRequest(request: ScopeFriendRequest): ScopeFriendRequest {
  return {
    ...request,
    user: cloneUserProfile(request.user),
  };
}

function cloneFriendSuggestion(suggestion: ScopeFriendSuggestion): ScopeFriendSuggestion {
  return {
    ...suggestion,
    user: cloneUserProfile(suggestion.user),
    sharedInterests: [...suggestion.sharedInterests],
    favoriteCategories: [...suggestion.favoriteCategories],
  };
}

const tripTimeSlots = ['08:30', '12:30', '16:30', '19:30'] as const;
const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const patagoniaPlannerStops: ScopeTripSpot[] = [
  {
    spotId: 'planner-fitz-roy',
    title: 'Mount Fitz Roy',
    latitude: -49.2711,
    longitude: -73.0439,
    category: 'adventure',
    city: 'El Chaltén',
    dayNumber: 1,
    timeSlot: '08:30',
    duration: 180,
    estimatedCost: 180,
    photoUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    notes: 'Start with the signature alpine ascent while the granite faces catch first light.',
  },
  {
    spotId: 'planner-perito-moreno',
    title: 'Perito Moreno Glacier',
    latitude: -50.496,
    longitude: -73.1373,
    category: 'scenic',
    city: 'El Calafate',
    dayNumber: 2,
    timeSlot: '12:30',
    duration: 150,
    estimatedCost: 210,
    photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    notes: 'Layer in a glacier cruise and boardwalk loop for the visual crescendo of the route.',
  },
  {
    spotId: 'planner-torres',
    title: 'Torres del Paine',
    latitude: -50.9423,
    longitude: -72.9874,
    category: 'nature',
    city: 'Torres del Paine',
    dayNumber: 3,
    timeSlot: '16:30',
    duration: 210,
    estimatedCost: 240,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
    notes: 'Finish on the iconic towers for the biggest end-of-day payoff and photo set.',
  },
  {
    spotId: 'planner-puerto-natales',
    title: 'Puerto Natales Waterfront',
    latitude: -51.7295,
    longitude: -72.5066,
    category: 'culture',
    city: 'Puerto Natales',
    dayNumber: 2,
    timeSlot: '19:30',
    duration: 90,
    estimatedCost: 95,
    photoUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
    notes: 'A harbor-side recovery stop for dinner, gear checks, and softer cultural pacing.',
  },
  {
    spotId: 'planner-ushuaia',
    title: 'Beagle Channel Outlook',
    latitude: -54.8019,
    longitude: -68.303,
    category: 'scenic',
    city: 'Ushuaia',
    dayNumber: 4,
    timeSlot: '08:30',
    duration: 120,
    estimatedCost: 130,
    photoUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800',
    notes: 'Optional southern extension for a boat ride and dramatic sea-meets-mountain framing.',
  },
];

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readJsonBody(request: Request): Record<string, unknown> {
  try {
    const payload = request.postDataJSON();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function normalizeApiMockPath(pathname: string): string {
  if (pathname.length <= 1) {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

function readMultipartTextField(request: Request, fieldName: string): string {
  const body = request.postData() ?? '';
  const fieldMarker = `name="${fieldName}"`;
  const fieldMarkerIndex = body.indexOf(fieldMarker);

  if (fieldMarkerIndex === -1) {
    return '';
  }

  let headerEndIndex = body.indexOf('\r\n\r\n', fieldMarkerIndex);
  let headerDelimiterLength = 4;

  if (headerEndIndex === -1) {
    headerEndIndex = body.indexOf('\n\n', fieldMarkerIndex);
    headerDelimiterLength = 2;
  }

  if (headerEndIndex === -1) {
    return '';
  }

  const fieldStartIndex = headerEndIndex + headerDelimiterLength;
  let fieldEndIndex = body.indexOf('\r\n--', fieldStartIndex);

  if (fieldEndIndex === -1) {
    fieldEndIndex = body.indexOf('\n--', fieldStartIndex);
  }

  return body.slice(fieldStartIndex, fieldEndIndex === -1 ? undefined : fieldEndIndex).trim();
}

function readMultipartJsonField(request: Request, fieldName: string): Record<string, unknown> {
  const fieldValue = readMultipartTextField(request, fieldName);

  if (!fieldValue) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(fieldValue);
    return isRecord(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
}

function createValidationError(details: Array<{ field: string; message: string }>): string {
  return JSON.stringify({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed.',
      details,
    },
  });
}

function createUnhandledApiError(method: string, path: string): string {
  return JSON.stringify({
    error: {
      code: 'PLAYWRIGHT_API_MOCK',
      message: `No explicit Playwright API mock is configured for ${method} ${path}. The Scope frontend should fall back to its deterministic client-side fixtures for this request.`,
    },
  });
}

function createUnauthorizedError(): string {
  return JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Your Scope session is not active.',
    },
  });
}

function buildAuthSession(overrides: Partial<ScopeAuthSession> = {}): ScopeAuthSession {
  const username = normalizeString(overrides.username) || 'louisdo';
  const email = normalizeString(overrides.email) || `${username}@example.com`;

  return {
    id: normalizeString(overrides.id) || `user-${username}`,
    username,
    email,
    displayName: normalizeString(overrides.displayName) || 'Scope Traveler',
    accessToken: normalizeString(overrides.accessToken) || `playwright-access-${username}`,
    refreshToken: normalizeString(overrides.refreshToken) || `playwright-refresh-${username}`,
  };
}

function buildUserProfile(session: ScopeAuthSession, knownUsers: ScopeUserProfile[]): ScopeUserProfile {
  const matchingKnownUser = knownUsers.find(
    (candidate) =>
      candidate.id === session.id ||
      candidate.username === session.username ||
      candidate.email === session.email,
  );

  return {
    id: session.id,
    username: session.username,
    email: session.email,
    displayName: session.displayName,
    avatarUrl: matchingKnownUser?.avatarUrl ?? 'https://i.pravatar.cc/160?img=12',
    bio: matchingKnownUser?.bio ?? 'Mapping premium city routes with skyline dinners, polished museums, and sunset lookouts.',
    homeBase: matchingKnownUser?.homeBase ?? 'Fort Worth, TX',
    interests: matchingKnownUser?.interests ?? ['food', 'culture', 'nightlife'],
    stats: matchingKnownUser?.stats ?? {
      spots: 12,
      trips: 3,
      friends: 18,
    },
  };
}

function toCalendarDayNumber(value: string): number {
  const matched = calendarDatePattern.exec(value);
  if (!matched) {
    return Number.NaN;
  }

  const [, year, month, day] = matched;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    return Number.NaN;
  }

  return Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()) / (24 * 60 * 60 * 1000);
}

function getInclusiveDaySpan(startDate: string, endDate: string): number {
  const startDayNumber = toCalendarDayNumber(startDate);
  const endDayNumber = toCalendarDayNumber(endDate);

  if (Number.isNaN(startDayNumber) || Number.isNaN(endDayNumber)) {
    return 1;
  }

  return Math.max(1, endDayNumber - startDayNumber + 1);
}

function addCalendarDays(calendarDate: string, offsetDays: number): string {
  const matched = calendarDatePattern.exec(calendarDate);
  if (!matched) {
    return calendarDate;
  }

  const [, year, month, day] = matched;
  const nextDate = new Date(Number(year), Number(month) - 1, Number(day) + offsetDays);
  return [
    nextDate.getFullYear(),
    String(nextDate.getMonth() + 1).padStart(2, '0'),
    String(nextDate.getDate()).padStart(2, '0'),
  ].join('-');
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceInKilometers(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const latitudeA = toRadians(firstLatitude);
  const latitudeB = toRadians(secondLatitude);
  const haversineComponent =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversineComponent));
}

function getPlannerStopCount(totalDays: number, pace: string, availableCount: number): number {
  const extraStops = pace === 'packed' ? 2 : pace === 'moderate' ? 1 : 0;
  return Math.min(availableCount, Math.max(totalDays, totalDays + extraStops));
}

function buildTripPlannerItinerary(requestBody: Record<string, unknown>): ScopeItinerary {
  const destination = normalizeString(requestBody.destination) || 'Patagonia, Chile + Argentina';
  const startDate = normalizeString(requestBody.startDate) || '2026-11-03';
  const endDate = normalizeString(requestBody.endDate) || startDate;
  const pace = normalizeString(requestBody.pace).toLowerCase() || 'moderate';
  const totalDays = Math.max(1, Math.min(getInclusiveDaySpan(startDate, endDate), 30));
  const selectedStopCount = getPlannerStopCount(totalDays, pace, patagoniaPlannerStops.length);
  const selectedStops = patagoniaPlannerStops.slice(0, selectedStopCount).map(cloneTripSpot);
  const days = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: addCalendarDays(startDate, index),
    spots: [] as ScopeTripSpot[],
  }));

  selectedStops.forEach((stop, index) => {
    const dayNumber = index < totalDays ? index + 1 : ((index - totalDays) % totalDays) + 1;
    const stopIndexForDay = days[dayNumber - 1]?.spots.length ?? 0;

    days[dayNumber - 1]?.spots.push({
      ...stop,
      dayNumber,
      timeSlot: tripTimeSlots[stopIndexForDay] ?? '20:00',
    });
  });

  const totalEstimatedCost = days
    .flatMap((day) => day.spots)
    .reduce((total, stop) => total + (stop.estimatedCost ?? 0), 0);

  return {
    id: `itinerary-${destination.replace(/\s+/g, '-').toLowerCase()}`,
    destination,
    days,
    totalEstimatedCost,
    weatherForecast: 'Crisp alpine mornings with clear glacier light.',
  };
}

function buildSeedTrips(knownUsers: ScopeUserProfile[]): ScopeTrip[] {
  const [louis = cloneUserProfile(seedUsers[0]!), maya = cloneUserProfile(seedUsers[1]!), elijah = cloneUserProfile(seedUsers[2]!)] = knownUsers;
  const patagoniaItinerary = buildTripPlannerItinerary({
    destination: 'Patagonia, Chile + Argentina',
    startDate: '2026-11-03',
    endDate: '2026-11-05',
    pace: 'packed',
  });

  return [
    {
      id: 'trip-1',
      title: 'North Texas Night + Food Loop',
      destination: 'Fort Worth, TX',
      description: 'Two days of tacos, skyline views, galleries, and nightlife.',
      isPublic: true,
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      budget: 320,
      currency: 'USD',
      status: 'planning',
      coverImageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200',
      members: [
        { id: louis.id, displayName: louis.displayName, avatarUrl: louis.avatarUrl, status: 'owner' },
        { id: maya.id, displayName: maya.displayName, avatarUrl: maya.avatarUrl, status: 'editor' },
      ],
      spots: [
        {
          spotId: 'spot-1',
          title: 'Sunset Rooftop Tacos',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
          city: 'Fort Worth',
          dayNumber: 1,
          timeSlot: '11:00',
          duration: 75,
          estimatedCost: 24,
          photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
          notes: 'Open with lunch before the city walk.',
        },
        {
          spotId: 'spot-2',
          title: 'Midnight Vinyl Club',
          latitude: 32.7812,
          longitude: -96.8003,
          category: 'nightlife',
          city: 'Dallas',
          dayNumber: 2,
          timeSlot: '20:30',
          duration: 120,
          estimatedCost: 42,
          photoUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
          notes: 'Close with a dance-floor stop.',
        },
      ],
      itinerary: {
        id: 'itinerary-trip-1',
        destination: 'Fort Worth, TX',
        totalEstimatedCost: 66,
        weatherForecast: 'Clear skies with warm city evenings.',
        days: [
          {
            dayNumber: 1,
            date: '2026-04-01',
            spots: [
              {
                spotId: 'spot-1',
                title: 'Sunset Rooftop Tacos',
                latitude: 32.7555,
                longitude: -97.3308,
                category: 'food',
                city: 'Fort Worth',
                dayNumber: 1,
                timeSlot: '11:00',
                duration: 75,
                estimatedCost: 24,
                photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
                notes: 'Open with lunch before the city walk.',
              },
            ],
          },
          {
            dayNumber: 2,
            date: '2026-04-02',
            spots: [
              {
                spotId: 'spot-2',
                title: 'Midnight Vinyl Club',
                latitude: 32.7812,
                longitude: -96.8003,
                category: 'nightlife',
                city: 'Dallas',
                dayNumber: 2,
                timeSlot: '20:30',
                duration: 120,
                estimatedCost: 42,
                photoUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
                notes: 'Close with a dance-floor stop.',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'trip-2',
      title: 'Austin Scenic Sprint',
      destination: 'Austin, TX',
      description: 'Hill-country lookouts, coffee breaks, and golden-hour music stops.',
      isPublic: true,
      startDate: '2026-05-14',
      endDate: '2026-05-16',
      budget: 420,
      currency: 'USD',
      status: 'active',
      coverImageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
      members: [
        { id: maya.id, displayName: maya.displayName, avatarUrl: maya.avatarUrl, status: 'owner' },
        { id: elijah.id, displayName: elijah.displayName, avatarUrl: elijah.avatarUrl, status: 'guide' },
      ],
      spots: [
        {
          spotId: 'spot-3',
          title: 'Mount Bonnell Lookout',
          latitude: 30.3213,
          longitude: -97.7739,
          category: 'scenic',
          city: 'Austin',
          dayNumber: 1,
          timeSlot: '08:00',
          duration: 60,
          estimatedCost: 18,
          photoUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800',
          notes: 'Start with a skyline overview before the coffee crawl.',
        },
      ],
    },
    {
      id: 'trip-3',
      title: 'Epic Patagonia Trek',
      destination: 'Patagonia, Chile + Argentina',
      description: 'Glacier walks, alpine ridgelines, and a premium southbound finale.',
      isPublic: true,
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      budget: 3000,
      currency: 'USD',
      status: 'planning',
      coverImageUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200',
      members: [
        { id: elijah.id, displayName: elijah.displayName, avatarUrl: elijah.avatarUrl, status: 'owner' },
        { id: louis.id, displayName: louis.displayName, avatarUrl: louis.avatarUrl, status: 'lead' },
        { id: maya.id, displayName: maya.displayName, avatarUrl: maya.avatarUrl, status: 'photo' },
      ],
      spots: patagoniaPlannerStops.slice(0, 5).map(cloneTripSpot),
      itinerary: patagoniaItinerary,
    },
  ].map(cloneTrip);
}

function buildSeedNotifications(): ScopeNotificationItem[] {
  return [
    {
      id: 'notification-1',
      title: 'Trip invite',
      body: 'Maya invited you to join North Texas Night + Food Loop for a rooftop-first weekend.',
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
  ].map(cloneNotification);
}

function buildSeedNotificationPreferences(): ScopeNotificationPreference[] {
  return [
    {
      id: 'notification-preference-trip',
      category: 'trip',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: true,
      digestCadence: 'instant',
      quietHoursStartMinutes: null,
      quietHoursEndMinutes: null,
      timeZoneId: 'America/Chicago',
    },
    {
      id: 'notification-preference-social',
      category: 'social',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'daily',
      quietHoursStartMinutes: null,
      quietHoursEndMinutes: null,
      timeZoneId: 'America/Chicago',
    },
    {
      id: 'notification-preference-friend',
      category: 'friend',
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      digestCadence: 'instant',
      quietHoursStartMinutes: null,
      quietHoursEndMinutes: null,
      timeZoneId: 'America/Chicago',
    },
  ];
}

function buildSeedFeed(knownUsers: ScopeUserProfile[]): ScopeFeedItem[] {
  const [louis = cloneUserProfile(seedUsers[0]!), maya = cloneUserProfile(seedUsers[1]!), elijah = cloneUserProfile(seedUsers[2]!)] = knownUsers;

  return [
    {
      id: 'feed-1',
      type: 'spot',
      actor: maya,
      title: 'Maya pinned Botanic River Walk',
      excerpt: 'Golden-hour river light, low-crowd boardwalks, and a premium scenic reset for any Fort Worth route.',
      createdAt: '2026-03-27T00:20:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
      targetId: 'spot-2',
    },
    {
      id: 'feed-2',
      type: 'trip',
      actor: louis,
      title: 'Louis planned North Texas Night + Food Loop',
      excerpt: 'A two-day itinerary built around rooftop lunches, skyline overlooks, and a vinyl-club close.',
      createdAt: '2026-03-26T18:05:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200',
      targetId: 'trip-1',
    },
    {
      id: 'feed-3',
      type: 'spot',
      actor: elijah,
      title: 'Elijah pinned Midnight Vinyl Club',
      excerpt: 'A moody late-night room with strong cocktails, premium sound, and enough energy to anchor the whole evening.',
      createdAt: '2026-03-26T13:40:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200',
      targetId: 'spot-3',
    },
  ].map(cloneFeedItem);
}

function buildSeedSpots(knownUsers: ScopeUserProfile[]): ScopeSpotDetail[] {
  const [louis = cloneUserProfile(seedUsers[0]!), maya = cloneUserProfile(seedUsers[1]!), elijah = cloneUserProfile(seedUsers[2]!)] = knownUsers;
  const verifiedAt = '2026-03-20T17:45:00.000Z';

  const spotSeeds: ScopeSpotDetail[] = [
    {
      id: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      description: 'Open-air tacos, frozen palomas, and a polished skyline angle for golden-hour groups.',
      latitude: 32.7555,
      longitude: -97.3308,
      address: '501 Riverfront Ave',
      city: 'Fort Worth',
      country: 'US',
      postalCode: '76102',
      category: 'food',
      pillars: ['photo-worthy', 'group-friendly', 'date-night'],
      vibe: 'golden rooftop',
      rating: 4.8,
      photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
      createdAt: '2026-03-20T18:00:00.000Z',
      isPublic: true,
      author: louis,
      liked: true,
      likesCount: 42,
      verificationStatus: 'verified',
      verificationSource: 'Google Places fixture',
      providerPlaceId: 'pw-sunset-rooftop-tacos',
      providerPlaceName: 'Sunset Rooftop Tacos',
      providerPlaceAddress: '501 Riverfront Ave, Fort Worth, TX',
      verificationDistanceMeters: 12,
      verifiedAt,
      safetyStatus: 'clean',
      photos: [
        {
          id: 'spot-1-photo-1',
          url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
          caption: 'Rooftop dinner at blue hour',
        },
        {
          id: 'spot-1-photo-2',
          url: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=1200',
          caption: 'Tacos and palomas on the patio',
        },
      ],
      reviews: [
        {
          id: 'spot-1-review-1',
          spotId: 'spot-1',
          user: maya,
          rating: 4.9,
          comment: 'The reviews are real fixture data here: fast service, strong skyline view, and the queso flight was worth building the route around.',
          createdAt: '2026-03-21T01:10:00.000Z',
        },
        {
          id: 'spot-1-review-2',
          spotId: 'spot-1',
          user: elijah,
          rating: 4.7,
          comment: 'Best after sunset. The patio gets loud, but it is exactly the right kind of energy for a public Scope pin.',
          createdAt: '2026-03-22T02:30:00.000Z',
        },
      ],
    },
    {
      id: 'spot-2',
      title: 'Botanic River Walk',
      description: 'Golden-hour river light, low-crowd boardwalks, and a premium scenic reset for any Fort Worth route.',
      latitude: 32.741,
      longitude: -97.3687,
      address: '3220 Botanic Garden Blvd',
      city: 'Fort Worth',
      country: 'US',
      postalCode: '76107',
      category: 'scenic',
      pillars: ['calm', 'photo-worthy', 'solo-friendly'],
      vibe: 'calm green reset',
      rating: 4.7,
      photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
      createdAt: '2026-03-18T15:30:00.000Z',
      isPublic: true,
      author: maya,
      liked: false,
      likesCount: 29,
      verificationStatus: 'verified',
      verificationSource: 'Google Places fixture',
      providerPlaceId: 'pw-botanic-river-walk',
      providerPlaceName: 'Botanic River Walk',
      providerPlaceAddress: '3220 Botanic Garden Blvd, Fort Worth, TX',
      verificationDistanceMeters: 18,
      verifiedAt,
      safetyStatus: 'clean',
      photos: [
        {
          id: 'spot-2-photo-1',
          url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
          caption: 'Boardwalk and garden light',
        },
      ],
      reviews: [
        {
          id: 'spot-2-review-1',
          spotId: 'spot-2',
          user: louis,
          rating: 4.6,
          comment: 'Quiet enough for a reset but still close to food stops. It made the whole day feel less rushed.',
          createdAt: '2026-03-19T19:10:00.000Z',
        },
      ],
    },
    {
      id: 'spot-3',
      title: 'Midnight Vinyl Club',
      description: 'A moody late-night room with strong cocktails, premium sound, and enough energy to anchor the whole evening.',
      latitude: 32.7812,
      longitude: -96.8003,
      address: '1901 Main St',
      city: 'Dallas',
      country: 'US',
      postalCode: '75201',
      category: 'nightlife',
      pillars: ['lively', 'date-night', 'hidden-gem'],
      vibe: 'late vinyl',
      rating: 4.6,
      photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200',
      createdAt: '2026-03-17T23:40:00.000Z',
      isPublic: true,
      author: elijah,
      liked: false,
      likesCount: 33,
      verificationStatus: 'verified',
      verificationSource: 'Google Places fixture',
      providerPlaceId: 'pw-midnight-vinyl-club',
      providerPlaceName: 'Midnight Vinyl Club',
      providerPlaceAddress: '1901 Main St, Dallas, TX',
      verificationDistanceMeters: 21,
      verifiedAt,
      safetyStatus: 'clean',
      photos: [
        {
          id: 'spot-3-photo-1',
          url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200',
          caption: 'Vinyl room and dance floor',
        },
      ],
      reviews: [
        {
          id: 'spot-3-review-1',
          spotId: 'spot-3',
          user: maya,
          rating: 4.5,
          comment: 'Small room, good lighting, and the playlist turned into a full group memory.',
          createdAt: '2026-03-18T04:15:00.000Z',
        },
      ],
    },
    {
      id: 'spot-4',
      title: 'Mount Bonnell Lookout',
      description: 'Short climb, huge payoff, and the strongest skyline frame in Austin before the day warms up.',
      latitude: 30.3213,
      longitude: -97.7739,
      address: '3800 Mount Bonnell Rd',
      city: 'Austin',
      country: 'US',
      postalCode: '78731',
      category: 'adventure',
      pillars: ['worth-the-drive', 'photo-worthy', 'quick-stop'],
      vibe: 'sunrise overlook',
      rating: 4.8,
      photoUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1200',
      createdAt: '2026-03-15T12:00:00.000Z',
      isPublic: true,
      author: elijah,
      liked: true,
      likesCount: 51,
      verificationStatus: 'verified',
      verificationSource: 'Google Places fixture',
      providerPlaceId: 'pw-mount-bonnell-lookout',
      providerPlaceName: 'Mount Bonnell Lookout',
      providerPlaceAddress: '3800 Mount Bonnell Rd, Austin, TX',
      verificationDistanceMeters: 16,
      verifiedAt,
      safetyStatus: 'clean',
      photos: [
        {
          id: 'spot-4-photo-1',
          url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1200',
          caption: 'Austin overlook before the heat',
        },
      ],
      reviews: [
        {
          id: 'spot-4-review-1',
          spotId: 'spot-4',
          user: louis,
          rating: 4.8,
          comment: 'It is the rare quick stop that still feels like a proper route anchor.',
          createdAt: '2026-03-16T13:40:00.000Z',
        },
      ],
    },
  ];

  return spotSeeds.map(cloneSpotDetail);
}

function buildSocialUser(input: {
  id: string;
  username: string;
  displayName: string;
  homeBase: string;
  interests: string[];
  avatarImageId: number;
}): ScopeUserProfile {
  return {
    id: input.id,
    username: input.username,
    email: `${input.username}@example.com`,
    displayName: input.displayName,
    avatarUrl: `https://i.pravatar.cc/160?img=${input.avatarImageId}`,
    bio: `Scope traveler based in ${input.homeBase}.`,
    homeBase: input.homeBase,
    interests: [...input.interests],
    stats: {
      spots: 12,
      trips: 3,
      friends: 18,
    },
  };
}

function buildSeedFriendConnections(knownUsers: ScopeUserProfile[]): ScopeFriendConnection[] {
  const maya = knownUsers.find((user) => user.id === 'user-2') ?? seedUsers[1]!;
  const elijah = knownUsers.find((user) => user.id === 'user-3') ?? seedUsers[2]!;
  const friends: ScopeFriendConnection[] = [
    {
      id: 'connection-maya',
      user: cloneUserProfile(maya),
      presence: 'online',
      sharedTrips: 3,
      mutualFriends: 18,
      favoriteCategories: ['scenic', 'culture'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=640',
      nextAdventure: 'Dallas design loop',
      lastActiveAt: '2026-05-21T18:10:00.000Z',
    },
    {
      id: 'connection-elijah',
      user: cloneUserProfile(elijah),
      presence: 'idle',
      sharedTrips: 2,
      mutualFriends: 11,
      favoriteCategories: ['adventure', 'food'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=640',
      nextAdventure: 'Austin sunrise sprint',
      lastActiveAt: '2026-05-21T17:52:00.000Z',
    },
    {
      id: 'connection-theo',
      user: buildSocialUser({
        id: 'friend-theo',
        username: 'theo.alvarez',
        displayName: 'Theo Alvarez',
        homeBase: 'Denver, CO',
        interests: ['adventure', 'nature'],
        avatarImageId: 52,
      }),
      presence: 'planning',
      sharedTrips: 4,
      mutualFriends: 14,
      favoriteCategories: ['adventure', 'nature'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640',
      nextAdventure: 'Rocky Mountain route',
      lastActiveAt: '2026-05-21T18:20:00.000Z',
    },
    {
      id: 'connection-noah',
      user: buildSocialUser({
        id: 'friend-noah',
        username: 'noah.kim',
        displayName: 'Noah Kim',
        homeBase: 'Seattle, WA',
        interests: ['food', 'culture'],
        avatarImageId: 18,
      }),
      presence: 'online',
      sharedTrips: 1,
      mutualFriends: 7,
      favoriteCategories: ['food', 'culture'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=640',
      nextAdventure: 'Market hall crawl',
      lastActiveAt: '2026-05-21T18:16:00.000Z',
    },
    {
      id: 'connection-priya',
      user: buildSocialUser({
        id: 'friend-priya',
        username: 'priya.nair',
        displayName: 'Priya Nair',
        homeBase: 'Chicago, IL',
        interests: ['shopping', 'culture'],
        avatarImageId: 40,
      }),
      presence: 'online',
      sharedTrips: 2,
      mutualFriends: 9,
      favoriteCategories: ['shopping', 'culture'],
      coverPhotoUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=640',
      nextAdventure: 'Gallery row weekend',
      lastActiveAt: '2026-05-21T18:05:00.000Z',
    },
  ];

  return friends.map(cloneFriendConnection);
}

function buildSeedFriendRequests(): ScopeFriendRequest[] {
  return [
    {
      id: 'request-1',
      user: buildSocialUser({
        id: 'request-sofia',
        username: 'sofia.ramirez',
        displayName: 'Sofia Ramirez',
        homeBase: 'San Antonio, TX',
        interests: ['food', 'culture'],
        avatarImageId: 24,
      }),
      direction: 'incoming',
      createdAt: '2026-03-28T16:00:00.000Z',
      mutualFriends: 9,
      note: 'Heading to Fort Worth next weekend and want to trade scenic + coffee pins.',
    },
    {
      id: 'request-2',
      user: buildSocialUser({
        id: 'request-jordan',
        username: 'jordan.reed',
        displayName: 'Jordan Reed',
        homeBase: 'Houston, TX',
        interests: ['scenic', 'nature'],
        avatarImageId: 33,
      }),
      direction: 'incoming',
      createdAt: '2026-03-28T15:00:00.000Z',
      mutualFriends: 3,
      note: 'Sent after matching on scenic road-trip collections and shared itinerary pacing.',
    },
    {
      id: 'request-3',
      user: buildSocialUser({
        id: 'request-ella',
        username: 'ella.price',
        displayName: 'Ella Price',
        homeBase: 'Portland, OR',
        interests: ['culture', 'nature'],
        avatarImageId: 47,
      }),
      direction: 'incoming',
      createdAt: '2026-03-28T14:00:00.000Z',
      mutualFriends: 4,
      note: 'Waiting on a response after swapping favorite weekend market routes.',
    },
  ].map(cloneFriendRequest);
}

function buildSeedFriendSuggestions(): ScopeFriendSuggestion[] {
  return [
    {
      id: 'suggestion-aisha',
      user: buildSocialUser({
        id: 'suggestion-aisha',
        username: 'aisha.green',
        displayName: 'Aisha Green',
        homeBase: 'New Orleans, LA',
        interests: ['food', 'nightlife'],
        avatarImageId: 56,
      }),
      mutualFriends: 6,
      sharedInterests: ['food', 'nightlife'],
      favoriteCategories: ['food', 'nightlife'],
      presence: 'online',
      reason: 'Strong overlap on food and nightlife routes.',
      score: 94,
    },
    {
      id: 'suggestion-marcus',
      user: buildSocialUser({
        id: 'suggestion-marcus',
        username: 'marcus.lee',
        displayName: 'Marcus Lee',
        homeBase: 'Los Angeles, CA',
        interests: ['scenic', 'shopping'],
        avatarImageId: 61,
      }),
      mutualFriends: 2,
      sharedInterests: ['scenic'],
      favoriteCategories: ['scenic', 'shopping'],
      presence: 'idle',
      reason: 'Shared scenic saves and weekend market lists.',
      score: 81,
    },
  ].map(cloneFriendSuggestion);
}

function buildSessionHint() {
  return {
    version: AUTH_SESSION_HINT_VERSION,
    hasSessionCookie: true,
    lastAuthenticatedAt: new Date().toISOString(),
  };
}

function resolveAppOrigin(page: Page): string {
  try {
    const currentOrigin = new URL(page.url()).origin;
    return currentOrigin && currentOrigin !== 'null' ? currentOrigin : DEFAULT_APP_ORIGIN;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

function readMockSessionCookie(cookieHeader: string | undefined): string {
  if (!cookieHeader) {
    return '';
  }

  const sessionCookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PLAYWRIGHT_SESSION_COOKIE_NAME}=`));

  if (!sessionCookie) {
    return '';
  }

  return decodeURIComponent(sessionCookie.slice(`${PLAYWRIGHT_SESSION_COOKIE_NAME}=`.length));
}

async function persistMockSessionCookie(page: Page, sessionId: string, origin = resolveAppOrigin(page)): Promise<void> {
  await page.context().addCookies([
    {
      name: PLAYWRIGHT_SESSION_COOKIE_NAME,
      value: encodeURIComponent(sessionId),
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function clearMockSessionCookie(page: Page): Promise<void> {
  await page.context().clearCookies();
}

async function persistSessionHint(page: Page, refreshToken: string): Promise<void> {
  const serializedHint = JSON.stringify(buildSessionHint());
  const sessionHint = {
    storageKey: AUTH_SESSION_HINT_STORAGE_KEY,
    storageValue: serializedHint,
    refreshTokenKey: AUTH_REFRESH_TOKEN_STORAGE_KEY,
    refreshToken,
    changeEvent: AUTH_SESSION_HINT_CHANGE_EVENT,
  };

  await page.context().addInitScript(
    ({ storageKey, storageValue, refreshTokenKey, refreshToken, changeEvent }) => {
      window.localStorage.setItem(storageKey, storageValue);
      window.localStorage.setItem(refreshTokenKey, refreshToken);
      window.dispatchEvent(new Event(changeEvent));
    },
    sessionHint,
  );

  await page.evaluate(
    ({ storageKey, storageValue, refreshTokenKey, refreshToken, changeEvent }) => {
      window.localStorage.setItem(storageKey, storageValue);
      window.localStorage.setItem(refreshTokenKey, refreshToken);
      window.dispatchEvent(new Event(changeEvent));
    },
    sessionHint,
  ).catch(() => undefined);
}

async function clearSessionHint(page: Page): Promise<void> {
  const sessionHint = {
    storageKey: AUTH_SESSION_HINT_STORAGE_KEY,
    refreshTokenKey: AUTH_REFRESH_TOKEN_STORAGE_KEY,
    changeEvent: AUTH_SESSION_HINT_CHANGE_EVENT,
  };

  await page.context().addInitScript(({ storageKey, refreshTokenKey, changeEvent }) => {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    window.localStorage.removeItem(refreshTokenKey);
    window.sessionStorage.removeItem(refreshTokenKey);
    window.dispatchEvent(new Event(changeEvent));
  }, sessionHint);

  await page.evaluate(({ storageKey, refreshTokenKey, changeEvent }) => {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    window.localStorage.removeItem(refreshTokenKey);
    window.sessionStorage.removeItem(refreshTokenKey);
    window.dispatchEvent(new Event(changeEvent));
  }, sessionHint).catch(() => undefined);
}

async function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

async function installScopeApiMocks(page: Page): Promise<ScopeApiMock> {
  const registeredUsers = seedUsers.map(cloneUserProfile);
  const state: {
    currentSession: ScopeAuthSession | null;
    trips: ScopeTrip[];
    spots: ScopeSpotDetail[];
    friends: ScopeFriendConnection[];
    friendRequests: ScopeFriendRequest[];
    friendSuggestions: ScopeFriendSuggestion[];
    feed: ScopeFeedItem[];
    notifications: ScopeNotificationItem[];
    notificationPreferences: ScopeNotificationPreference[];
    tripShares: Record<string, string>;
  } = {
    currentSession: null,
    trips: buildSeedTrips(registeredUsers),
    spots: buildSeedSpots(registeredUsers),
    friends: buildSeedFriendConnections(registeredUsers),
    friendRequests: buildSeedFriendRequests(),
    friendSuggestions: buildSeedFriendSuggestions(),
    feed: buildSeedFeed(registeredUsers),
    notifications: buildSeedNotifications(),
    notificationPreferences: buildSeedNotificationPreferences(),
    tripShares: {
      'share-trip-1': 'trip-1',
    },
  };
  let nextSpotSequence = 1000;
  let nextTripSequence = 1000;

  function findKnownUser(overrides: Partial<ScopeAuthSession> = {}): ScopeUserProfile | undefined {
    const normalizedId = normalizeString(overrides.id);
    const normalizedUsername = normalizeString(overrides.username);
    const normalizedEmail = normalizeString(overrides.email).toLowerCase();

    return registeredUsers.find(
      (candidate) =>
        (normalizedId && candidate.id === normalizedId) ||
        (normalizedUsername && candidate.username === normalizedUsername) ||
        (normalizedEmail && candidate.email.toLowerCase() === normalizedEmail),
    );
  }

  function upsertKnownUser(user: ScopeUserProfile): ScopeUserProfile {
    const userIndex = registeredUsers.findIndex(
      (candidate) =>
        candidate.id === user.id ||
        candidate.username === user.username ||
        candidate.email.toLowerCase() === user.email.toLowerCase(),
    );

    const nextUser = cloneUserProfile(user);

    if (userIndex >= 0) {
      registeredUsers.splice(userIndex, 1, nextUser);
    } else {
      registeredUsers.push(nextUser);
    }

    return nextUser;
  }

  function findTrip(tripId: string): ScopeTrip | undefined {
    return state.trips.find((trip) => trip.id === tripId);
  }

  function findSpot(spotId: string): ScopeSpotDetail | undefined {
    return state.spots.find((spot) => spot.id === spotId);
  }

  function getCurrentUserProfile(): ScopeUserProfile {
    if (state.currentSession) {
      return buildUserProfile(state.currentSession, registeredUsers);
    }

    return cloneUserProfile(registeredUsers[0] ?? seedUsers[0]!);
  }

  function readNumberInput(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function readBooleanInput(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  function readCategoryInput(value: unknown, fallback: ScopeSpotCategory): ScopeSpotCategory {
    const category = normalizeString(value).toLowerCase();
    const allowedCategories: ScopeSpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
    return allowedCategories.includes(category as ScopeSpotCategory) ? category as ScopeSpotCategory : fallback;
  }

  function readPillarsInput(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return [...fallback];
    }

    const nextPillars = value.map(normalizeString).filter(Boolean).slice(0, 4);
    return nextPillars.length ? nextPillars : [...fallback];
  }

  function paginateScopeItems<T>(items: T[], pageNumber: number, requestedPageSize: number) {
    const page = Math.max(1, pageNumber || 1);
    const pageSize = Math.max(1, requestedPageSize || items.length || 1);
    const startIndex = (page - 1) * pageSize;
    const data = items.slice(startIndex, startIndex + pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
      },
    };
  }

  function filterSpotSummaries(requestUrl: URL, options: { savedOnly?: boolean; userId?: string } = {}): ScopeSpotSummary[] {
    const category = normalizeString(requestUrl.searchParams.get('category')).toLowerCase();
    const city = normalizeString(requestUrl.searchParams.get('city')).toLowerCase();
    const vibe = normalizeString(requestUrl.searchParams.get('vibe')).toLowerCase();
    const query = normalizeString(
      requestUrl.searchParams.get('q') ??
      requestUrl.searchParams.get('query') ??
      requestUrl.searchParams.get('search'),
    ).toLowerCase();

    return state.spots
      .filter((spot) => spot.isPublic !== false)
      .filter((spot) => !options.savedOnly || Boolean(spot.liked))
      .filter((spot) => !options.userId || spot.author?.id === options.userId)
      .filter((spot) => !category || spot.category === category)
      .filter((spot) => !city || spot.city?.toLowerCase().includes(city))
      .filter((spot) => !vibe || spot.vibe?.toLowerCase().includes(vibe) || spot.pillars?.some((pillar) => pillar.toLowerCase().includes(vibe)))
      .filter((spot) => {
        if (!query) {
          return true;
        }

        const searchableText = [
          spot.title,
          spot.description,
          spot.address,
          spot.city,
          spot.country,
          spot.vibe,
          ...(spot.pillars ?? []),
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(query);
      })
      .map(cloneSpotSummary);
  }

  function buildSpotListEnvelope(requestUrl: URL, spots: ScopeSpotSummary[]) {
    const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
    const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(spots.length || 1)) || spots.length || 1;
    return paginateScopeItems(spots, pageNumber, requestedPageSize);
  }

  function validateSpotInput(input: Record<string, unknown>): Array<{ field: string; message: string }> {
    const validationDetails: Array<{ field: string; message: string }> = [];
    const latitude = readNumberInput(input.latitude, Number.NaN);
    const longitude = readNumberInput(input.longitude, Number.NaN);

    if (!normalizeString(input.title)) {
      validationDetails.push({ field: 'title', message: 'Name the place.' });
    }

    if (!normalizeString(input.description)) {
      validationDetails.push({ field: 'description', message: 'Add a short story so travelers know why this stop matters.' });
    }

    if (!normalizeString(input.address)) {
      validationDetails.push({ field: 'address', message: 'Add a street address or landmark.' });
    }

    if (!normalizeString(input.city)) {
      validationDetails.push({ field: 'city', message: 'Add the city for discovery filters.' });
    }

    if (!normalizeString(input.country)) {
      validationDetails.push({ field: 'country', message: 'Add the country or ISO region code.' });
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      validationDetails.push({ field: 'latitude', message: 'Latitude must be between -90 and 90.' });
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      validationDetails.push({ field: 'longitude', message: 'Longitude must be between -180 and 180.' });
    }

    return validationDetails;
  }

  function upsertSpot(spot: ScopeSpotDetail): ScopeSpotDetail {
    const nextSpot = cloneSpotDetail(spot);
    const spotIndex = state.spots.findIndex((candidate) => candidate.id === nextSpot.id);

    if (spotIndex >= 0) {
      state.spots.splice(spotIndex, 1, nextSpot);
    } else {
      state.spots.unshift(nextSpot);
    }

    return nextSpot;
  }

  function buildSpotDetailFromInput(
    input: Record<string, unknown>,
    options: { existingSpot?: ScopeSpotDetail; request?: Request } = {},
  ): ScopeSpotDetail {
    const existingSpot = options.existingSpot;
    const author = existingSpot?.author ?? getCurrentUserProfile();
    const now = new Date().toISOString();
    const id = existingSpot?.id ?? `spot-${nextSpotSequence++}`;
    const title = normalizeString(input.title) || existingSpot?.title || 'Untitled Scope spot';
    const caption = options.request ? readMultipartTextField(options.request, 'captions') || title : title;
    const fallbackPhotoUrl = existingSpot?.photos[0]?.url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200';
    const photos = existingSpot?.photos.length
      ? existingSpot.photos.map(clonePhoto)
      : [{
          id: `${id}-photo-1`,
          url: fallbackPhotoUrl,
          caption,
        }];

    return {
      ...existingSpot,
      id,
      title,
      description: normalizeString(input.description) || existingSpot?.description || '',
      latitude: readNumberInput(input.latitude, existingSpot?.latitude ?? 32.7561),
      longitude: readNumberInput(input.longitude, existingSpot?.longitude ?? -97.3314),
      address: normalizeString(input.address) || existingSpot?.address,
      city: normalizeString(input.city) || existingSpot?.city,
      country: normalizeString(input.country).toUpperCase() || existingSpot?.country || 'US',
      postalCode: normalizeString(input.postalCode) || existingSpot?.postalCode,
      category: readCategoryInput(input.category, existingSpot?.category ?? 'food'),
      pillars: readPillarsInput(input.pillars, existingSpot?.pillars ?? ['hidden-gem']),
      vibe: normalizeString(input.vibe) || existingSpot?.vibe,
      rating: readNumberInput(input.rating, existingSpot?.rating ?? 4.5),
      photoUrl: photos[0]?.url,
      createdAt: existingSpot?.createdAt ?? now,
      isPublic: readBooleanInput(input.isPublic, existingSpot?.isPublic ?? true),
      author,
      liked: existingSpot?.liked ?? false,
      likesCount: existingSpot?.likesCount ?? 0,
      verificationStatus: 'verified',
      verificationSource: normalizeString(input.verificationSource) || 'Scope place verifier fixture',
      providerPlaceId: normalizeString(input.providerPlaceId) || existingSpot?.providerPlaceId || `pw-${id}`,
      providerPlaceName: normalizeString(input.providerPlaceName) || title,
      providerPlaceAddress: normalizeString(input.providerPlaceAddress) || normalizeString(input.address) || existingSpot?.providerPlaceAddress,
      verificationDistanceMeters: readNumberInput(input.verificationDistanceMeters, existingSpot?.verificationDistanceMeters ?? 8),
      verifiedAt: now,
      safetyStatus: 'clean',
      safetyReason: undefined,
      photos,
      reviews: existingSpot?.reviews.map(cloneReview) ?? [],
    };
  }

  function addFeedItemForSpot(spot: ScopeSpotDetail): void {
    state.feed.unshift({
      id: `feed-${spot.id}`,
      type: 'spot',
      actor: spot.author ? cloneUserProfile(spot.author) : getCurrentUserProfile(),
      title: `${spot.author?.displayName ?? 'Scope traveler'} pinned ${spot.title}`,
      excerpt: spot.description ?? '',
      createdAt: spot.createdAt,
      imageUrl: spot.photoUrl,
      targetId: spot.id,
    });
  }

  function ensureKnownUser(userId: string): ScopeUserProfile | undefined {
    const existingUser = findKnownUser({ id: userId });

    if (existingUser) {
      return existingUser;
    }

    if (state.currentSession?.id === userId) {
      return upsertKnownUser({
        id: state.currentSession.id,
        username: state.currentSession.username,
        email: state.currentSession.email,
        displayName: state.currentSession.displayName,
        avatarUrl: 'https://i.pravatar.cc/160?img=64',
        bio: 'Playwright traveler synced into the Scope mock workspace.',
        homeBase: 'Fort Worth, TX',
        interests: ['food', 'culture', 'nightlife'],
        stats: {
          spots: 0,
          trips: 0,
          friends: 0,
        },
      });
    }

    return undefined;
  }

  function ensureKnownTrip(tripId: string): ScopeTrip | undefined {
    const existingTrip = findTrip(tripId);

    if (existingTrip) {
      return existingTrip;
    }

    const seedTrip = buildSeedTrips(registeredUsers).find((trip) => trip.id === tripId);

    if (!seedTrip) {
      return undefined;
    }

    const clonedTrip = cloneTrip(seedTrip);
    state.trips.push(clonedTrip);
    return clonedTrip;
  }

  function getOwnerTripMember(): ScopeTripMember {
    const owner = getCurrentUserProfile();
    return {
      id: owner.id,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      status: 'owner',
    };
  }

  function readTripMembersInput(value: unknown, fallbackMembers: ScopeTripMember[]): ScopeTripMember[] {
    if (!Array.isArray(value)) {
      return fallbackMembers.map(cloneTripMember);
    }

    const members = value
      .filter(isRecord)
      .map((member): ScopeTripMember => {
        const userId = normalizeString(member.user_id ?? member.id) || `member-${Date.now()}`;
        const knownUser = ensureKnownUser(userId);
        return {
          id: knownUser?.id ?? userId,
          displayName: knownUser?.displayName ?? (normalizeString(member.displayName) || userId),
          avatarUrl: knownUser?.avatarUrl,
          status: normalizeString(member.role ?? member.status) || 'viewer',
        };
      });

    return members.length ? members : fallbackMembers.map(cloneTripMember);
  }

  function readTripSpotsInput(value: unknown, fallbackSpots: ScopeTripSpot[]): ScopeTripSpot[] {
    if (!Array.isArray(value)) {
      return fallbackSpots.map(cloneTripSpot);
    }

    return value
      .filter(isRecord)
      .map((spot, index): ScopeTripSpot => ({
        spotId: normalizeString(spot.spot_id ?? spot.spotId) || `trip-stop-${index + 1}`,
        title: normalizeString(spot.title) || `Stop ${index + 1}`,
        latitude: readNumberInput(spot.latitude, 32.7555 + index * 0.01),
        longitude: readNumberInput(spot.longitude, -97.3308 - index * 0.01),
        category: normalizeString(spot.category) || 'other',
        city: normalizeString(spot.city) || undefined,
        dayNumber: readNumberInput(spot.day_number ?? spot.dayNumber, index + 1),
        timeSlot: normalizeString(spot.timeSlot) || undefined,
        duration: readNumberInput(spot.duration, 75),
        estimatedCost: readNumberInput(spot.estimatedCost, 25),
        photoUrl: normalizeString(spot.photoUrl) || undefined,
        notes: normalizeString(spot.notes) || undefined,
      }));
  }

  function buildTripFromMutation(input: Record<string, unknown>, existingTrip?: ScopeTrip): ScopeTrip {
    const fallbackMembers = existingTrip?.members.length ? existingTrip.members : [getOwnerTripMember()];
    const members = readTripMembersInput(input.members, fallbackMembers);
    const ownerId = getOwnerTripMember().id;

    if (!members.some((member) => member.id === ownerId)) {
      members.unshift(getOwnerTripMember());
    }

    return {
      ...existingTrip,
      id: existingTrip?.id ?? `trip-${nextTripSequence++}`,
      title: normalizeString(input.title) || existingTrip?.title || 'Untitled trip',
      destination: normalizeString(input.destination) || existingTrip?.destination || 'Fort Worth, TX',
      description: normalizeString(input.description) || existingTrip?.description || '',
      isPublic: readBooleanInput(input.is_public ?? input.isPublic, existingTrip?.isPublic ?? false),
      startDate: normalizeString(input.start_date ?? input.startDate) || existingTrip?.startDate || '2026-05-21',
      endDate: normalizeString(input.end_date ?? input.endDate) || existingTrip?.endDate || '2026-05-22',
      spots: readTripSpotsInput(input.spots, existingTrip?.spots ?? []),
      members,
      coverImageUrl: normalizeString(input.cover_photo_url ?? input.coverImageUrl) || existingTrip?.coverImageUrl,
      budget: readNumberInput(input.budget, existingTrip?.budget ?? 0) || undefined,
      currency: normalizeString(input.currency) || existingTrip?.currency || 'USD',
      status: normalizeString(input.status) || existingTrip?.status || 'planning',
      itinerary: existingTrip?.itinerary,
    };
  }

  function upsertTrip(trip: ScopeTrip): ScopeTrip {
    const nextTrip = cloneTrip(trip);
    const tripIndex = state.trips.findIndex((candidate) => candidate.id === nextTrip.id);

    if (tripIndex >= 0) {
      state.trips.splice(tripIndex, 1, nextTrip);
    } else {
      state.trips.unshift(nextTrip);
    }

    return nextTrip;
  }

  function paginateTrips(requestUrl: URL, trips: ScopeTrip[]) {
    const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
    const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(trips.length || 1)) || trips.length || 1;
    const pageSize = Math.max(1, requestedPageSize);
    const startIndex = Math.max(0, (pageNumber - 1) * pageSize);

    return {
      data: trips.slice(startIndex, startIndex + pageSize).map(cloneTrip),
      meta: {
        page: pageNumber,
        pageSize,
        total: trips.length,
        totalPages: Math.max(1, Math.ceil(trips.length / pageSize)),
      },
    };
  }

  function buildSearchResultHighlights(query: string, name: string): Record<string, string[]> | undefined {
    const normalizedQuery = normalizeString(query);
    if (!normalizedQuery) {
      return undefined;
    }

    return {
      name: [name],
    };
  }

  function buildContentSearchResponse(requestUrl: URL) {
    const query = normalizeString(requestUrl.searchParams.get('q'));
    const type = normalizeString(requestUrl.searchParams.get('type')) || 'spots';
    const limit = Number(requestUrl.searchParams.get('limit') ?? '20') || 20;
    const offset = Number(requestUrl.searchParams.get('offset') ?? '0') || 0;
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    const includesQuery = (values: Array<string | undefined | null>) => {
      if (!queryTokens.length) {
        return false;
      }

      const haystack = values.map((value) => normalizeString(value).toLowerCase()).filter(Boolean).join(' ');
      return queryTokens.every((token) => haystack.includes(token));
    };

    const spotResults = type === 'spots'
      ? state.spots
        .filter((spot) => includesQuery([
          spot.title,
          spot.description,
          spot.city,
          spot.country,
          spot.vibe,
          spot.category,
          spot.author?.displayName,
          ...(spot.pillars ?? []),
        ]))
        .map((spot) => ({
          id: spot.id,
          name: spot.title,
          description: spot.description,
          category: spot.category,
          tags: [spot.city, spot.country, spot.vibe, spot.category].filter((value): value is string => Boolean(value?.trim())),
          location: { lat: spot.latitude, lon: spot.longitude },
          avg_rating: spot.rating,
          review_count: spot.reviews.length || spot.likesCount,
          _score: 12 + (spot.rating ?? 0) + spot.reviews.length,
          _highlights: buildSearchResultHighlights(query, spot.title),
        }))
      : [];

    const tripResults = type === 'trips'
      ? state.trips
        .filter((trip) => includesQuery([
          trip.title,
          trip.destination,
          trip.description,
          trip.status,
          trip.currency,
        ]))
        .map((trip) => ({
          id: trip.id,
          name: trip.title,
          description: trip.description,
          category: 'trip',
          tags: [trip.destination, trip.status, trip.currency].filter((value): value is string => Boolean(value?.trim())),
          review_count: trip.members.length,
          _score: 8 + trip.members.length,
          _highlights: buildSearchResultHighlights(query, trip.title),
        }))
      : [];

    const reviewResults = type === 'reviews'
      ? state.spots
        .flatMap((spot) => spot.reviews.map((review) => ({ spot, review })))
        .filter(({ spot, review }) => includesQuery([
          spot.title,
          spot.city,
          review.comment,
          review.user.displayName,
        ]))
        .map(({ spot, review }) => ({
          id: review.id,
          name: `${spot.title} review`,
          description: review.comment,
          category: spot.category,
          tags: [spot.city, spot.country, review.user.displayName, 'review'].filter((value): value is string => Boolean(value?.trim())),
          location: { lat: spot.latitude, lon: spot.longitude },
          avg_rating: review.rating,
          _score: 10 + review.rating,
          _highlights: buildSearchResultHighlights(query, `${spot.title} review`),
        }))
      : [];

    const results = [...spotResults, ...tripResults, ...reviewResults]
      .sort((left, right) => right._score - left._score);

    return {
      query,
      type,
      total: results.length,
      offset,
      limit,
      results: results.slice(offset, offset + limit),
    };
  }

  function buildGeoSearchResponse(requestUrl: URL) {
    const lat = Number(requestUrl.searchParams.get('lat'));
    const lon = Number(requestUrl.searchParams.get('lon') ?? requestUrl.searchParams.get('lng'));
    const radiusText = normalizeString(requestUrl.searchParams.get('radius')) || '10km';
    const limit = Number(requestUrl.searchParams.get('limit') ?? '20') || 20;
    const radiusKm = Number(radiusText.replace(/[^\d.]+/g, '')) || 10;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return {
        center: { lat: 0, lon: 0 },
        radius: radiusText,
        total: 0,
        results: [],
      };
    }

    const results = state.spots
      .map((spot) => {
        const distanceKm = distanceInKilometers(lat, lon, spot.latitude, spot.longitude);
        return {
          id: spot.id,
          name: spot.title,
          description: spot.description,
          category: spot.category,
          tags: [spot.city, spot.country, spot.vibe, spot.category].filter((value): value is string => Boolean(value?.trim())),
          location: { lat: spot.latitude, lon: spot.longitude },
          avg_rating: spot.rating,
          review_count: spot.reviews.length || spot.likesCount,
          _score: Math.max(0, 20 - distanceKm),
          _distance_km: Number(distanceKm.toFixed(2)),
        };
      })
      .filter((spot) => spot._distance_km <= radiusKm)
      .sort((left, right) => left._distance_km - right._distance_km)
      .slice(0, limit);

    return {
      center: { lat, lon },
      radius: radiusText,
      total: results.length,
      results,
    };
  }

  function addTripShare(tripId: string): string {
    const existingToken = Object.entries(state.tripShares).find(([, sharedTripId]) => sharedTripId === tripId)?.[0];
    if (existingToken) {
      return existingToken;
    }

    const shareToken = `share-${tripId}`;
    state.tripShares[shareToken] = tripId;
    return shareToken;
  }

  function findNotification(notificationId: string): ScopeNotificationItem | undefined {
    return state.notifications.find((notification) => notification.id === notificationId);
  }

  await page.addInitScript((flagName) => {
    (window as Window & Record<string, boolean>)[flagName] = true;
  }, VISUAL_QA_FLAG);

  await page.context().addInitScript(
    ({ storageKey, storageValue }) => {
      window.localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: ONBOARDING_COMPLETION_STORAGE_KEY,
      storageValue: ONBOARDING_COMPLETION_VALUE,
    },
  );

  await page.context().addInitScript(
    ({ storageKey, storageValue }) => {
      window.localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: ANALYTICS_CONSENT_STORAGE_KEY,
      storageValue: ANALYTICS_CONSENT_VALUE,
    },
  );

  await page.context().route('**/api/**', async (route) => {
    const request = route.request();
    const requestBody = readJsonBody(request);
    const requestUrl = new URL(request.url());
    const requestPath = normalizeApiMockPath(requestUrl.pathname);
    const requestMethod = request.method().toUpperCase();

    if (requestPath === '/api/core/auth/register' && requestMethod === 'POST') {
      const username = normalizeString(requestBody.username);
      const displayName = normalizeString(requestBody.displayName);
      const email = normalizeString(requestBody.email).toLowerCase();
      const password = normalizeString(requestBody.password);
      const validationDetails: Array<{ field: string; message: string }> = [];

      if (!username) {
        validationDetails.push({ field: 'username', message: 'Username is required.' });
      }

      if (!displayName) {
        validationDetails.push({ field: 'displayName', message: 'Display name is required.' });
      }

      if (!email) {
        validationDetails.push({ field: 'email', message: 'Email is required.' });
      }

      if (!password) {
        validationDetails.push({ field: 'password', message: 'Password is required.' });
      }

      if (validationDetails.length) {
        await fulfillJson(route, 400, createValidationError(validationDetails));
        return;
      }

      const registeredUser = upsertKnownUser({
        id: `user-${username}`,
        username,
        email,
        displayName,
        avatarUrl: 'https://i.pravatar.cc/160?img=64',
        bio: 'Freshly registered traveler mapping first-class routes with Playwright precision.',
        homeBase: 'Fort Worth, TX',
        interests: ['food', 'culture', 'nightlife'],
        stats: {
          spots: 0,
          trips: 0,
          friends: 0,
        },
      });

      state.currentSession = buildAuthSession({
        id: registeredUser.id,
        username: registeredUser.username,
        email: registeredUser.email,
        displayName: registeredUser.displayName,
      });

      await persistMockSessionCookie(page, state.currentSession.id, requestUrl.origin);
      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if ((requestPath === '/api/core/auth/login' || requestPath === '/api/core/auth/oauth/cognito') && requestMethod === 'POST') {
      const email = normalizeString(requestBody.email).toLowerCase() || 'louis@example.com';
      const password = normalizeString(requestBody.password);

      if (requestPath === '/api/core/auth/login' && !password) {
        await fulfillJson(route, 400, createValidationError([{ field: 'password', message: 'Password is required.' }]));
        return;
      }

      const matchingKnownUser = findKnownUser({ email });
      const fallbackUsername = email.split('@')[0] || 'scope-user';
      const username = matchingKnownUser?.username ?? fallbackUsername;
      const displayName = matchingKnownUser?.displayName ?? username;

      if (requestPath === '/api/core/auth/login' && password && password !== DEFAULT_PASSWORD) {
        await fulfillJson(route, 401, JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
          },
        }));
        return;
      }

      state.currentSession = buildAuthSession({
        id: matchingKnownUser?.id ?? `user-${username}`,
        username,
        email,
        displayName,
      });

      await persistMockSessionCookie(page, state.currentSession.id, requestUrl.origin);
      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if (requestPath === '/api/core/auth/refresh' && requestMethod === 'POST') {
      if (!state.currentSession) {
        const sessionUserId = readMockSessionCookie(request.headers().cookie);
        const matchingKnownUser = findKnownUser({ id: sessionUserId });

        if (matchingKnownUser) {
          state.currentSession = buildAuthSession({
            id: matchingKnownUser.id,
            username: matchingKnownUser.username,
            email: matchingKnownUser.email,
            displayName: matchingKnownUser.displayName,
          });
        }
      }

      if (!state.currentSession) {
        await fulfillJson(route, 401, createUnauthorizedError());
        return;
      }

      state.currentSession = buildAuthSession({
        ...state.currentSession,
        accessToken: `playwright-access-${state.currentSession.username}-${Date.now()}`,
      });

      await persistMockSessionCookie(page, state.currentSession.id, requestUrl.origin);
      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if (requestPath === '/api/core/auth/logout' && requestMethod === 'POST') {
      state.currentSession = null;
      await clearMockSessionCookie(page);
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath === '/api/core/presence/heartbeat' && requestMethod === 'PUT') {
      if (!state.currentSession) {
        await fulfillJson(route, 401, createUnauthorizedError());
        return;
      }

      await fulfillJson(route, 200, {
        data: {
          userId: state.currentSession.id,
          status: normalizeString(requestBody.status) || 'online',
          routeContext: normalizeString(requestBody.routeContext) || undefined,
          lastActiveAt: new Date().toISOString(),
        },
      });
      return;
    }

    if (requestPath === '/api/core/auth/me' && requestMethod === 'GET') {
      if (!state.currentSession) {
        const sessionUserId = readMockSessionCookie(request.headers().cookie);
        const matchingKnownUser = findKnownUser({ id: sessionUserId });

        if (matchingKnownUser) {
          state.currentSession = buildAuthSession({
            id: matchingKnownUser.id,
            username: matchingKnownUser.username,
            email: matchingKnownUser.email,
            displayName: matchingKnownUser.displayName,
          });
        }
      }

      if (!state.currentSession) {
        await fulfillJson(route, 401, createUnauthorizedError());
        return;
      }

      await fulfillJson(route, 200, {
        data: buildUserProfile(state.currentSession, registeredUsers),
      });
      return;
    }

    if (requestPath === '/api/core/users/search' && requestMethod === 'GET') {
      const query = normalizeString(requestUrl.searchParams.get('q')).toLowerCase();
      const matchingUsers = registeredUsers.filter((user) => {
        if (!query) {
          return true;
        }

        const searchableText = [user.username, user.displayName, user.email, user.homeBase]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });

      await fulfillJson(route, 200, {
        data: matchingUsers,
        meta: {
          page: 1,
          pageSize: matchingUsers.length || 1,
          total: matchingUsers.length,
          totalPages: 1,
        },
      });
      return;
    }

    if (requestPath.startsWith('/api/core/users/') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const userId = pathSegments[3] ?? '';
      const matchingKnownUser = ensureKnownUser(userId);

      if (!matchingKnownUser) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'USER_NOT_FOUND',
            message: `User ${userId} was not found.`,
          },
        }));
        return;
      }

      const nextUser = upsertKnownUser({
        ...matchingKnownUser,
        username: normalizeString(requestBody.username) || matchingKnownUser.username,
        email: normalizeString(requestBody.email).toLowerCase() || matchingKnownUser.email,
        displayName: normalizeString(requestBody.displayName) || matchingKnownUser.displayName,
        avatarUrl: normalizeString(requestBody.avatarUrl) || matchingKnownUser.avatarUrl,
        bio: normalizeString(requestBody.bio) || matchingKnownUser.bio,
        homeBase: normalizeString(requestBody.homeBase) || matchingKnownUser.homeBase,
        interests: Array.isArray(requestBody.interests)
          ? requestBody.interests.map(normalizeString).filter(Boolean)
          : matchingKnownUser.interests,
        showActivityStatus: typeof requestBody.showActivityStatus === 'boolean'
          ? requestBody.showActivityStatus
          : matchingKnownUser.showActivityStatus,
      });

      if (state.currentSession?.id === nextUser.id) {
        state.currentSession = buildAuthSession({
          ...state.currentSession,
          username: nextUser.username,
          email: nextUser.email,
          displayName: nextUser.displayName,
        });
      }

      await fulfillJson(route, 200, {
        data: nextUser,
      });
      return;
    }

    if (requestPath.startsWith('/api/core/users/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const userId = pathSegments[3] ?? '';
      const matchingKnownUser = ensureKnownUser(userId);

      if (!matchingKnownUser) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'USER_NOT_FOUND',
            message: `User ${userId} was not found.`,
          },
        }));
        return;
      }

      if (requestPath.endsWith('/stats')) {
        await fulfillJson(route, 200, {
          data: matchingKnownUser.stats ?? {
            spots: 0,
            trips: 0,
            friends: 0,
          },
        });
        return;
      }

      await fulfillJson(route, 200, {
        data: matchingKnownUser,
      });
      return;
    }

    if (requestPath === '/api/core/friends' && requestMethod === 'GET') {
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.friends.length || 1)) || state.friends.length || 1;
      await fulfillJson(route, 200, paginateScopeItems(state.friends.map(cloneFriendConnection), pageNumber, requestedPageSize));
      return;
    }

    if (requestPath === '/api/core/friends/pending' && requestMethod === 'GET') {
      await fulfillJson(route, 200, {
        data: state.friendRequests
          .filter((request) => request.direction === 'incoming')
          .map(cloneFriendRequest),
      });
      return;
    }

    if (requestPath === '/api/core/friends/suggestions' && requestMethod === 'GET') {
      const limit = Number(requestUrl.searchParams.get('limit') ?? String(state.friendSuggestions.length || 1)) || state.friendSuggestions.length || 1;
      await fulfillJson(route, 200, {
        data: state.friendSuggestions.slice(0, limit).map(cloneFriendSuggestion),
      });
      return;
    }

    if (requestPath.startsWith('/api/core/friends/request/') && requestMethod === 'POST') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const userId = pathSegments[4] ?? '';
      const matchingSuggestion = state.friendSuggestions.find((suggestion) => suggestion.user.id === userId);
      const matchingUser = matchingSuggestion?.user ?? ensureKnownUser(userId);

      if (!matchingUser) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'USER_NOT_FOUND',
            message: `User ${userId} was not found.`,
          },
        }));
        return;
      }

      state.friendRequests.push({
        id: `outgoing-${userId}`,
        user: cloneUserProfile(matchingUser),
        direction: 'outgoing',
        createdAt: new Date().toISOString(),
        mutualFriends: matchingSuggestion?.mutualFriends ?? 0,
        note: 'Request sent from Playwright production fixture.',
      });
      state.friendSuggestions = state.friendSuggestions.filter((suggestion) => suggestion.user.id !== userId);

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath.startsWith('/api/core/friends/') && requestPath.endsWith('/accept') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const requestId = pathSegments[3] ?? '';
      const matchingRequest = state.friendRequests.find((request) => request.id === requestId);

      if (!matchingRequest) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'FRIEND_REQUEST_NOT_FOUND',
            message: `Friend request ${requestId} was not found.`,
          },
        }));
        return;
      }

      const nextConnection: ScopeFriendConnection = {
        id: `connection-${matchingRequest.user.id}`,
        user: cloneUserProfile(matchingRequest.user),
        presence: 'online',
        sharedTrips: 0,
        mutualFriends: matchingRequest.mutualFriends,
        favoriteCategories: matchingRequest.user.interests
          .filter((interest): interest is ScopeSpotCategory => ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'].includes(interest)),
        coverPhotoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=640',
        nextAdventure: matchingRequest.note || 'Ready to map a first route together.',
        lastActiveAt: new Date().toISOString(),
      };

      state.friendRequests = state.friendRequests.filter((request) => request.id !== requestId);
      state.friends = [
        nextConnection,
        ...state.friends.filter((connection) => connection.user.id !== nextConnection.user.id && connection.id !== nextConnection.id),
      ];
      state.friendSuggestions = state.friendSuggestions.filter((suggestion) => suggestion.user.id !== nextConnection.user.id);

      await fulfillJson(route, 200, {
        data: cloneFriendConnection(nextConnection),
      });
      return;
    }

    if (requestPath.startsWith('/api/core/friends/') && requestPath.endsWith('/reject') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const requestId = pathSegments[3] ?? '';
      state.friendRequests = state.friendRequests.filter((request) => request.id !== requestId);

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath.startsWith('/api/core/friends/') && requestMethod === 'DELETE') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const connectionId = pathSegments[3] ?? '';
      state.friends = state.friends.filter((connection) => connection.id !== connectionId);

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath === '/api/core/notifications' && requestMethod === 'GET') {
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.notifications.length || 1)) || state.notifications.length || 1;
      const requestedCategory = normalizeString(requestUrl.searchParams.get('category')).toLowerCase();
      const requestedUnread = normalizeString(requestUrl.searchParams.get('unread')).toLowerCase();
      const filteredNotifications = state.notifications.filter((notification) => {
        if (requestedCategory && !notification.type.toLowerCase().startsWith(requestedCategory)) {
          return false;
        }

        if (requestedUnread === 'true' && notification.isRead) {
          return false;
        }

        if (requestedUnread === 'false' && !notification.isRead) {
          return false;
        }

        return true;
      });
      const pageSize = Math.max(1, requestedPageSize);
      const startIndex = Math.max(0, (pageNumber - 1) * pageSize);
      const pagedNotifications = filteredNotifications.slice(startIndex, startIndex + pageSize).map(cloneNotification);

      await fulfillJson(route, 200, {
        data: pagedNotifications,
        meta: {
          page: pageNumber,
          pageSize,
          total: filteredNotifications.length,
          totalPages: Math.max(1, Math.ceil(filteredNotifications.length / pageSize)),
        },
      });
      return;
    }

    if (requestPath === '/api/core/notifications/preferences' && requestMethod === 'GET') {
      await fulfillJson(route, 200, {
        data: state.notificationPreferences.map((preference) => ({ ...preference })),
      });
      return;
    }

    if (requestPath === '/api/core/notifications/preferences' && requestMethod === 'PUT') {
      const category = normalizeString(requestBody.category) || 'general';
      const existingIndex = state.notificationPreferences.findIndex((preference) => preference.category === category);
      const updatedPreference: ScopeNotificationPreference = {
        id: existingIndex >= 0 ? state.notificationPreferences[existingIndex]!.id : `notification-preference-${category}`,
        category,
        inAppEnabled: readBooleanInput(requestBody.inAppEnabled, true),
        pushEnabled: readBooleanInput(requestBody.pushEnabled, true),
        emailEnabled: readBooleanInput(requestBody.emailEnabled, false),
        digestCadence: ['instant', 'daily', 'weekly', 'off'].includes(normalizeString(requestBody.digestCadence))
          ? normalizeString(requestBody.digestCadence) as ScopeNotificationPreference['digestCadence']
          : 'instant',
        quietHoursStartMinutes: typeof requestBody.quietHoursStartMinutes === 'number' ? requestBody.quietHoursStartMinutes : null,
        quietHoursEndMinutes: typeof requestBody.quietHoursEndMinutes === 'number' ? requestBody.quietHoursEndMinutes : null,
        timeZoneId: normalizeString(requestBody.timeZoneId) || 'America/Chicago',
      };

      if (existingIndex >= 0) {
        state.notificationPreferences.splice(existingIndex, 1, updatedPreference);
      } else {
        state.notificationPreferences.push(updatedPreference);
      }

      await fulfillJson(route, 200, {
        data: updatedPreference,
      });
      return;
    }

    if (requestPath === '/api/core/notifications/read-all' && requestMethod === 'PUT') {
      state.notifications = state.notifications.map((notification) => ({
        ...cloneNotification(notification),
        isRead: true,
      }));

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath.startsWith('/api/core/notifications/') && requestPath.endsWith('/read') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const notificationId = pathSegments[3] ?? '';
      const matchingNotification = findNotification(notificationId);

      if (!matchingNotification) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: `Notification ${notificationId} was not found.`,
          },
        }));
        return;
      }

      const updatedNotification = {
        ...cloneNotification(matchingNotification),
        isRead: true,
      };
      const notificationIndex = state.notifications.findIndex((notification) => notification.id === notificationId);
      state.notifications.splice(notificationIndex, 1, updatedNotification);

      await fulfillJson(route, 200, {
        data: updatedNotification,
      });
      return;
    }

    if ((requestPath === '/api/content/feed' || requestPath === '/api/content/feed/') && requestMethod === 'GET') {
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.feed.length || 1)) || state.feed.length || 1;
      const pageSize = Math.max(1, requestedPageSize);
      const startIndex = Math.max(0, (pageNumber - 1) * pageSize);
      const pagedFeed = state.feed.slice(startIndex, startIndex + pageSize).map(cloneFeedItem);

      await fulfillJson(route, 200, {
        data: pagedFeed,
        meta: {
          page: pageNumber,
          pageSize,
          total: state.feed.length,
          totalPages: Math.max(1, Math.ceil(state.feed.length / pageSize)),
        },
      });
      return;
    }

    if (requestPath === '/api/content/trips' && requestMethod === 'GET') {
      await fulfillJson(route, 200, paginateTrips(requestUrl, state.trips));
      return;
    }

    if (requestPath.startsWith('/api/core/notifications/') && requestPath.endsWith('/actions') && requestMethod === 'POST') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const notificationId = pathSegments[3] ?? '';
      const action = normalizeString(requestBody.action);
      const notificationIndex = state.notifications.findIndex((notification) => notification.id === notificationId);

      if (notificationIndex === -1) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: `Notification ${notificationId} was not found.`,
          },
        }));
        return;
      }

      if (action === 'decline_friend_request') {
        state.notifications.splice(notificationIndex, 1);
      } else if (['mark_read', 'open', 'accept_friend_request'].includes(action)) {
        state.notifications.splice(notificationIndex, 1, {
          ...cloneNotification(state.notifications[notificationIndex]!),
          isRead: true,
        });
      }

      await fulfillJson(route, 200, {
        data: { ok: true, action },
      });
      return;
    }

    if (requestPath === '/api/core/notifications/push-subscriptions' && requestMethod === 'POST') {
      await fulfillJson(route, 201, {
        data: { id: `push-${Date.now()}` },
      });
      return;
    }

    if (requestPath === '/api/content/trips/public' && requestMethod === 'GET') {
      await fulfillJson(route, 200, paginateTrips(requestUrl, state.trips.filter((trip) => trip.isPublic)));
      return;
    }

    if (requestPath === '/api/content/trips' && requestMethod === 'POST') {
      const createdTrip = upsertTrip(buildTripFromMutation(requestBody));

      await fulfillJson(route, 201, {
        data: cloneTrip(createdTrip),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/share/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const shareToken = pathSegments[4] ?? '';
      const tripId = state.tripShares[shareToken] ?? (shareToken === 'share-trip-1' ? 'trip-1' : shareToken);
      const matchingTrip = ensureKnownTrip(tripId);

      if (!matchingTrip) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_SHARE_NOT_FOUND',
            message: `Shared trip ${shareToken} was not found.`,
          },
        }));
        return;
      }

      await fulfillJson(route, 200, {
        data: cloneTrip(matchingTrip),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/') && requestPath.endsWith('/share') && requestMethod === 'POST') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const tripId = pathSegments[3] ?? '';
      const matchingTrip = ensureKnownTrip(tripId);

      if (!matchingTrip) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_NOT_FOUND',
            message: `Trip ${tripId} was not found.`,
          },
        }));
        return;
      }

      const token = addTripShare(tripId);
      await fulfillJson(route, 200, {
        data: {
          token,
          path: `/trips/shared/${token}`,
        },
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/') && requestPath.endsWith('/members') && requestMethod === 'POST') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const tripId = pathSegments[3] ?? '';
      const matchingTrip = ensureKnownTrip(tripId);

      if (!matchingTrip) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_NOT_FOUND',
            message: `Trip ${tripId} was not found.`,
          },
        }));
        return;
      }

      const requestedUserId = normalizeString(requestBody.user_id);
      const role = normalizeString(requestBody.role) === 'viewer' ? 'viewer' : 'editor';
      const knownUser = requestedUserId ? ensureKnownUser(requestedUserId) : undefined;
      const memberId = knownUser?.id ?? (requestedUserId || `invite-${Date.now()}`);
      const nextMember: ScopeTripMember = {
        id: memberId,
        displayName: knownUser?.displayName ?? memberId.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        avatarUrl: knownUser?.avatarUrl,
        status: role,
        inviteStatus: 'pending',
        presence: 'offline',
      };
      const nextMembers = matchingTrip.members.some((member) => member.id === nextMember.id)
        ? matchingTrip.members.map((member) =>
            member.id === nextMember.id && member.status !== 'owner'
              ? { ...member, status: role, inviteStatus: member.inviteStatus ?? 'pending' }
              : member,
          )
        : [...matchingTrip.members.map(cloneTripMember), nextMember];
      const updatedTrip = upsertTrip({
        ...matchingTrip,
        members: nextMembers,
      });

      await fulfillJson(route, 200, {
        data: cloneTrip(updatedTrip),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const tripId = pathSegments[3] ?? '';
      const matchingTrip = ensureKnownTrip(tripId);

      if (!matchingTrip) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_NOT_FOUND',
            message: `Trip ${tripId} was not found.`,
          },
        }));
        return;
      }

      if (requestPath.endsWith('/members')) {
        await fulfillJson(route, 200, {
          data: matchingTrip.members.map(cloneTripMember),
        });
        return;
      }

      await fulfillJson(route, 200, {
        data: cloneTrip(matchingTrip),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const tripId = pathSegments[3] ?? '';
      const matchingTrip = ensureKnownTrip(tripId);

      if (!matchingTrip) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_NOT_FOUND',
            message: `Trip ${tripId} was not found.`,
          },
        }));
        return;
      }

      const updatedTrip = upsertTrip(buildTripFromMutation(requestBody, matchingTrip));

      await fulfillJson(route, 200, {
        data: cloneTrip(updatedTrip),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/trips/') && requestMethod === 'DELETE') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const tripId = pathSegments[3] ?? '';
      const tripIndex = state.trips.findIndex((trip) => trip.id === tripId);

      if (tripIndex === -1) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'TRIP_NOT_FOUND',
            message: `Trip ${tripId} was not found.`,
          },
        }));
        return;
      }

      state.trips.splice(tripIndex, 1);
      Object.keys(state.tripShares).forEach((token) => {
        if (state.tripShares[token] === tripId) {
          delete state.tripShares[token];
        }
      });

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath === '/api/content/search' && requestMethod === 'GET') {
      await fulfillJson(route, 200, buildContentSearchResponse(requestUrl));
      return;
    }

    if (requestPath === '/api/content/search/nearby' && requestMethod === 'GET') {
      await fulfillJson(route, 200, buildGeoSearchResponse(requestUrl));
      return;
    }

    if ((requestPath === '/api/content/spots' || requestPath === '/api/content/spots/explore') && requestMethod === 'GET') {
      const matchingSpots = filterSpotSummaries(requestUrl);
      await fulfillJson(route, 200, buildSpotListEnvelope(requestUrl, matchingSpots));
      return;
    }

    if (requestPath === '/api/content/spots/saved' && requestMethod === 'GET') {
      const savedSpots = filterSpotSummaries(requestUrl, { savedOnly: true });
      await fulfillJson(route, 200, buildSpotListEnvelope(requestUrl, savedSpots));
      return;
    }

    if (requestPath.startsWith('/api/content/spots/user/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const userId = pathSegments[4] ?? '';
      const userSpots = filterSpotSummaries(requestUrl, { userId });
      await fulfillJson(route, 200, buildSpotListEnvelope(requestUrl, userSpots));
      return;
    }

    if (requestPath === '/api/content/spots/compose' && requestMethod === 'POST') {
      const spotInput = readMultipartJsonField(request, 'spot');
      const validationDetails = validateSpotInput(spotInput);

      if (validationDetails.length) {
        await fulfillJson(route, 400, createValidationError(validationDetails));
        return;
      }

      const createdSpot = upsertSpot(buildSpotDetailFromInput(spotInput, { request }));
      addFeedItemForSpot(createdSpot);

      await fulfillJson(route, 201, {
        data: cloneSpotDetail(createdSpot),
      });
      return;
    }

    if (requestPath === '/api/content/photos/upload' && requestMethod === 'POST') {
      const spotId = readMultipartTextField(request, 'spot_id');
      const matchingSpot = findSpot(spotId);

      if (!matchingSpot) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      const caption = readMultipartTextField(request, 'caption') || matchingSpot.title;
      const nextPhoto: ScopePhoto = {
        id: `${spotId}-photo-${matchingSpot.photos.length + 1}`,
        url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
        caption,
      };
      const updatedSpot = upsertSpot({
        ...matchingSpot,
        photoUrl: matchingSpot.photoUrl || nextPhoto.url,
        photos: [...matchingSpot.photos.map(clonePhoto), nextPhoto],
      });

      await fulfillJson(route, 201, {
        data: updatedSpot.photos[updatedSpot.photos.length - 1],
      });
      return;
    }

    if (requestPath === '/api/content/spots/nearby' && requestMethod === 'GET') {
      const lat = Number(requestUrl.searchParams.get('lat'));
      const lng = Number(requestUrl.searchParams.get('lng'));
      const baseLat = Number.isFinite(lat) ? lat : 32.7555;
      const baseLng = Number.isFinite(lng) ? lng : -97.3308;
      const radiusKm = Number(requestUrl.searchParams.get('radius') ?? '25') || 25;
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.spots.length || 1)) || state.spots.length || 1;

      const nearbySpots = state.spots
        .filter((spot) => spot.isPublic !== false)
        .filter((spot) => distanceInKilometers(baseLat, baseLng, spot.latitude, spot.longitude) <= radiusKm)
        .map(cloneSpotSummary);

      await fulfillJson(route, 200, paginateScopeItems(nearbySpots, pageNumber, requestedPageSize));
      return;
    }

    if (requestPath.startsWith('/api/content/spots/') && requestPath.endsWith('/like') && requestMethod === 'POST') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const spotId = pathSegments[3] ?? '';
      const matchingSpot = findSpot(spotId);

      if (!matchingSpot) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      const updatedSpot = upsertSpot({
        ...matchingSpot,
        liked: true,
        likesCount: matchingSpot.liked ? matchingSpot.likesCount ?? 0 : (matchingSpot.likesCount ?? 0) + 1,
      });

      await fulfillJson(route, 200, {
        data: cloneSpotDetail(updatedSpot),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/spots/') && requestPath.endsWith('/like') && requestMethod === 'DELETE') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const spotId = pathSegments[3] ?? '';
      const matchingSpot = findSpot(spotId);

      if (!matchingSpot) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      const updatedSpot = upsertSpot({
        ...matchingSpot,
        liked: false,
        likesCount: matchingSpot.liked ? Math.max(0, (matchingSpot.likesCount ?? 1) - 1) : matchingSpot.likesCount ?? 0,
      });

      await fulfillJson(route, 200, {
        data: cloneSpotDetail(updatedSpot),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/spots/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const spotId = pathSegments[3] ?? '';
      const matchingSpot = findSpot(spotId);

      if (!matchingSpot) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      if (requestPath.endsWith('/photos')) {
        await fulfillJson(route, 200, {
          data: matchingSpot.photos.map(clonePhoto),
        });
        return;
      }

      await fulfillJson(route, 200, {
        data: cloneSpotDetail(matchingSpot),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/spots/') && requestMethod === 'PUT') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const spotId = pathSegments[3] ?? '';
      const matchingSpot = findSpot(spotId);

      if (!matchingSpot) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      const validationDetails = validateSpotInput(requestBody);

      if (validationDetails.length) {
        await fulfillJson(route, 400, createValidationError(validationDetails));
        return;
      }

      const updatedSpot = upsertSpot(buildSpotDetailFromInput(requestBody, { existingSpot: matchingSpot }));

      await fulfillJson(route, 200, {
        data: cloneSpotDetail(updatedSpot),
      });
      return;
    }

    if (requestPath.startsWith('/api/content/spots/') && requestMethod === 'DELETE') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const spotId = pathSegments[3] ?? '';
      const spotIndex = state.spots.findIndex((spot) => spot.id === spotId);

      if (spotIndex === -1) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'SPOT_NOT_FOUND',
            message: `Spot ${spotId} was not found.`,
          },
        }));
        return;
      }

      state.spots.splice(spotIndex, 1);
      state.feed = state.feed.filter((feedItem) => feedItem.targetId !== spotId);

      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath === '/api/intel/geocode' && requestMethod === 'GET') {
      const query = normalizeString(requestUrl.searchParams.get('q')).toLowerCase();
      const geocodeResults = query.includes('e1500') && query.includes('hollis')
        ? [{
            id: 'pw-e1500-hollis',
            latitude: 34.693,
            longitude: -99.912,
            placeName: 'E1500 Road',
            formattedAddress: 'E1500 Road, Hollis, Oklahoma, United States',
            address: 'E1500 Road',
            city: 'Hollis',
            country: 'United States',
            precision: 'street',
            source: 'playwright',
          }]
        : [];

      await fulfillJson(route, 200, {
        data: geocodeResults,
      });
      return;
    }

    if (requestPath === '/api/intel/travel/nearby' && requestMethod === 'POST') {
      const category = normalizeString(requestBody.category) || 'recommended';
      const endpointSuggestions = [
        {
          id: 'pw-endpoint-quartz-mountain',
          placeId: 'pw-endpoint-quartz-mountain',
          title: 'Quartz Mountain State Park',
          subtitle: 'Scenic endpoint with a real mapped place near the rural start.',
          address: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          category: 'park',
          source: 'google',
          sourceLabel: 'Playwright Google Places fixture',
          distanceKm: 52.4,
          rating: 4.7,
          reviewCount: 320,
          reason: 'Scenic endpoint that gives the trip a real destination instead of raw road text.',
          anchorId: 'resolved-start',
          anchorLabel: 'E1500 Road, Hollis',
        },
        {
          id: 'pw-endpoint-altus',
          placeId: 'pw-endpoint-altus',
          title: 'Downtown Altus',
          subtitle: 'Practical endpoint with food, fuel, and services.',
          address: 'Altus, Oklahoma',
          latitude: 34.638,
          longitude: -99.333,
          category: 'shopping',
          source: 'google',
          sourceLabel: 'Playwright Google Places fixture',
          distanceKm: 38.1,
          reason: 'Good practical finish after a rural road start.',
          anchorId: 'resolved-start',
          anchorLabel: 'E1500 Road, Hollis',
        },
        {
          id: 'pw-endpoint-western-prairie',
          placeId: 'pw-endpoint-western-prairie',
          title: 'Museum of the Western Prairie',
          subtitle: 'Cultural endpoint with a clear address.',
          address: '1100 Memorial Drive, Altus, Oklahoma',
          latitude: 34.652,
          longitude: -99.306,
          category: 'museum',
          source: 'google',
          sourceLabel: 'Playwright Google Places fixture',
          distanceKm: 40.8,
          reason: 'A specific place to end and inspect before building.',
          anchorId: 'resolved-start',
          anchorLabel: 'E1500 Road, Hollis',
        },
      ];

      await fulfillJson(route, 200, {
        data: {
          configured: true,
          coverage: 'Playwright endpoint recommendation fixture',
          source: 'Scope + Google Places',
          category,
          radiusKm: 64,
          suggestions: endpointSuggestions,
        },
      });
      return;
    }

    if (requestPath === '/api/intel/itinerary/generate' && requestMethod === 'POST') {
      await fulfillJson(route, 200, {
        data: buildTripPlannerItinerary(requestBody),
      });
      return;
    }

    await fulfillJson(route, 503, createUnhandledApiError(requestMethod, requestPath));
  });

  return {
    getCurrentSession: () => state.currentSession,
    seedSession: async (page, overrides = {}) => {
      const matchingKnownUser = findKnownUser(overrides);

      state.currentSession = buildAuthSession({
        id: overrides.id ?? matchingKnownUser?.id,
        username: overrides.username ?? matchingKnownUser?.username,
        email: overrides.email ?? matchingKnownUser?.email,
        displayName: overrides.displayName ?? matchingKnownUser?.displayName,
        accessToken: overrides.accessToken,
        refreshToken: overrides.refreshToken,
      });

      await persistMockSessionCookie(page, state.currentSession.id);
      await persistSessionHint(page, state.currentSession.refreshToken);
      return state.currentSession;
    },
    clearSession: async (page) => {
      state.currentSession = null;
      await clearMockSessionCookie(page);
      await clearSessionHint(page);
    },
  };
}

export const test = base.extend<{ scopeApi: ScopeApiMock }>({
  scopeApi: [async ({ page }, use) => {
    const scopeApi = await installScopeApiMocks(page);
    await use(scopeApi);
  }, { auto: true }],
});

export const expect = baseExpect;
