import { generateItinerary } from '@/services/intelService';
import api from '@/services/api';
import { DEMO_MODE_ENABLED } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, unwrapApiData } from '@/services/serviceUtils';
import { getUserProfile, searchUsers } from '@/services/userService';
import type {
  ApiEnvelope,
  Itinerary,
  Trip,
  TripInviteInput,
  TripMember,
  TripSpot,
  TripStatus,
  UserProfile,
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
const TRIPS_COLLECTION_PATH = `${TRIPS_BASE_PATH}/`;
const DEFAULT_TRIP_CURRENCY = 'USD';
const DEFAULT_TRIP_STATUS: TripStatus = 'planning';
const DEFAULT_FALLBACK_TRIP_PAGE_SIZE = 12;
const LOCAL_TRIPS_STORAGE_KEY = 'scope.local.trips.v1';
const LOCAL_TRIP_SHARES_STORAGE_KEY = 'scope.local.trip-shares.v1';
const LOCAL_TRIP_SHARE_TOKEN_PREFIX = 'demo-trip-';
const TRIP_MOCK_FALLBACK_ENABLED = DEMO_MODE_ENABLED ||
  import.meta.env.VITE_ENABLE_TRIP_MOCK_FALLBACK === 'true';
const TRIP_LOCAL_WRITE_FALLBACK_ENABLED = DEMO_MODE_ENABLED ||
  import.meta.env.VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK === 'true';
let hasObservedLiveTripData = false;

interface TripMemberIdentity {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

const tripMemberIdentityCache = new Map<string, Promise<TripMemberIdentity | null>>();

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

export interface TripShareLink {
  token: string;
  path: string;
  url: string;
}

interface TripApiMutationInput {
  title: string;
  destination: string;
  description?: string;
  is_public: boolean;
  start_date: string;
  end_date: string;
  budget?: number;
  currency?: string;
  status?: TripStatus;
  cover_photo_url?: string;
  spots?: TripApiSpotInput[];
  members?: TripApiMemberInput[];
}

interface TripApiSpotInput {
  spot_id?: string;
  title: string;
  latitude: number;
  longitude: number;
  category: string;
  city?: string;
  day_number?: number;
  sort_order?: number;
  notes?: string;
}

interface TripApiMemberInput {
  user_id: string;
  role: 'editor' | 'viewer';
}

interface TripShareResponse {
  token: string;
  path: string;
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

function readLocalTripShares(): Record<string, string> {
  if (!canUseLocalStorage()) {
    return {};
  }

  try {
    const serializedShares = window.localStorage.getItem(LOCAL_TRIP_SHARES_STORAGE_KEY);
    if (!serializedShares) {
      return {};
    }

    const parsedShares = JSON.parse(serializedShares);
    return parsedShares && typeof parsedShares === 'object' && !Array.isArray(parsedShares)
      ? Object.fromEntries(Object.entries(parsedShares).filter((entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ))
      : {};
  } catch {
    return {};
  }
}

function writeLocalTripShares(shares: Record<string, string>): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_TRIP_SHARES_STORAGE_KEY, JSON.stringify(shares));
  } catch {
    // Share links stay best-effort in local demo mode.
  }
}

function removeLocalTripSharesForTrip(tripId: string): void {
  const shares = readLocalTripShares();
  const nextShares = Object.fromEntries(Object.entries(shares).filter(([, sharedTripId]) => sharedTripId !== tripId));
  writeLocalTripShares(nextShares);
}

function mergeLocalTrips(trips: Trip[]): Trip[] {
  if (!TRIP_LOCAL_WRITE_FALLBACK_ENABLED) {
    return trips;
  }

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
  removeLocalTripSharesForTrip(tripId);
}

function encodeLocalShareTrip(trip: Trip): string {
  if (typeof btoa !== 'function' || typeof TextEncoder === 'undefined') {
    return '';
  }

  const serializedTrip = JSON.stringify(sanitizeTrip(trip, { allowGeneratedMemberAvatars: true }));
  const bytes = new TextEncoder().encode(serializedTrip);
  let binaryPayload = '';
  bytes.forEach((byte) => {
    binaryPayload += String.fromCharCode(byte);
  });

  return btoa(binaryPayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeLocalShareTrip(token: string): Trip | null {
  if (!token.startsWith(LOCAL_TRIP_SHARE_TOKEN_PREFIX) || typeof atob !== 'function' || typeof TextDecoder === 'undefined') {
    return null;
  }

  try {
    const encodedPayload = token.slice(LOCAL_TRIP_SHARE_TOKEN_PREFIX.length);
    const paddedPayload = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
    const parsedTrip = JSON.parse(new TextDecoder().decode(bytes));
    return sanitizeTrip(parsedTrip, { allowGeneratedMemberAvatars: true });
  } catch {
    return null;
  }
}

function createLocalShareToken(tripId: string, trip: Trip): string {
  const encodedTrip = encodeLocalShareTrip(trip);
  if (encodedTrip) {
    return `${LOCAL_TRIP_SHARE_TOKEN_PREFIX}${encodedTrip}`;
  }

  const normalizedTripId = tripId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return [normalizedTripId || 'trip', randomPart].join('-');
}

function buildTripShareLink(token: string): TripShareLink {
  const path = `/trips/shared/${token}`;
  return {
    token,
    path,
    url: typeof window === 'undefined' ? path : `${window.location.origin}${path}`,
  };
}

async function createLocalTripShareLink(tripId: string): Promise<TripShareLink> {
  const { mockTrips } = await loadTripMocks();
  const trip = findPersistedTrip(tripId, mockTrips);
  if (!trip) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const shares = readLocalTripShares();
  const existingToken = Object.entries(shares).find(([, sharedTripId]) => sharedTripId === tripId)?.[0];
  const token = existingToken?.startsWith(LOCAL_TRIP_SHARE_TOKEN_PREFIX)
    ? existingToken
    : createLocalShareToken(tripId, trip);
  shares[token] = tripId;
  writeLocalTripShares(shares);

  return buildTripShareLink(token);
}

async function getLocalTripByShareToken(token: string): Promise<ApiEnvelope<Trip>> {
  const sanitizedToken = sanitizeSingleLineText(token);
  const sharedTrip = decodeLocalShareTrip(sanitizedToken);
  if (sharedTrip) {
    return sanitizeTripEnvelope({ data: sharedTrip }, { allowGeneratedMemberAvatars: true });
  }

  const shares = readLocalTripShares();
  const tripId = shares[sanitizedToken];
  if (!tripId) {
    throw new Error('That share link is invalid or expired.');
  }

  const { mockTrips } = await loadTripMocks();
  const trip = findPersistedTrip(tripId, mockTrips);
  if (!trip) {
    throw new Error('That shared trip could not be found.');
  }

  return sanitizeTripEnvelope({ data: trip }, { allowGeneratedMemberAvatars: true });
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

function rememberTripMemberIdentity(identity: TripMemberIdentity | UserProfile | TripMember | null | undefined): void {
  if (!identity?.id || !identity.displayName?.trim()) {
    return;
  }

  const sanitizedIdentity = sanitizeTripMember({
    id: identity.id,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
  });

  if (!sanitizedIdentity.id || /^Traveler [0-9a-f]{8}$/i.test(sanitizedIdentity.displayName)) {
    return;
  }

  tripMemberIdentityCache.set(sanitizedIdentity.id, Promise.resolve({
    id: sanitizedIdentity.id,
    displayName: sanitizedIdentity.displayName,
    avatarUrl: sanitizedIdentity.avatarUrl,
  }));
}

function rememberTripMemberIdentities(members: readonly TripMember[] | null | undefined): void {
  members?.forEach((member) => rememberTripMemberIdentity(member));
}

async function resolveTripMemberIdentity(member: TripMember): Promise<TripMemberIdentity | null> {
  const sanitizedMember = sanitizeTripMember(member);
  if (!isUuid(sanitizedMember.id)) {
    return null;
  }

  const cachedIdentity = tripMemberIdentityCache.get(sanitizedMember.id);
  if (cachedIdentity) {
    return cachedIdentity;
  }

  const identityPromise = getUserProfile(sanitizedMember.id)
    .then(({ data }) => ({
      id: data.id,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    }))
    .catch(() => null);
  tripMemberIdentityCache.set(sanitizedMember.id, identityPromise);
  return identityPromise;
}

async function enrichTripMember(member: TripMember): Promise<TripMember> {
  const identity = await resolveTripMemberIdentity(member);
  if (!identity) {
    return member;
  }

  return sanitizeTripMember({
    ...member,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl ?? member.avatarUrl,
  });
}

async function enrichTripMembers(members: TripMember[]): Promise<TripMember[]> {
  if (DEMO_MODE_ENABLED || !members.length) {
    return members;
  }

  return Promise.all(members.map((member) => enrichTripMember(member)));
}

async function enrichTrip(trip: Trip): Promise<Trip> {
  return {
    ...trip,
    members: await enrichTripMembers(trip.members),
  };
}

async function enrichTripEnvelope(response: ApiEnvelope<Trip>): Promise<ApiEnvelope<Trip>> {
  return {
    ...response,
    data: await enrichTrip(response.data),
  };
}

async function enrichTripListEnvelope(response: ApiEnvelope<Trip[]>): Promise<ApiEnvelope<Trip[]>> {
  return {
    ...response,
    data: await Promise.all(response.data.map((trip) => enrichTrip(trip))),
  };
}

async function enrichTripMemberEnvelope(response: ApiEnvelope<TripMember[]>): Promise<ApiEnvelope<TripMember[]>> {
  return {
    ...response,
    data: await enrichTripMembers(response.data),
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

function toApiTripSpotInput(spot: TripSpot, index = 0): TripApiSpotInput {
  const sanitizedSpot = sanitizeTripSpot(spot);
  return {
    spot_id: sanitizedSpot.spotId,
    title: sanitizedSpot.title,
    latitude: sanitizedSpot.latitude,
    longitude: sanitizedSpot.longitude,
    category: sanitizedSpot.category,
    city: sanitizedSpot.city,
    day_number: sanitizedSpot.dayNumber,
    sort_order: index,
    notes: sanitizedSpot.notes,
  };
}

function toApiTripMemberInput(member: TripMember): TripApiMemberInput | null {
  const sanitizedMember = sanitizeTripMember(member);
  if (!sanitizedMember.id || sanitizedMember.status === 'owner') {
    return null;
  }

  return {
    user_id: sanitizedMember.id,
    role: sanitizedMember.status === 'editor' ? 'editor' : 'viewer',
  };
}

function toApiTripMutationInput(input: TripMutationInput): TripApiMutationInput {
  const sanitizedInput = sanitizeTripMutationInput(input);
  return {
    title: sanitizedInput.title,
    destination: sanitizedInput.destination,
    description: sanitizedInput.description,
    is_public: sanitizedInput.isPublic,
    start_date: sanitizedInput.startDate,
    end_date: sanitizedInput.endDate,
    budget: sanitizedInput.budget,
    currency: sanitizedInput.currency,
    status: sanitizedInput.status,
    cover_photo_url: sanitizedInput.coverImageUrl,
    spots: sanitizedInput.spots?.map((spot, index) => toApiTripSpotInput(spot, index)),
    members: sanitizedInput.members?.map(toApiTripMemberInput).filter((member): member is TripApiMemberInput => Boolean(member)),
  };
}

function unwrapTripResponse(data: ApiEnvelope<Trip> | Trip | ApiEnvelope<{ trip?: Trip }> | { trip?: Trip }): Trip {
  const unwrapped = unwrapApiData(data as ApiEnvelope<Trip> | Trip);
  if (typeof unwrapped === 'object' && unwrapped !== null && 'trip' in unwrapped) {
    return (unwrapped as { trip?: Trip }).trip as Trip;
  }

  return unwrapped as Trip;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

async function resolveInviteUser(recipient: string): Promise<UserProfile> {
  const sanitizedRecipient = sanitizeSingleLineText(recipient);
  if (isUuid(sanitizedRecipient)) {
    return {
      id: sanitizedRecipient,
      username: sanitizedRecipient,
      displayName: `Traveler ${sanitizedRecipient.slice(0, 8)}`,
      email: '',
      interests: [],
    };
  }

  const response = await searchUsers(sanitizedRecipient, 1, 10);
  const normalizedRecipient = sanitizedRecipient.toLowerCase();
  const matchedUser = response.data.find((user) =>
    user.id.toLowerCase() === normalizedRecipient ||
    user.email?.toLowerCase() === normalizedRecipient ||
    user.username.toLowerCase() === normalizedRecipient ||
    user.displayName.toLowerCase() === normalizedRecipient,
  ) ?? response.data[0];

  if (!matchedUser) {
    throw new Error('That traveler was not found. Share the link or invite a registered Scope user.');
  }

  rememberTripMemberIdentity(matchedUser);
  return matchedUser;
}

async function resolveInviteUserId(recipient: string): Promise<string> {
  return (await resolveInviteUser(recipient)).id;
}

async function fallbackCreateTrip(input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  const trip = await buildPersistedTrip(`local-trip-${Date.now()}`, sanitizeTripMutationInput(input));
  return sanitizeTripEnvelope({ data: await upsertTrip(trip) });
}

function shouldUseTripWriteFallback(_error: unknown): boolean {
  if (!TRIP_LOCAL_WRITE_FALLBACK_ENABLED) {
    return false;
  }

  return DEMO_MODE_ENABLED || import.meta.env.VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK === 'true';
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
    displayName: mockUsers[0]?.displayName ?? 'Scope traveler',
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
  if (DEMO_MODE_ENABLED) {
    return buildMockTripListEnvelope(page, pageSize).then((response) => ({
      ...response,
      data: mergeLocalTrips(response.data),
    }));
  }

  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(TRIPS_COLLECTION_PATH, { params: { page, pageSize } });
    const sanitizedResponse = await enrichTripListEnvelope(sanitizeTripListEnvelope(data));
    rememberLiveTripList(sanitizedResponse.data);

    if (!TRIP_MOCK_FALLBACK_ENABLED) {
      return sanitizedResponse;
    }

    return sanitizedResponse.data.length || hasObservedLiveTripData
      ? { ...sanitizedResponse, data: mergeLocalTrips(sanitizedResponse.data) }
      : buildMockTripListEnvelope(page, pageSize).then((response) => ({
        ...response,
        data: mergeLocalTrips(response.data),
      }));
  } catch (error) {
    if (!TRIP_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return buildMockTripListEnvelope(page, pageSize).then((response) => ({
      ...response,
      data: mergeLocalTrips(response.data),
    }));
  }
}

export async function listPublicTrips(page = 1, pageSize = DEFAULT_FALLBACK_TRIP_PAGE_SIZE): Promise<ApiEnvelope<Trip[]>> {
  if (DEMO_MODE_ENABLED) {
    return buildMockTripListEnvelope(page, pageSize, (trip) => trip.isPublic);
  }

  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>(`${TRIPS_BASE_PATH}/public`, { params: { page, pageSize } });
    const sanitizedResponse = await enrichTripListEnvelope(sanitizeTripListEnvelope(data));
    rememberLiveTripList(sanitizedResponse.data);

    if (!TRIP_MOCK_FALLBACK_ENABLED) {
      return sanitizedResponse;
    }

    return sanitizedResponse.data.length || hasObservedLiveTripData
      ? sanitizedResponse
      : buildMockTripListEnvelope(page, pageSize, (trip) => trip.isPublic);
  } catch (error) {
    if (!TRIP_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return buildMockTripListEnvelope(page, pageSize, (trip) => trip.isPublic);
  }
}

export async function getTripDetail(tripId: string): Promise<ApiEnvelope<Trip>> {
  if (DEMO_MODE_ENABLED) {
    const { mockTrips } = await loadTripMocks();
    const trip = findPersistedTrip(tripId, mockTrips);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }
    return sanitizeTripEnvelope({ data: trip }, { allowGeneratedMemberAvatars: true });
  }

  try {
    const { data } = await api.get<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`);
    const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapApiData(data) }));
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch (error) {
    if (!TRIP_MOCK_FALLBACK_ENABLED && !TRIP_LOCAL_WRITE_FALLBACK_ENABLED) {
      throw error;
    }

    const { mockTrips } = await loadTripMocks();
    const trip = findPersistedTrip(tripId, mockTrips);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }
    return sanitizeTripEnvelope({ data: trip }, { allowGeneratedMemberAvatars: true });
  }
}

export async function createTrip(input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  rememberTripMemberIdentities(input.members);
  const apiInput = toApiTripMutationInput(input);

  if (DEMO_MODE_ENABLED) {
    return fallbackCreateTrip(input);
  }

  try {
    const { data } = await api.post<ApiEnvelope<Trip> | Trip>(TRIPS_COLLECTION_PATH, apiInput);
    const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch (error) {
    if (shouldUseTripWriteFallback(error)) {
      return fallbackCreateTrip(input);
    }
    throw error;
  }
}

export async function updateTrip(tripId: string, input: TripMutationInput): Promise<ApiEnvelope<Trip>> {
  rememberTripMemberIdentities(input.members);
  const apiInput = toApiTripMutationInput(input);

  if (DEMO_MODE_ENABLED) {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const nextTrip = await buildPersistedTrip(tripId, sanitizeTripMutationInput(input), existingTrip);
    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }

  try {
    const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}`, apiInput);
    const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
    rememberLiveTripDetail();
    return sanitizedResponse;
  } catch (error) {
    if (!shouldUseTripWriteFallback(error)) {
      throw error;
    }

    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);

    const nextTrip = await buildPersistedTrip(tripId, sanitizeTripMutationInput(input), existingTrip);
    return sanitizeTripEnvelope({ data: await upsertTrip(nextTrip) });
  }
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    const { mockTrips } = await loadTripMocks();
    const tripIndex = mockTrips.findIndex((trip) => trip.id === tripId);
    if (tripIndex >= 0) {
      mockTrips.splice(tripIndex, 1);
    }
    removeLocalTrip(tripId);
    return;
  }

  await api.delete(`${TRIPS_BASE_PATH}/${tripId}`);
  removeLocalTripSharesForTrip(tripId);
}

export async function addTripSpot(tripId: string, tripSpot: TripSpot): Promise<ApiEnvelope<Trip>> {
  const sanitizedTripSpot = sanitizeTripSpot(tripSpot);

  if (DEMO_MODE_ENABLED) {
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

  const { data } = await api.post<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots`, toApiTripSpotInput(sanitizedTripSpot));
  const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
  rememberLiveTripDetail();
  return sanitizedResponse;
}

export async function removeTripSpot(tripId: string, spotId: string): Promise<ApiEnvelope<Trip>> {
  if (DEMO_MODE_ENABLED) {
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

  const { data } = await api.delete<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/${spotId}`);
  const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
  rememberLiveTripDetail();
  return sanitizedResponse;
}

export async function reorderTripSpots(
  tripId: string,
  input: ReorderTripSpotsInput,
): Promise<ApiEnvelope<Trip>> {
  const apiInput = {
    spots: input.orderedSpotIds.map((spotId, index) => ({
      spotId,
      sortOrder: index,
    })),
  };

  if (DEMO_MODE_ENABLED) {
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

  const { data } = await api.put<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/${tripId}/spots/reorder`, apiInput);
  const sanitizedResponse = await enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
  rememberLiveTripDetail();
  return sanitizedResponse;
}

export async function getTripMembers(tripId: string): Promise<ApiEnvelope<TripMember[]>> {
  if (DEMO_MODE_ENABLED) {
    const { mockTrips } = await loadTripMocks();
    const trip = findPersistedTrip(tripId, mockTrips);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    return sanitizeTripMemberEnvelope({ data: trip.members }, { allowGeneratedMemberAvatars: true });
  }

  const { data } = await api.get<ApiEnvelope<TripMember[]>>(`${TRIPS_BASE_PATH}/${tripId}/members`);
  return enrichTripMemberEnvelope(sanitizeTripMemberEnvelope(data));
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

  if (DEMO_MODE_ENABLED) {
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

  const userId = await resolveInviteUserId(sanitizedInput.recipient);
  await api.post(`${TRIPS_BASE_PATH}/${tripId}/members`, {
    user_id: userId,
    role: sanitizedInput.role,
  });
  return getTripDetail(tripId);
}

export async function updateTripMemberRole(
  tripId: string,
  userId: string,
  role: TripInviteInput['role'],
): Promise<ApiEnvelope<Trip>> {
  if (DEMO_MODE_ENABLED) {
    const { mockTrips } = await loadTripMocks();
    const existingTrip = findPersistedTrip(tripId, mockTrips);
    if (!existingTrip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const targetMember = existingTrip.members.find((member) => member.id === userId && member.status !== 'owner');
    if (!targetMember) {
      throw new Error('That traveler was not found or cannot be changed.');
    }

    const nextMembers = existingTrip.members.map((member) =>
      member.id === userId && member.status !== 'owner'
        ? sanitizeTripMember({ ...member, status: role })
        : member,
    );

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

  await api.post(`${TRIPS_BASE_PATH}/${tripId}/members`, {
    user_id: userId,
    role,
  });
  return getTripDetail(tripId);
}

export async function createTripShareLink(tripId: string): Promise<TripShareLink> {
  if (DEMO_MODE_ENABLED) {
    return createLocalTripShareLink(tripId);
  }

  const { data } = await api.post<ApiEnvelope<TripShareResponse> | TripShareResponse>(`${TRIPS_BASE_PATH}/${tripId}/share`);
  const shareData = unwrapApiData(data);
  const path = shareData.path || `/trips/shared/${shareData.token}`;
  return {
    token: shareData.token,
    path,
    url: typeof window === 'undefined' ? path : `${window.location.origin}${path}`,
  };
}

export async function getTripByShareToken(token: string): Promise<ApiEnvelope<Trip>> {
  if (DEMO_MODE_ENABLED) {
    return getLocalTripByShareToken(token);
  }

  const { data } = await api.get<ApiEnvelope<Trip> | Trip>(`${TRIPS_BASE_PATH}/share/${token}`);
  return enrichTripEnvelope(sanitizeTripEnvelope({ data: unwrapTripResponse(data) }));
}

export const __tripServiceCoverage = import.meta.env.MODE === 'test'
  ? {
      buildMockTripListEnvelope,
      buildPersistedTrip,
      buildTripItinerary,
      buildTripShareLink,
      canUseLocalStorage,
      createLocalShareToken,
      decodeLocalShareTrip,
      encodeLocalShareTrip,
      fallbackCreateTrip,
      findPersistedTrip,
      formatInviteDisplayName,
      isUuid,
      mergeLocalTrips,
      readLocalTripShares,
      readLocalTrips,
      removeLocalTripSharesForTrip,
      sanitizeTripEnvelope,
      sanitizeTripListEnvelope,
      sanitizeTripMemberEnvelope,
      sanitizeTripMutationInput,
      shouldUseTripWriteFallback,
      toApiTripMemberInput,
      toApiTripMutationInput,
      toApiTripSpotInput,
      unwrapTripResponse,
      writeLocalTripShares,
      writeLocalTrips,
    }
  : undefined;

export { generateItinerary };
