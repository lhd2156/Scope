import { generateItinerary } from '@/services/intelService';
import api from '@/services/api';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Itinerary,
  Trip,
  TripInviteInput,
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
const DEFAULT_FALLBACK_TRIP_PAGE_SIZE = 12;
const LOCAL_TRIPS_STORAGE_KEY = 'scope.local.trips.v1';
let hasObservedLiveTripData = false;

interface TripAvatarSanitizerOptions {
  allowGeneratedMemberAvatars?: boolean;
}

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

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocalTrips(): Trip[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const serializedTrips = window.localStorage.getItem(LOCAL_TRIPS_STORAGE_KEY);
    if (!serializedTrips) {
      return [];
    }

    const parsedTrips = JSON.parse(serializedTrips);
    return Array.isArray(parsedTrips) ? parsedTrips.map((trip) => sanitizeTrip(trip)) : [];
  } catch {
    return [];
  }
}

function writeLocalTrips(trips: Trip[]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_TRIPS_STORAGE_KEY, JSON.stringify(trips.map((trip) => sanitizeTrip(trip))));
  } catch {
    // Local drafts are a development fallback. If storage is unavailable, the
    // in-memory mock list still keeps the current session usable.
  }
}

function mergeLocalTrips(trips: Trip[]): Trip[] {
  const localTrips = readLocalTrips();
  const seenTripIds = new Set<string>();
  return [...localTrips, ...trips].filter((trip) => {
    if (seenTripIds.has(trip.id)) {
      return false;
    }

    seenTripIds.add(trip.id);
    return true;
  });
}

function removeLocalTrip(tripId: string): void {
  writeLocalTrips(readLocalTrips().filter((trip) => trip.id !== tripId));
}

function sanitizeTripEnvelope(
  response: ApiEnvelope<Trip>,
  options: TripAvatarSanitizerOptions = {},
): ApiEnvelope<Trip> {
  return {
    ...response,
    data: sanitizeTrip(response.data, { allowGeneratedMemberAvatars: options.allowGeneratedMemberAvatars }),
  };
}

function sanitizeTripListEnvelope(
  response: ApiEnvelope<Trip[]>,
  options: TripAvatarSanitizerOptions = {},
): ApiEnvelope<Trip[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((trip) =>
      sanitizeTrip(trip, { allowGeneratedMemberAvatars: options.allowGeneratedMemberAvatars }),
    ),
  };
}

function sanitizeTripMemberEnvelope(
  response: ApiEnvelope<TripMember[]>,
  options: TripAvatarSanitizerOptions = {},
): ApiEnvelope<TripMember[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((member) =>
      sanitizeTripMember(member, { allowGeneratedAvatar: options.allowGeneratedMemberAvatars }),
    ),
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

async function loadTripMocks() {
  const { mockTrips, mockUsers } = await loadMockData();

  return {
    mockTrips,
    mockUsers,
    getTripById: (tripId: string) => mockTrips.find((trip) => trip.id === tripId),
  };
}

function rememberLiveTripList(trips: Trip[]): void {
  if (trips.length) {
    hasObservedLiveTripData = true;
  }
}

function rememberLiveTripDetail(): void {
  hasObservedLiveTripData = true;
}

async function buildMockTripListEnvelope(
  page: number,
  pageSize: number,
  filter: (trip: Trip) => boolean = () => true,
): Promise<ApiEnvelope<Trip[]>> {
  const { mockTrips } = await loadTripMocks();
  const fallbackTrips = mockTrips.filter(filter);
  const resolvedPageSize = pageSize || fallbackTrips.length || 1;
  return sanitizeTripListEnvelope(
    paginateItems(fallbackTrips, page, resolvedPageSize),
    { allowGeneratedMemberAvatars: true },
  );
}

async function upsertTrip(nextTrip: Trip): Promise<Trip> {
  const { mockTrips } = await loadTripMocks();
  const sanitizedTrip = sanitizeTrip(nextTrip);
  const tripIndex = mockTrips.findIndex((trip) => trip.id === sanitizedTrip.id);

  if (tripIndex === -1) {
    mockTrips.unshift(sanitizedTrip);
  } else {
    mockTrips.splice(tripIndex, 1, sanitizedTrip);
  }

  const localTrips = readLocalTrips();
  const localTripIndex = localTrips.findIndex((trip) => trip.id === sanitizedTrip.id);
  if (localTripIndex === -1) {
    localTrips.unshift(sanitizedTrip);
  } else {
    localTrips.splice(localTripIndex, 1, sanitizedTrip);
  }
  writeLocalTrips(localTrips);

  return sanitizedTrip;
}

async function buildPersistedTrip(id: string, input: TripMutationInput, existingTrip?: Trip): Promise<Trip> {
  const { mockUsers } = await loadTripMocks();
  const sanitizedInput = sanitizeTripMutationInput(input);
  const owner = sanitizedInput.members?.[0] ?? existingTrip?.members[0] ?? {
    id: mockUsers[0]?.id ?? 'user-1',
    displayName: mockUsers[0]?.displayName ?? 'Local preview user',
    status: 'owner',
  };
  const spots = sanitizedInput.spots ?? existingTrip?.spots ?? [];

  const now = new Date().toISOString();

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
    createdAt: existingTrip?.createdAt ?? now,
    updatedAt: now,
  });
}

