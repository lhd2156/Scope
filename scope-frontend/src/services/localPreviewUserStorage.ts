import type { UserProfile } from '@/types';
import { sanitizeSingleLineText, sanitizeUserProfile } from '@/utils/sanitizers';

export const LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY = 'scope-local-preview-auth-users-v1';
export const LOCAL_PREVIEW_AUTH_CURRENT_USER_STORAGE_KEY = 'scope-local-preview-auth-current-user-v1';

export interface LocalPreviewStoredUser extends Pick<UserProfile, 'id' | 'username' | 'displayName'> {
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests?: string[];
  stats?: UserProfile['stats'];
  showActivityStatus?: boolean;
}

type LocalPreviewUserCriteria = Partial<Pick<
  LocalPreviewStoredUser,
  'id' | 'email' | 'username' | 'displayName' | 'phoneNumber'
>>;

function getLocalPreviewStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeComparableText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizePhoneDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function isLocalPreviewStoredUser(value: unknown): value is LocalPreviewStoredUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LocalPreviewStoredUser>;
  return Boolean(
    candidate.id?.trim() &&
    candidate.username?.trim() &&
    candidate.displayName?.trim(),
  );
}

function matchesLocalPreviewUser(
  user: LocalPreviewStoredUser,
  criteria: LocalPreviewUserCriteria,
): boolean {
  const expectedPhoneDigits = normalizePhoneDigits(criteria.phoneNumber);

  return Boolean(
    (criteria.id && user.id === criteria.id) ||
    (criteria.email && normalizeComparableText(user.email) === normalizeComparableText(criteria.email)) ||
    (criteria.username && normalizeComparableText(user.username) === normalizeComparableText(criteria.username)) ||
    (criteria.displayName && normalizeComparableText(user.displayName) === normalizeComparableText(criteria.displayName)) ||
    (expectedPhoneDigits && normalizePhoneDigits(user.phoneNumber) === expectedPhoneDigits),
  );
}

function sanitizeLocalPreviewUser(user: LocalPreviewStoredUser): LocalPreviewStoredUser {
  const sanitizedProfile = sanitizeUserProfile({
    id: user.id.trim(),
    username: user.username,
    email: user.email ?? '',
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    homeBase: user.homeBase,
    interests: Array.isArray(user.interests) ? user.interests : [],
    stats: user.stats,
    showActivityStatus: user.showActivityStatus,
  });

  return {
    ...sanitizedProfile,
    phoneNumber: sanitizeSingleLineText(user.phoneNumber),
  };
}

export function readLocalPreviewUsers(): LocalPreviewStoredUser[] {
  const storage = getLocalPreviewStorage();
  let rawValue: string | null | undefined;

  try {
    rawValue = storage?.getItem(LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY);
  } catch {
    return [];
  }

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsedValue)
      ? parsedValue.filter(isLocalPreviewStoredUser).map(sanitizeLocalPreviewUser)
      : [];
  } catch {
    return [];
  }
}

export function writeLocalPreviewUsers(users: LocalPreviewStoredUser[], currentUserId?: string): void {
  const storage = getLocalPreviewStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY,
      JSON.stringify(users.filter(isLocalPreviewStoredUser).map(sanitizeLocalPreviewUser)),
    );

    if (currentUserId) {
      storage.setItem(LOCAL_PREVIEW_AUTH_CURRENT_USER_STORAGE_KEY, currentUserId);
    }
  } catch {
    // Local preview storage is a convenience, never a hard dependency.
  }
}

export function findLocalPreviewUser(criteria: LocalPreviewUserCriteria): LocalPreviewStoredUser | undefined {
  return readLocalPreviewUsers().find((user) => matchesLocalPreviewUser(user, criteria));
}

export function readCurrentLocalPreviewUser(): LocalPreviewStoredUser | undefined {
  const storage = getLocalPreviewStorage();
  let currentUserId: string | undefined;

  try {
    currentUserId = storage?.getItem(LOCAL_PREVIEW_AUTH_CURRENT_USER_STORAGE_KEY)?.trim();
  } catch {
    currentUserId = undefined;
  }

  const users = readLocalPreviewUsers();

  return users.find((user) => user.id === currentUserId) ?? users[users.length - 1];
}

export function rememberLocalPreviewUser(user: LocalPreviewStoredUser): LocalPreviewStoredUser {
  const users = readLocalPreviewUsers();
  const existingIndex = users.findIndex((candidate) => matchesLocalPreviewUser(candidate, {
    id: user.id,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
  }));
  const nextUser = sanitizeLocalPreviewUser(user);

  if (existingIndex >= 0) {
    const existingUser = users[existingIndex];
    users.splice(existingIndex, 1, sanitizeLocalPreviewUser({
      ...existingUser,
      ...nextUser,
      interests: user.interests ? nextUser.interests : existingUser.interests,
      homeBase: user.homeBase !== undefined ? nextUser.homeBase : existingUser.homeBase,
      avatarUrl: user.avatarUrl !== undefined ? nextUser.avatarUrl : existingUser.avatarUrl,
      bio: user.bio !== undefined ? nextUser.bio : existingUser.bio,
      stats: user.stats ?? existingUser.stats,
      showActivityStatus: user.showActivityStatus ?? existingUser.showActivityStatus,
    }));
  } else {
    users.push(nextUser);
  }

  writeLocalPreviewUsers(users.slice(-12), nextUser.id);
  return nextUser;
}

export function toLocalPreviewUserProfile(user: LocalPreviewStoredUser): UserProfile {
  return sanitizeUserProfile({
    id: user.id,
    username: user.username,
    email: user.email ?? '',
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    homeBase: user.homeBase,
    interests: user.interests ?? [],
    stats: user.stats,
    showActivityStatus: user.showActivityStatus,
  });
}

export function updateLocalPreviewUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): UserProfile | null {
  const users = readLocalPreviewUsers();
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    return null;
  }

  const nextUser = sanitizeLocalPreviewUser({
    ...users[userIndex],
    ...updates,
  });
  users.splice(userIndex, 1, nextUser);
  writeLocalPreviewUsers(users, nextUser.id);

  return toLocalPreviewUserProfile(nextUser);
}

export function removeLocalPreviewUser(userId: string): void {
  const users = readLocalPreviewUsers().filter((user) => user.id !== userId);
  writeLocalPreviewUsers(users);
}
