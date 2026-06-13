import api from '@/services/api';
import { USER_MOCK_FALLBACK_ENABLED } from '@/services/demoMode';
import {
  findLocalPreviewUser,
  readCurrentLocalPreviewUser,
  readLocalPreviewUsers,
  removeLocalPreviewUser,
  toLocalPreviewUserProfile,
  updateLocalPreviewUserProfile,
} from '@/services/localPreviewUserStorage';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, ProfileVisibility, UserProfile, UserStats } from '@/types';
import {
  sanitizeAvatarUrl,
  sanitizeMultilineText,
  sanitizeSingleLineText,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import { resolveShowcaseUserProfile } from '@/utils/showcaseActors';

const AUTH_BASE_PATH = '/api/core/auth';
const USERS_BASE_PATH = '/api/core/users';
const CURRENT_USER_CONTENT_PATH = '/api/content/users/me';
const MOCK_USER_CATALOG_ALLOWED_IN_BUILD = import.meta.env.MODE !== 'production' || import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === 'true';
type MockUserCatalogModule = typeof import('@/services/mockUserCatalog');

export interface UpdateUserProfileInput {
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests?: string[];
  showActivityStatus?: boolean;
  profileVisibility?: ProfileVisibility;
}

function normalizeProfileVisibility(value: unknown): ProfileVisibility {
  return value === 'public' || value === 'private' ? value : 'friends';
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
    && typeof candidate.displayName === 'string';
}

function unwrapUserProfilePayload(payload: ApiEnvelope<UserProfile> | UserProfile): UserProfile {
  const unwrappedPayload = unwrapApiData(payload);

  if (!isUserProfilePayload(unwrappedPayload)) {
    throw new Error('Invalid user profile payload');
  }

  return normalizeUserProfilePayload(unwrappedPayload);
}

function normalizeUserProfilePayload(payload: Partial<UserProfile> & Pick<UserProfile, 'id' | 'username' | 'displayName'>): UserProfile {
  return {
    id: payload.id,
    username: payload.username,
    email: typeof payload.email === 'string' ? payload.email : '',
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    bio: payload.bio,
    homeBase: payload.homeBase,
    interests: Array.isArray(payload.interests) ? payload.interests : [],
    stats: payload.stats,
    showActivityStatus: payload.showActivityStatus ?? true,
    profileVisibility: normalizeProfileVisibility(payload.profileVisibility),
  };
}

function sanitizeUserListEnvelope(
  response: ApiEnvelope<UserProfile[]>,
  options: { allowGeneratedAvatar?: boolean } = {},
): ApiEnvelope<UserProfile[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((user) => sanitizeUserProfile(normalizeUserProfilePayload(user), options)),
  };
}

function sanitizeStatsEnvelope(response: ApiEnvelope<UserStats>): ApiEnvelope<UserStats> {
  const rawStats = response.data as UserStats & {
    friendsCount?: number;
    spotsCount?: number;
    tripsCount?: number;
  };
  return {
    ...response,
    data: {
      spots: Math.max(0, rawStats.spots ?? rawStats.spotsCount ?? 0),
      trips: Math.max(0, rawStats.trips ?? rawStats.tripsCount ?? 0),
      friends: Math.max(0, rawStats.friends ?? rawStats.friendsCount ?? 0),
    },
  };
}

const loadMockUserCatalog: () => Promise<MockUserCatalogModule> = MOCK_USER_CATALOG_ALLOWED_IN_BUILD
  ? async () => import('@/services/mockUserCatalog')
  : async () => {
    throw new Error('Local preview users are not available in this production build.');
  };

async function getMockUserOrThrow(userId: string): Promise<UserProfile> {
  const localPreviewUser = findLocalPreviewUser({ id: userId });
  if (localPreviewUser) {
    return toLocalPreviewUserProfile(localPreviewUser);
  }

  const { getCatalogMockUserById } = await loadMockUserCatalog();
  const user = getCatalogMockUserById(userId);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return sanitizeUserProfile(user, { allowGeneratedAvatar: true });
}

async function buildFallbackStats(userId: string): Promise<UserStats> {
  const { getCatalogMockUserById } = await loadMockUserCatalog();
  const user = getCatalogMockUserById(userId);
  const { mockSpots, mockTrips } = await loadMockData();

  return {
    spots: mockSpots.filter((spot) => spot.author?.id === userId).length || user?.stats?.spots || 0,
    trips: mockTrips.filter((trip) => trip.members.some((member) => member.id === userId)).length || user?.stats?.trips || 0,
    friends: user?.stats?.friends || 0,
  };
}

function sanitizeUpdateInput(input: UpdateUserProfileInput): UpdateUserProfileInput {
  const sanitizedInput: UpdateUserProfileInput = {
    username: input.username ? sanitizeSingleLineText(input.username) : undefined,
    email: input.email ? sanitizeSingleLineText(input.email).toLowerCase() : undefined,
    displayName: input.displayName ? sanitizeSingleLineText(input.displayName) : undefined,
    avatarUrl: sanitizeAvatarUrl(input.avatarUrl),
    bio: input.bio ? sanitizeMultilineText(input.bio) : undefined,
    homeBase: input.homeBase ? sanitizeSingleLineText(input.homeBase) : undefined,
    interests: input.interests?.map((interest) => sanitizeSingleLineText(interest)).filter(Boolean),
    showActivityStatus: input.showActivityStatus,
    profileVisibility: input.profileVisibility,
  };

  return Object.fromEntries(
    Object.entries(sanitizedInput).filter(([, value]) => value !== undefined),
  ) as UpdateUserProfileInput;
}

