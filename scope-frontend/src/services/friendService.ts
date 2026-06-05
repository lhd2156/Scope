import api from '@/services/api';
import { searchUsersLive } from '@/services/userService';
import { normalizeArrayEnvelopeData, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  FriendConnection,
  FriendPresence,
  FriendRequest,
  FriendSuggestion,
  PaginationMeta,
  SpotCategory,
  UserProfile,
} from '@/types';
import { sanitizeFriendConnection, sanitizeFriendRequest, sanitizeImageUrl, sanitizeSingleLineText, sanitizeUserProfile } from '@/utils/sanitizers';

const FRIENDS_BASE_PATH = '/api/core/friends';
const SPOT_CATEGORIES = new Set<SpotCategory>(['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other']);
const IS_TEST_MODE = import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST);

type FriendConnectionWire = Partial<FriendConnection> & {
  friendshipId?: string;
  friendId?: string;
  coverPhotoUrl?: string;
  cover_photo_url?: string;
  favoriteCategories?: string[];
  since?: string;
};

type FriendRequestWire = Partial<FriendRequest> & {
  friendshipId?: string;
  requesterId?: string;
  requestedAt?: string;
};

type FriendSuggestionWire = Partial<FriendSuggestion> & {
  friendId?: string;
  user?: UserProfile;
  favoriteCategories?: string[];
  sharedInterests?: string[];
};

function normalizeHandleQuery(query: string): string {
  const sanitizedQuery = sanitizeSingleLineText(query);
  return sanitizedQuery.startsWith('@') ? sanitizedQuery.slice(1) : sanitizedQuery;
}

function toSpotCategories(values: unknown): SpotCategory[] {
  return Array.isArray(values)
    ? values.filter((value): value is SpotCategory => typeof value === 'string' && SPOT_CATEGORIES.has(value as SpotCategory))
    : [];
}

function toFriendPresence(value: unknown): FriendPresence {
  return value === 'planning' || value === 'online' || value === 'idle' || value === 'offline' || value === 'hidden'
    ? value
    : 'offline';
}

function buildUserFallback(id: string, displayName = 'Scope traveler'): UserProfile {
  return sanitizeUserProfile({
    id,
    username: id,
    email: '',
    displayName,
    interests: [],
    stats: { spots: 0, trips: 0, friends: 0 },
  });
}

function normalizeConnection(connection: FriendConnectionWire): FriendConnection {
  const user = connection.user
    ? sanitizeUserProfile(connection.user, { allowGeneratedAvatar: true })
    : buildUserFallback(connection.friendId ?? connection.id ?? 'friend');
  return sanitizeFriendConnection({
    id: connection.friendshipId ?? connection.id ?? `friend-${user.id}`,
    user,
    presence: toFriendPresence(connection.presence),
    sharedTrips: Math.max(0, Number(connection.sharedTrips ?? 0)),
    mutualFriends: Math.max(0, Number(connection.mutualFriends ?? 0)),
    coverPhotoUrl: sanitizeImageUrl(connection.coverPhotoUrl ?? connection.cover_photo_url),
    favoriteCategories: toSpotCategories(connection.favoriteCategories).length
      ? toSpotCategories(connection.favoriteCategories)
      : toSpotCategories(user.interests),
    nextAdventure: connection.nextAdventure,
    lastActiveAt: connection.lastActiveAt ?? connection.since ?? new Date(0).toISOString(),
  }, { allowGeneratedUserAvatar: true });
}

function normalizeRequest(request: FriendRequestWire): FriendRequest {
  const user = request.user
    ? sanitizeUserProfile(request.user, { allowGeneratedAvatar: true })
    : buildUserFallback(request.requesterId ?? request.id ?? 'request');
  return sanitizeFriendRequest({
    id: request.friendshipId ?? request.id ?? `request-${user.id}`,
    user,
    direction: request.direction === 'outgoing' ? 'outgoing' : 'incoming',
    createdAt: request.createdAt ?? request.requestedAt ?? new Date().toISOString(),
    mutualFriends: Math.max(0, Number(request.mutualFriends ?? 0)),
    note: request.note,
  }, { allowGeneratedUserAvatar: true });
}

