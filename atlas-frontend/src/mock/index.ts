import rawFeed from '@/mock/feed.json';
import rawNotifications from '@/mock/notifications.json';
import rawSpots from '@/mock/spots.json';
import rawTrips from '@/mock/trips.json';
import rawUsers from '@/mock/users.json';
import type {
  FeedItem,
  Itinerary,
  MapViewport,
  NotificationItem,
  SpotDetail,
  SpotSummary,
  Trip,
  TripMember,
  TripSpot,
  UserProfile,
} from '@/types';
import {
  sanitizeFeedItem,
  sanitizeNotificationItem,
  sanitizeSpotDetail,
  sanitizeSpotSummary,
  sanitizeTrip,
  sanitizeTripMember,
  sanitizeTripSpot,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import { addCalendarDays } from '@/utils/formatters';

interface DemoActivityHistoryEntry {
  id: string;
  type: string;
  title: string;
  targetType: string;
  targetId: string;
  summary: string;
  location: string;
  occurredAt: string;
}

export interface DemoUserFixture extends UserProfile {
  joinedAt: string;
  isDemoAccount?: boolean;
  activityHistory?: DemoActivityHistoryEntry[];
}

interface DemoTripMemberSeed {
  userId: string;
  status: string;
}

interface DemoTripStopSeed {
  spotId: string;
  dayNumber: number;
  timeSlot: string;
  duration: number;
  estimatedCost: number;
  notes: string;
}

interface DemoTripSeed extends Omit<Trip, 'spots' | 'members' | 'itinerary' | 'coverImageUrl'> {
  coverSpotId?: string;
  weatherForecast: string;
  memberIds: DemoTripMemberSeed[];
  stops: DemoTripStopSeed[];
  costBreakdown?: Record<string, number>;
  highlights?: string[];
}

interface DemoFeedSeed extends Omit<FeedItem, 'actor' | 'imageUrl'> {
  actorId?: string;
  actor?: DemoUserFixture;
  imageUrl?: string | null;
  photoUrl?: string | null;
}

const DEMO_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const FALLBACK_DEMO_VIEWPORT: MapViewport = {
  center: [-97.7431, 30.2672],
  zoom: 5.6,
  style: DEMO_MAP_STYLE,
};

const seededUsers = (rawUsers as DemoUserFixture[]).map((user) => sanitizeUserProfile({ ...user }) as DemoUserFixture);
const demoUserLookup = new Map(seededUsers.map((user) => [user.id, user]));

const seededSpotDetails = (rawSpots as SpotDetail[]).map((spot) => sanitizeSpotDetail({ ...spot } as SpotDetail));
const demoSpotLookup = new Map(seededSpotDetails.map((spot) => [spot.id, spot]));

function requireDemoUser(userId: string): DemoUserFixture {
  const user = demoUserLookup.get(userId);

  if (!user) {
    throw new Error(`Demo user ${userId} not found`);
  }

  return user;
}

function requireDemoSpot(spotId: string): SpotDetail {
  const spot = demoSpotLookup.get(spotId);

  if (!spot) {
    throw new Error(`Demo spot ${spotId} not found`);
  }

  return spot;
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

function buildTripMember(seed: DemoTripMemberSeed): TripMember {
  const user = requireDemoUser(seed.userId);

  return sanitizeTripMember({
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: seed.status,
  });
}

function buildTripSpot(seed: DemoTripStopSeed): TripSpot {
  const spot = requireDemoSpot(seed.spotId);

  return sanitizeTripSpot({
    spotId: spot.id,
    title: spot.title,
    timeSlot: seed.timeSlot,
    duration: seed.duration,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    estimatedCost: seed.estimatedCost,
    photoUrl: spot.photoUrl ?? spot.photos[0]?.url,
    city: spot.city,
    dayNumber: seed.dayNumber,
    notes: seed.notes,
  });
}

function buildItinerary(
  tripId: string,
  destination: string,
  startDate: string,
  spots: TripSpot[],
  weatherForecast: string,
): Itinerary {
  const dayLookup = new Map<number, Itinerary['days'][number]>();

  spots.forEach((spot) => {
    const dayNumber = spot.dayNumber ?? 1;
    const existingDay = dayLookup.get(dayNumber);

    if (existingDay) {
      existingDay.spots.push(spot);
      return;
    }

    dayLookup.set(dayNumber, {
      dayNumber,
      date: addCalendarDays(startDate, dayNumber - 1),
      spots: [spot],
    });
  });

  const days = [...dayLookup.values()]
    .sort((left, right) => left.dayNumber - right.dayNumber)
    .map((day) => ({
      ...day,
      spots: [...day.spots].sort((left, right) => (left.timeSlot ?? '').localeCompare(right.timeSlot ?? '')),
    }));

  const totalEstimatedCost = days
    .flatMap((day) => day.spots)
    .reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);

  return {
    id: `${tripId}-itinerary`,
    destination,
    days,
    totalEstimatedCost,
    weatherForecast,
  };
}

const seededTrips = (rawTrips as DemoTripSeed[]).map((seed) => {
  const { coverSpotId, weatherForecast, memberIds, stops, ...tripMeta } = seed;
  const tripSpots = stops.map((stop) => buildTripSpot(stop));
  const coverSpot = coverSpotId ? requireDemoSpot(coverSpotId) : undefined;

  return sanitizeTrip({
    ...tripMeta,
    members: memberIds.map((member) => buildTripMember(member)),
    spots: tripSpots,
    itinerary: buildItinerary(seed.id, seed.destination, seed.startDate, tripSpots, weatherForecast),
    coverImageUrl: coverSpot?.photoUrl ?? coverSpot?.photos[0]?.url ?? tripSpots[0]?.photoUrl,
  });
});

function buildFeedItem(seed: DemoFeedSeed): FeedItem {
  const actor = seed.actor ? sanitizeUserProfile({ ...seed.actor }) : undefined;
  const actorId = seed.actorId ?? actor?.id;

  if (!actor && !actorId) {
    throw new Error(`Demo feed item ${seed.id} is missing an actor reference`);
  }

  return sanitizeFeedItem({
    id: seed.id,
    type: seed.type,
    actor: actor ?? requireDemoUser(actorId!),
    title: seed.title,
    excerpt: seed.excerpt,
    createdAt: seed.createdAt,
    imageUrl: seed.imageUrl ?? seed.photoUrl ?? undefined,
    targetId: seed.targetId,
  });
}

function buildDemoViewport(spots: SpotDetail[]): MapViewport {
  if (!spots.length) {
    return FALLBACK_DEMO_VIEWPORT;
  }

  const totals = spots.reduce(
    (accumulator, spot) => ({
      latitude: accumulator.latitude + spot.latitude,
      longitude: accumulator.longitude + spot.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    center: [
      Number((totals.longitude / spots.length).toFixed(4)),
      Number((totals.latitude / spots.length).toFixed(4)),
    ],
    zoom: FALLBACK_DEMO_VIEWPORT.zoom,
    style: FALLBACK_DEMO_VIEWPORT.style,
  };
}

export const demoUsers = seededUsers.map((user) => ({ ...user }));
export const demoSpots = seededSpotDetails.map((spot) => toSpotSummary(spot));
export const demoSpotDetails = seededSpotDetails.reduce<Record<string, SpotDetail>>((accumulator, spot) => {
  accumulator[spot.id] = sanitizeSpotDetail({ ...spot });
  return accumulator;
}, {});
export const demoTrips = seededTrips.map((trip) => sanitizeTrip({ ...trip }));
export const demoFeed = (rawFeed as DemoFeedSeed[]).map((seed) => buildFeedItem(seed));
export const demoNotifications = (rawNotifications as NotificationItem[]).map((notification) =>
  sanitizeNotificationItem({ ...notification }),
);
export const demoViewport = buildDemoViewport(seededSpotDetails);
