import { generateItinerary } from '@/services/intelService';
import api from '@/services/api';
import { getTripById, mockTrips, mockUsers } from '@/services/mockData';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Itinerary,
  Trip,
  TripMember,
  TripSpot,
  TripStatus,
} from '@/types';
import {
  sanitizeImageUrl,
  sanitizeItinerary,
  sanitizeMultilineText,
  sanitizeSingleLineText,
  sanitizeTrip,
  sanitizeTripMember,
  sanitizeTripSpot,
} from '@/utils/sanitizers';
import { addCalendarDays } from '@/utils/formatters';

const TRIPS_BASE_PATH = '/api/content/trips';
const DEFAULT_TRIP_CURRENCY = 'USD';
const DEFAULT_TRIP_STATUS: TripStatus = 'planning';

export interface TripMutationInput {
  title: string;
  destination: string;
  description?: string;
  isPublic: boolean;
  startDate: string;
  endDate: string;
  budget?: number;
  currency?: string;
  status?: TripStatus;
  coverImageUrl?: string;
  spots?: TripSpot[];
  members?: TripMember[];
}

export interface ReorderTripSpotsInput {
  orderedSpotIds: string[];
}

function sanitizeTripEnvelope(response: ApiEnvelope<Trip>): ApiEnvelope<Trip> {
  return {
    ...response,
    data: sanitizeTrip(response.data),
  };
}

function sanitizeTripListEnvelope(response: ApiEnvelope<Trip[]>): ApiEnvelope<Trip[]> {
  return {
    ...response,
    data: response.data.map((trip) => sanitizeTrip(trip)),
  };
}

function sanitizeTripMemberEnvelope(response: ApiEnvelope<TripMember[]>): ApiEnvelope<TripMember[]> {
  return {
    ...response,
    data: response.data.map((member) => sanitizeTripMember(member)),
  };
}

function sanitizeTripMutationInput(input: TripMutationInput): TripMutationInput {
  return {
    ...input,
    title: sanitizeSingleLineText(input.title),
    destination: sanitizeSingleLineText(input.destination),
    description: input.description ? sanitizeMultilineText(input.description) : undefined,
    currency: input.currency ? sanitizeSingleLineText(input.currency).toUpperCase() : undefined,
    coverImageUrl: sanitizeImageUrl(input.coverImageUrl),
    status: input.status,
    spots: input.spots?.map((spot) => sanitizeTripSpot(spot)),
    members: input.members?.map((member) => sanitizeTripMember(member)),
  };
}

function buildTripItinerary(tripId: string, destination: string, startDate: string, spots: TripSpot[]): Itinerary | undefined {
  if (!spots.length) {
    return undefined;
  }

  const dayLookup = new Map<number, Itinerary['days'][number]>();

  spots.forEach((spot, index) => {
    const dayNumber = spot.dayNumber ?? Math.floor(index / 3) + 1;

    if (!dayLookup.has(dayNumber)) {
      dayLookup.set(dayNumber, {
        dayNumber,
        date: addCalendarDays(startDate, dayNumber - 1),
        spots: [],
      });
    }

    dayLookup.get(dayNumber)?.spots.push({
      ...spot,
      dayNumber,
      timeSlot: spot.timeSlot ?? ['09:00', '12:00', '15:00', '19:00'][index % 4] ?? '20:00',
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

  return sanitizeItinerary({
    id: `itinerary-${tripId}`,
    destination,
    days,
    totalEstimatedCost,
    weatherForecast: 'Live forecast will sync once the intel service is available.',
  });
}

function upsertTrip(nextTrip: Trip): Trip {
  const sanitizedTrip = sanitizeTrip(nextTrip);
  const tripIndex = mockTrips.findIndex((trip) => trip.id === sanitizedTrip.id);

  if (tripIndex === -1) {
    mockTrips.unshift(sanitizedTrip);
  } else {
    mockTrips.splice(tripIndex, 1, sanitizedTrip);
  }

  return sanitizedTrip;
}

function buildPersistedTrip(id: string, input: TripMutationInput, existingTrip?: Trip): Trip {
  const sanitizedInput = sanitizeTripMutationInput(input);
  const owner = sanitizedInput.members?.[0] ?? existingTrip?.members[0] ?? {
    id: mockUsers[0]?.id ?? 'user-1',
    displayName: mockUsers[0]?.displayName ?? 'Louis Do',
    status: 'owner',
  };
  const spots = sanitizedInput.spots ?? existingTrip?.spots ?? [];

  return sanitizeTrip({
    id,
    title: sanitizedInput.title,
    destination: sanitizedInput.destination,
    description: sanitizedInput.description,
    isPublic: sanitizedInput.isPublic,
    startDate: sanitizedInput.startDate,
    endDate: sanitizedInput.endDate,
    spots,
    members: sanitizedInput.members?.length ? sanitizedInput.members : existingTrip?.members ?? [owner],
    itinerary: buildTripItinerary(id, sanitizedInput.destination, sanitizedInput.startDate, spots),
    coverImageUrl: sanitizedInput.coverImageUrl ?? existingTrip?.coverImageUrl ?? spots[0]?.photoUrl,
    budget: sanitizedInput.budget,
    currency: sanitizedInput.currency ?? existingTrip?.currency ?? DEFAULT_TRIP_CURRENCY,
    status: sanitizedInput.status ?? existingTrip?.status ?? DEFAULT_TRIP_STATUS,
  });
}

export async function listTrips(page = 1, pageSize = mockTrips.length || 1): Promise<ApiEnvelope<Trip[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(TRIPS_BASE_PATH, { params: { page, pageSize } });
    return sanitizeTripListEnvelope(data);
  } catch {
    return sanitizeTripListEnvelope(paginateItems(mockTrips, page, pageSize));
  }
}

export async function listPublicTrips(page = 1, pageSize = mockTrips.length || 1): Promise<ApiEnvelope<Trip[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(`${TRIPS_BASE_PATH}/public`, { params: { page, pageSize } });
    return sanitizeTripListEnvelope(data);
  } catch {
    return sanitizeTripListEnvelope(
      paginateItems(
        mockTrips.filter((trip) => trip.isPublic),
        page,
        pageSize,
      ),
    );
  }
}

export async function getTripDetail(tripId: string): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const trip = getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }
    return sanitizeTripEnvelope({ data: trip });
  }
}