function findPersistedTrip(tripId: string, mockTrips: Trip[]): Trip | undefined {
  return readLocalTrips().find((trip) => trip.id === tripId) ?? mockTrips.find((trip) => trip.id === tripId);
}

function formatInviteDisplayName(recipient: string): string {
  const sanitizedRecipient = sanitizeSingleLineText(recipient);
  if (!sanitizedRecipient) {
    return 'Pending traveler';
  }

  if (sanitizedRecipient.includes('@')) {
    const localPart = sanitizedRecipient.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    if (localPart) {
      return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  return sanitizedRecipient;
}

export async function listTrips(page = 1, pageSize = DEFAULT_FALLBACK_TRIP_PAGE_SIZE): Promise<ApiEnvelope<Trip[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(TRIPS_BASE_PATH, { params: { page, pageSize } });
    const sanitizedResponse = sanitizeTripListEnvelope(data);
    rememberLiveTripList(sanitizedResponse.data);

    return sanitizedResponse.data.length || hasObservedLiveTripData
      ? { ...sanitizedResponse, data: mergeLocalTrips(sanitizedResponse.data) }
      : buildMockTripListEnvelope(page, pageSize).then((response) => ({
        ...response,
        data: mergeLocalTrips(response.data),
      }));
  } catch {
    return buildMockTripListEnvelope(page, pageSize).then((response) => ({
      ...response,
      data: mergeLocalTrips(response.data),
    }));
  }
}

export async function listPublicTrips(page = 1, pageSize = DEFAULT_FALLBACK_TRIP_PAGE_SIZE): Promise<ApiEnvelope<Trip[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(`${TRIPS_BASE_PATH}/public`, { params: { page, pageSize } });
    const sanitizedResponse = sanitizeTripListEnvelope(data);
    rememberLiveTripList(sanitizedResponse.data);

    return sanitizedResponse.data.length || hasObservedLiveTripData
      ? sanitizedResponse
      : buildMockTripListEnvelope(page, pageSize, (trip) => trip.isPublic);
  } catch {
    return buildMockTripListEnvelope(page, pageSize, (trip) => trip.isPublic);
  }
}

export async function getTripDetail(tripId: string): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const { mockTrips } = await loadTripMocks();
    const trip = findPersistedTrip(tripId, mockTrips);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }
    return sanitizeTripEnvelope({ data: trip }, { allowGeneratedMemberAvatars: true });
  }
}

