import { expect as baseExpect, test as base, type Page, type Request, type Route } from '@playwright/test';

const VISUAL_QA_FLAG = '__SCOPE_VISUAL_QA__';
const DEFAULT_PASSWORD = 'SecurePass123!';
const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
const AUTH_SESSION_HINT_VERSION = 1;
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
  stats?: {
    spots: number;
    trips: number;
    friends: number;
  };
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

function getPlannerStopCount(totalDays: number, pace: string, availableCount: number): number {
  const extraStops = pace === 'packed' ? 2 : pace === 'moderate' ? 1 : 0;
  return Math.min(availableCount, Math.max(totalDays, totalDays + extraStops));
}

function buildTripPlannerItinerary(requestBody: Record<string, unknown>): ScopeItinerary {
  const destination = normalizeString(requestBody.destination) || 'Patagonia, Chile + Argentina';
  const startDate = normalizeString(requestBody.startDate) || '2026-11-03';
  const endDate = normalizeString(requestBody.endDate) || startDate;
  const pace = normalizeString(requestBody.pace).toLowerCase() || 'moderate';
  const totalDays = Math.max(1, Math.min(getInclusiveDaySpan(startDate, endDate), 5));
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

  const itineraryDays = days.filter((day) => day.spots.length > 0);
  const totalEstimatedCost = itineraryDays
    .flatMap((day) => day.spots)
    .reduce((total, stop) => total + (stop.estimatedCost ?? 0), 0);

  return {
    id: `itinerary-${destination.replace(/\s+/g, '-').toLowerCase()}`,
    destination,
    days: itineraryDays,
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

async function persistSessionHint(page: Page): Promise<void> {
  const serializedHint = JSON.stringify(buildSessionHint());

  await page.context().addInitScript(
    ({ storageKey, storageValue }) => {
      window.localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: AUTH_SESSION_HINT_STORAGE_KEY,
      storageValue: serializedHint,
    },
  );
}

async function clearSessionHint(page: Page): Promise<void> {
  await page.context().addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, AUTH_SESSION_HINT_STORAGE_KEY);
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
    feed: ScopeFeedItem[];
    notifications: ScopeNotificationItem[];
  } = {
    currentSession: null,
    trips: buildSeedTrips(registeredUsers),
    feed: buildSeedFeed(registeredUsers),
    notifications: buildSeedNotifications(),
  };

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
    const requestPath = requestUrl.pathname;
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

    if (requestPath === '/api/core/notifications' && requestMethod === 'GET') {
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.notifications.length || 1)) || state.notifications.length || 1;
      const pageSize = Math.max(1, requestedPageSize);
      const startIndex = Math.max(0, (pageNumber - 1) * pageSize);
      const pagedNotifications = state.notifications.slice(startIndex, startIndex + pageSize).map(cloneNotification);

      await fulfillJson(route, 200, {
        data: pagedNotifications,
        meta: {
          page: pageNumber,
          pageSize,
          total: state.notifications.length,
          totalPages: Math.max(1, Math.ceil(state.notifications.length / pageSize)),
        },
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

    if (requestPath === '/api/content/feed' && requestMethod === 'GET') {
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
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? '1') || 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('pageSize') ?? String(state.trips.length || 1)) || state.trips.length || 1;
      const pageSize = Math.max(1, requestedPageSize);
      const startIndex = Math.max(0, (pageNumber - 1) * pageSize);
      const pagedTrips = state.trips.slice(startIndex, startIndex + pageSize).map(cloneTrip);

      await fulfillJson(route, 200, {
        data: pagedTrips,
        meta: {
          page: pageNumber,
          pageSize,
          total: state.trips.length,
          totalPages: Math.max(1, Math.ceil(state.trips.length / pageSize)),
        },
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
      await persistSessionHint(page);
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