async function updateMockUser(userId: string, updates: UpdateUserProfileInput): Promise<UserProfile> {
  const { catalogMockUsers } = await loadMockUserCatalog();
  const userIndex = catalogMockUsers.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    const localPreviewProfile = updateLocalPreviewUserProfile(userId, sanitizeUpdateInput(updates) as Partial<UserProfile>);
    if (localPreviewProfile) {
      return localPreviewProfile;
    }

    throw new Error(`User ${userId} not found`);
  }

  const nextUser = sanitizeUserProfile({
    ...catalogMockUsers[userIndex],
    ...sanitizeUpdateInput(updates),
  });

  catalogMockUsers.splice(userIndex, 1, nextUser);
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

    const currentLocalPreviewUser = readCurrentLocalPreviewUser();
    const { catalogMockUsers } = await loadMockUserCatalog();
    const user = fallbackUserId
      ? await getMockUserOrThrow(fallbackUserId)
      : currentLocalPreviewUser
        ? toLocalPreviewUserProfile(currentLocalPreviewUser)
        : await getMockUserOrThrow(catalogMockUsers[0]?.id ?? 'user-1');
    return sanitizeUserEnvelope({ data: user });
  }
}

export async function getUserProfile(userId: string): Promise<ApiEnvelope<UserProfile>> {
  try {
    const { data } = await api.get<ApiEnvelope<UserProfile> | UserProfile>(`${USERS_BASE_PATH}/${userId}`);
    return sanitizeUserEnvelope({ data: unwrapUserProfilePayload(data) });
  } catch (error) {
    const showcaseProfile = !USER_MOCK_FALLBACK_ENABLED ? resolveShowcaseUserProfile(userId) : undefined;
    if (showcaseProfile) {
      return sanitizeUserEnvelope({ data: showcaseProfile });
    }

    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return sanitizeUserEnvelope({ data: await getMockUserOrThrow(userId) });
  }
}

export async function updateUserProfile(userId: string, updates: UpdateUserProfileInput): Promise<ApiEnvelope<UserProfile>> {
  const sanitizedInput = sanitizeUpdateInput(updates);

  try {
    const { data } = await api.put<ApiEnvelope<UserProfile> | UserProfile>(`${USERS_BASE_PATH}/${userId}`, sanitizedInput);
    return sanitizeUserEnvelope({ data: normalizeUserProfilePayload(unwrapApiData(data) as UserProfile) });
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return sanitizeUserEnvelope({ data: await updateMockUser(userId, sanitizedInput) });
  }
}

export async function deactivateUserProfile(userId: string): Promise<void> {
  try {
    await api.delete(`${USERS_BASE_PATH}/${userId}`);
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    const { catalogMockUsers } = await loadMockUserCatalog();
    const userIndex = catalogMockUsers.findIndex((user) => user.id === userId);

    if (userIndex >= 0) {
      catalogMockUsers.splice(userIndex, 1);
    }
    removeLocalPreviewUser(userId);
  }
}

export async function deleteCurrentUserContent(): Promise<void> {
  await api.delete(CURRENT_USER_CONTENT_PATH, {
    headers: {
      'X-Scope-Account-Deletion': 'confirm',
    },
  });
}

export async function searchUsersLive(query: string, page = 1, pageSize = 10): Promise<ApiEnvelope<UserProfile[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);
  const normalizedSearchQuery = sanitizedQuery.startsWith('@') ? sanitizedQuery.slice(1) : sanitizedQuery;
  const { data } = await api.get<ApiEnvelope<UserProfile[]>>(`${USERS_BASE_PATH}/search`, {
    params: {
      q: normalizedSearchQuery,
      page,
      pageSize,
    },
  });
  return sanitizeUserListEnvelope(data);
}

export async function searchUsers(query: string, page = 1, pageSize = 10): Promise<ApiEnvelope<UserProfile[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);

  try {
    return await searchUsersLive(sanitizedQuery, page, pageSize);
  } catch (error) {
    if (!USER_MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    const normalizedQuery = (sanitizedQuery.startsWith('@') ? sanitizedQuery.slice(1) : sanitizedQuery).toLowerCase();
    const dedupedUsers = new Map<string, UserProfile>();
    const { catalogMockUsers } = await loadMockUserCatalog();
    [...readLocalPreviewUsers().map(toLocalPreviewUserProfile), ...catalogMockUsers].forEach((user) => {
      dedupedUsers.set(user.id, user);
    });
    const matchingUsers = [...dedupedUsers.values()].filter((user) => {
      const searchableContent = [user.username, user.displayName, user.email, user.homeBase].filter(Boolean).join(' ').toLowerCase();
      return searchableContent.includes(normalizedQuery);
    });

    return sanitizeUserListEnvelope(paginateItems(matchingUsers, page, pageSize), { allowGeneratedAvatar: true });
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

    return sanitizeStatsEnvelope({ data: await buildFallbackStats(userId) });
  }
}

export const __userServiceCoverage = import.meta.env.MODE === 'test'
  ? {
      normalizeProfileVisibility,
      isUserProfilePayload,
      unwrapUserProfilePayload,
      normalizeUserProfilePayload,
      sanitizeUserListEnvelope,
      sanitizeStatsEnvelope,
      buildFallbackStats,
      sanitizeUpdateInput,
    }
  : undefined;
