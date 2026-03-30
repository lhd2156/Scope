import api from '@/services/api';
import { mockSpots, mockTrips, mockUsers } from '@/services/mockData';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, UserProfile, UserStats } from '@/types';
import {
  sanitizeImageUrl,
  sanitizeMultilineText,
  sanitizeSingleLineText,
  sanitizeUserProfile,
} from '@/utils/sanitizers';

const AUTH_BASE_PATH = '/api/core/auth';
const USERS_BASE_PATH = '/api/core/users';
const USER_MOCK_FALLBACK_ENABLED =
  import.meta.env.VITE_ENABLE_USER_MOCK_FALLBACK === 'true' || import.meta.env.VITE_ENABLE_AUTH_MOCK_FALLBACK === 'true';

export interface UpdateUserProfileInput {
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests?: string[];
}

function sanitizeUserEnvelope(response: ApiEnvelope<UserProfile>): ApiEnvelope<UserProfile> {
  return {
    ...response,
    data: sanitizeUserProfile(response.data),
  };
}

function isUserProfilePayload(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<UserProfile>;
  return typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.email === 'string'
    && typeof candidate.displayName === 'string'
    && Array.isArray(candidate.interests);
}

function unwrapUserProfilePayload(payload: ApiEnvelope<UserProfile> | UserProfile): UserProfile {
  const unwrappedPayload = unwrapApiData(payload);

  if (!isUserProfilePayload(unwrappedPayload)) {
    throw new Error('Invalid user profile payload');
  }

  return unwrappedPayload;
}

function sanitizeUserListEnvelope(response: ApiEnvelope<UserProfile[]>): ApiEnvelope<UserProfile[]> {
  return {
    ...response,
    data: response.data.map((user) => sanitizeUserProfile(user)),
  };
}

function sanitizeStatsEnvelope(response: ApiEnvelope<UserStats>): ApiEnvelope<UserStats> {
  return {
    ...response,
    data: {
      spots: Math.max(0, response.data.spots ?? 0),
      trips: Math.max(0, response.data.trips ?? 0),
      friends: Math.max(0, response.data.friends ?? 0),
    },
  };
}

function resolveUserIndex(userId: string): number {
  return mockUsers.findIndex((user) => user.id === userId);
}

function getMockUserOrThrow(userId: string): UserProfile {
  const user = mockUsers.find((entry) => entry.id === userId);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return sanitizeUserProfile(user);
}

function buildFallbackStats(userId: string): UserStats {
  const user = mockUsers.find((entry) => entry.id === userId);

  return {
    spots: mockSpots.filter((spot) => spot.author?.id === userId).length || user?.stats?.spots || 0,
    trips: mockTrips.filter((trip) => trip.members.some((member) => member.id === userId)).length || user?.stats?.trips || 0,
    friends: user?.stats?.friends || 0,
  };
}

function sanitizeUpdateInput(input: UpdateUserProfileInput): UpdateUserProfileInput {
  return {
    username: input.username ? sanitizeSingleLineText(input.username) : undefined,
    email: input.email ? sanitizeSingleLineText(input.email).toLowerCase() : undefined,
    displayName: input.displayName ? sanitizeSingleLineText(input.displayName) : undefined,
    avatarUrl: sanitizeImageUrl(input.avatarUrl),
    bio: input.bio ? sanitizeMultilineText(input.bio) : undefined,
    homeBase: input.homeBase ? sanitizeSingleLineText(input.homeBase) : undefined,
    interests: input.interests?.map((interest) => sanitizeSingleLineText(interest)).filter(Boolean),
  };
}

function updateMockUser(userId: string, updates: UpdateUserProfileInput): UserProfile {
  const userIndex = resolveUserIndex(userId);

  if (userIndex === -1) {
    throw new Error(`User ${userId} not found`);
  }

  const nextUser = sanitizeUserProfile({
    ...mockUsers[userIndex],
    ...sanitizeUpdateInput(updates),
  });

  mockUsers.splice(userIndex, 1, nextUser);
  return nextUser;
}

export async function getCurrentUserProfile(fallbackUserId?: string): Promise<ApiEnvelope<UserProfile>> {
  try {
    const { data } = await api.get<ApiEnvelope<UserProfile> | UserProfile>(`${AUTH_BASE_PATH}/me`);
    return sanitizeUserEnvelope({ data: unwrapUserProfilePayload(data) });
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    const user = getMockUserOrThrow(fallbackUserId ?? mockUsers[0]?.id ?? 'user-1');
    return sanitizeUserEnvelope({ data: user });
  }
}

export async function getUserProfile(userId: string): Promise<ApiEnvelope<UserProfile>> {
  try {
    const { data } = await api.get<ApiEnvelope<UserProfile> | UserProfile>(`${USERS_BASE_PATH}/${userId}`);
    return sanitizeUserEnvelope({ data: unwrapUserProfilePayload(data) });
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return sanitizeUserEnvelope({ data: getMockUserOrThrow(userId) });
  }
}

export async function updateUserProfile(userId: string, updates: UpdateUserProfileInput): Promise<ApiEnvelope<UserProfile>> {
  const sanitizedInput = sanitizeUpdateInput(updates);

  try {
    const { data } = await api.put<ApiEnvelope<UserProfile> | UserProfile>(`${USERS_BASE_PATH}/${userId}`, sanitizedInput);
    return sanitizeUserEnvelope({ data: unwrapApiData(data) });
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return sanitizeUserEnvelope({ data: updateMockUser(userId, sanitizedInput) });
  }
}

export async function deactivateUserProfile(userId: string): Promise<void> {
  try {
    await api.delete(`${USERS_BASE_PATH}/${userId}`);
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    const userIndex = resolveUserIndex(userId);

    if (userIndex >= 0) {
      mockUsers.splice(userIndex, 1);
    }
  }
}

export async function searchUsers(query: string, page = 1, pageSize = 10): Promise<ApiEnvelope<UserProfile[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);

  try {
    const { data } = await api.get<ApiEnvelope<UserProfile[]>>(`${USERS_BASE_PATH}/search`, {
      params: {
        q: sanitizedQuery,
        page,
        pageSize,
      },
    });
    return sanitizeUserListEnvelope(data);
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    const normalizedQuery = sanitizedQuery.toLowerCase();
    const matchingUsers = mockUsers.filter((user) => {
      const searchableContent = [user.username, user.displayName, user.email, user.homeBase].filter(Boolean).join(' ').toLowerCase();
      return searchableContent.includes(normalizedQuery);
    });

    return sanitizeUserListEnvelope(paginateItems(matchingUsers, page, pageSize));
  }
}

export async function getUserStats(userId: string): Promise<ApiEnvelope<UserStats>> {
  try {
    const { data } = await api.get<ApiEnvelope<UserStats> | UserStats>(`${USERS_BASE_PATH}/${userId}/stats`);
    return sanitizeStatsEnvelope({ data: unwrapApiData(data) });
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return sanitizeStatsEnvelope({ data: buildFallbackStats(userId) });
  }
}