export async function createTrip(input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  const sanitizedInput = sanitizeTripMutationInput(input);

  try {
    const { data } = await api.post<ApiEnvelope<Trip> | Trip>(TRIPS_BASE_PATH, sanitizedInput);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const trip = buildPersistedTrip(`trip-${Date.now()}`, sanitizedInput);
    return sanitizeTripEnvelope({ data: upsertTrip(trip) });
  }
}

export async function updateTrip(tripId: string, input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  const sanitizedInput = sanitizeTripMutationInput(input);

  try {
    const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`, sanitizedInput);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingTrip = getTripById(tripId);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    return sanitizeTripEnvelope({ data: upsertTrip(buildPersistedTrip(tripId, sanitizedInput, existingTrip)) });
  }
}

export async function deleteTrip(tripId: string): Promise<void> {
  try {
    await api.delete(`${TRIPS_BASE_PATH}/${tripId}`);
  } catch {
    const tripIndex = mockTrips.findIndex((trip) => trip.id === tripId);
    if (tripIndex >= 0) {
      mockTrips.splice(tripIndex, 1);
    }
  }
}

export async function addTripSpot(tripId: string, tripSpot: TripSpot): Promise<ApiEnvelope<Trip>> {
  const sanitizedTripSpot = sanitizeTripSpot(tripSpot);

  try {
    const { data } = await api.post<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots`, sanitizedTripSpot);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingTrip = getTripById(tripId);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = buildPersistedTrip(
      tripId,
      {
        title: existingTrip.title,
        destination: existingTrip.destination,
        description: existingTrip.description,
        isPublic: existingTrip.isPublic,
        startDate: existingTrip.startDate,
        endDate: existingTrip.endDate,
        budget: existingTrip.budget,
        currency: existingTrip.currency,
        status: existingTrip.status,
        coverImageUrl: existingTrip.coverImageUrl,
        members: existingTrip.members,
        spots: [...existingTrip.spots, sanitizedTripSpot],
      },
      existingTrip,
    );

    return sanitizeTripEnvelope({ data: upsertTrip(nextTrip) });
  }
}

export async function removeTripSpot(tripId: string, spotId: string): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.delete<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/${spotId}`);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingTrip = getTripById(tripId);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = buildPersistedTrip(
      tripId,
      {
        title: existingTrip.title,
        destination: existingTrip.destination,
        description: existingTrip.description,
        isPublic: existingTrip.isPublic,
        startDate: existingTrip.startDate,
        endDate: existingTrip.endDate,
        budget: existingTrip.budget,
        currency: existingTrip.currency,
        status: existingTrip.status,
        coverImageUrl: existingTrip.coverImageUrl,
        members: existingTrip.members,
        spots: existingTrip.spots.filter((spot) => spot.spotId !== spotId),
      },
      existingTrip,
    );

    return sanitizeTripEnvelope({ data: upsertTrip(nextTrip) });
  }
}

export async function reorderTripSpots(
  tripId: string,
  input: ReorderTripSpotsInput,
): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/reorder`, input);
    return sanitizeTripEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingTrip = getTripById(tripId);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const spotsById = new Map(existingTrip.spots.map((spot) => [spot.spotId, spot]));
    const orderedSpots = input.orderedSpotIds
      .map((spotId) => spotsById.get(spotId))
      .filter((spot): spot is TripSpot => Boolean(spot));

    const unorderedSpots = existingTrip.spots.filter((spot) => !input.orderedSpotIds.includes(spot.spotId));
    const nextTrip = buildPersistedTrip(
      tripId,
      {
        title: existingTrip.title,
        destination: existingTrip.destination,
        description: existingTrip.description,
        isPublic: existingTrip.isPublic,
        startDate: existingTrip.startDate,
        endDate: existingTrip.endDate,
        budget: existingTrip.budget,
        currency: existingTrip.currency,
        status: existingTrip.status,
        coverImageUrl: existingTrip.coverImageUrl,
        members: existingTrip.members,
        spots: [...orderedSpots, ...unorderedSpots],
      },
      existingTrip,
    );

    return sanitizeTripEnvelope({ data: upsertTrip(nextTrip) });
  }
}

export async function getTripMembers(tripId: string): Promise<ApiEnvelope<TripMember[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<TripMember[]>>(`${TRIPS_BASE_PATH}/${tripId}/members`);
    return sanitizeTripMemberEnvelope(data);
  } catch {
    const trip = getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    return sanitizeTripMemberEnvelope({ data: trip.members });
  }
}

export { generateItinerary };