export async function createTrip(input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  const sanitizedInput = sanitizeTripMutationInput(input);

  try {
    const { data } = await api.post<ApiEnvelope<Trip> | Trip>(TRIPS_BASE_PATH, sanitizedInput);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const trip = await buildPersistedTrip(`local-trip-${Date.now()}`, sanitizedInput);
    return sanitizeTripEnvelope({ data: await upsertTrip(trip) });
  }
}

export async function updateTrip(tripId: string, input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  const sanitizedInput = sanitizeTripMutationInput(input);

  try {
    const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`, sanitizedInput);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = await buildPersistedTrip(tripId, sanitizedInput, existingTrip);
    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export async function deleteTrip(tripId: string): Promise<void> {
  try {
    await api.delete(`${TRIPS_BASE_PATH}/${tripId}`);
  } catch {
    const { mockTrips } = await loadTripMocks();
    const tripIndex = mockTrips.findIndex((trip) => trip.id === tripId);
    if (tripIndex >= 0) {
      mockTrips.splice(tripIndex, 1);
    }
    removeLocalTrip(tripId);
  }
}

export async function addTripSpot(tripId: string, tripSpot: TripSpot): Promise<ApiEnvelope<Trip>> {
  const sanitizedTripSpot = sanitizeTripSpot(tripSpot);

  try {
    const { data } = await api.post<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots`, sanitizedTripSpot);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = await buildPersistedTrip(
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

    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export async function removeTripSpot(tripId: string, spotId: string): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.delete<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/${spotId}`);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = await buildPersistedTrip(
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

    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export async function reorderTripSpots(
  tripId: string,
  input: ReorderTripSpotsInput,
): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/reorder`, input);
    const sanitizedResponse = sanitizeTripEnvelope({ data: unwrapApiData(data) });
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const spotsById = new Map(existingTrip.spots.map((spot) => [spot.spotId, spot]));
    const orderedSpots = input.orderedSpotIds
      .map((spotId) => spotsById.get(spotId))
      .filter((spot): spot is TripSpot => Boolean(spot));

    const unorderedSpots = existingTrip.spots.filter((spot) => !input.orderedSpotIds.includes(spot.spotId));
    const nextTrip = await buildPersistedTrip(
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

    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export async function getTripMembers(tripId: string): Promise<ApiEnvelope<TripMember[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<TripMember[]>>(`${TRIPS_BASE_PATH}/${tripId}/members`);
    return sanitizeTripMemberEnvelope(data);
  } catch {
    const { mockTrips } = await loadTripMocks();
    const trip = findPersistedTrip(tripId, mockTrips);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    return sanitizeTripMemberEnvelope({ data: trip.members }, { allowGeneratedMemberAvatars: true });
  }
}

export async function inviteTripMember(
  tripId: string,
  input: TripInviteInput,
): Promise<ApiEnvelope<Trip>> {
  const sanitizedInput: TripInviteInput = {
    recipient: sanitizeSingleLineText(input.recipient),
    role: input.role,
    message: input.message ? sanitizeMultilineText(input.message) : undefined,
  };

  try {
    await api.post(`${TRIPS_BASE_PATH}/${tripId}/members`, sanitizedInput);
    return getTripDetail(tripId);
  } catch {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const existingMember = existingTrip.members.find((member) =>
      member.displayName.toLowerCase() === sanitizedInput.recipient.toLowerCase(),
    );
    const nextMembers = existingMember
      ? existingTrip.members
      : [
        ...existingTrip.members,
        sanitizeTripMember({
          id: `invite-${Date.now()}`,
          displayName: formatInviteDisplayName(sanitizedInput.recipient),
          status: sanitizedInput.role,
          inviteStatus: 'pending',
          presence: 'offline',
        }),
      ];
    const nextTrip = await buildPersistedTrip(
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
        members: nextMembers,
        spots: existingTrip.spots,
      },
      existingTrip,
    );

    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export { generateItinerary };