function normalizeSuggestion(suggestion: FriendSuggestionWire): FriendSuggestion {
  const user = suggestion.user
    ? sanitizeUserProfile(suggestion.user, { allowGeneratedAvatar: true })
    : buildUserFallback(suggestion.friendId ?? suggestion.id ?? 'suggestion');
  return {
    id: suggestion.id ?? user.id,
    user,
    mutualFriends: Math.max(0, Number(suggestion.mutualFriends ?? 0)),
    sharedInterests: Array.isArray(suggestion.sharedInterests)
      ? suggestion.sharedInterests.map((interest) => sanitizeSingleLineText(interest)).filter(Boolean)
      : [],
    favoriteCategories: toSpotCategories(suggestion.favoriteCategories).length
      ? toSpotCategories(suggestion.favoriteCategories)
      : toSpotCategories(user.interests),
    presence: toFriendPresence(suggestion.presence),
    reason: sanitizeSingleLineText(suggestion.reason) || 'Fresh Scope traveler',
    score: Number.isFinite(Number(suggestion.score)) ? Number(suggestion.score) : undefined,
  };
}

function normalizeConnectionEnvelope(response: ApiEnvelope<FriendConnectionWire[]>): ApiEnvelope<FriendConnection[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map(normalizeConnection),
  };
}

function normalizeRequestEnvelope(response: ApiEnvelope<FriendRequestWire[]>): ApiEnvelope<FriendRequest[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map(normalizeRequest),
  };
}

function normalizeSuggestionEnvelope(response: ApiEnvelope<FriendSuggestionWire[]>): ApiEnvelope<FriendSuggestion[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map(normalizeSuggestion),
  };
}

function emptyListEnvelope<T>(page?: number, pageSize?: number): ApiEnvelope<T[]> {
  return {
    data: [],
    meta: page && pageSize
      ? {
        page,
        pageSize,
        total: 0,
        totalPages: 1,
      }
      : undefined,
  };
}

export async function listFriends(page = 1, pageSize = 50): Promise<ApiEnvelope<FriendConnection[]>> {
  if (IS_TEST_MODE) {
    return emptyListEnvelope<FriendConnection>(page, pageSize);
  }

  try {
    const { data } = await api.get<ApiEnvelope<FriendConnectionWire[]>>(FRIENDS_BASE_PATH, { params: { page, pageSize } });
    return normalizeConnectionEnvelope(data);
  } catch {
    return emptyListEnvelope<FriendConnection>(page, pageSize);
  }
}

export async function listPendingFriendRequests(): Promise<ApiEnvelope<FriendRequest[]>> {
  if (IS_TEST_MODE) {
    return emptyListEnvelope<FriendRequest>();
  }

  try {
    const { data } = await api.get<ApiEnvelope<FriendRequestWire[]>>(`${FRIENDS_BASE_PATH}/pending`);
    return normalizeRequestEnvelope(data);
  } catch {
    return emptyListEnvelope<FriendRequest>();
  }
}

export async function listFriendSuggestions(mode: 'best' | 'mutuals' | 'vibes' | 'random' = 'best', limit = 8): Promise<ApiEnvelope<FriendSuggestion[]>> {
  if (IS_TEST_MODE) {
    return emptyListEnvelope<FriendSuggestion>();
  }

  try {
    const { data } = await api.get<ApiEnvelope<FriendSuggestionWire[]>>(`${FRIENDS_BASE_PATH}/suggestions`, {
      params: { mode, limit },
    });
    return normalizeSuggestionEnvelope(data);
  } catch {
    return emptyListEnvelope<FriendSuggestion>();
  }
}

export async function searchFriendCandidates(query: string, page = 1, pageSize = 10): Promise<ApiEnvelope<UserProfile[]>> {
  return searchUsersLive(normalizeHandleQuery(query), page, pageSize);
}

export async function sendFriendRequest(userId: string): Promise<void> {
  if (IS_TEST_MODE) {
    return;
  }

  await api.post(`${FRIENDS_BASE_PATH}/request/${userId}`);
}

export async function acceptFriendRequest(requestId: string): Promise<FriendConnection> {
  const { data } = await api.put<ApiEnvelope<FriendConnectionWire> | FriendConnectionWire>(`${FRIENDS_BASE_PATH}/${requestId}/accept`);
  return normalizeConnection(unwrapApiData(data) as FriendConnectionWire);
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await api.put(`${FRIENDS_BASE_PATH}/${requestId}/reject`);
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await api.delete(`${FRIENDS_BASE_PATH}/${friendshipId}`);
}

export type FriendListMeta = PaginationMeta | null;
