import api from '@/services/api';
import {
  AUTH_MOCK_FALLBACK_ENABLED,
  DEMO_LOGIN_EMAIL as LOCAL_PREVIEW_LOGIN_EMAIL,
  DEMO_LOGIN_ERROR_MESSAGE as LOCAL_PREVIEW_LOGIN_ERROR_MESSAGE,
  DEMO_LOGIN_PASSWORD as LOCAL_PREVIEW_LOGIN_PASSWORD,
  DEMO_MODE_ENABLED as LOCAL_PREVIEW_MODE_ENABLED,
} from '@/services/demoMode';
import {
  findLocalPreviewUser,
  readCurrentLocalPreviewUser,
  rememberLocalPreviewUser,
  type LocalPreviewStoredUser,
} from '@/services/localPreviewUserStorage';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, AuthForm, AuthPayload, RegisterForm, RegisterPayload, UserProfile } from '@/types';
import { readStoredRefreshToken } from '@/utils/authSessionStorage';
import { sanitizeAuthForm, sanitizeAuthPayload, sanitizeRegisterForm } from '@/utils/sanitizers';

const AUTH_BASE_PATH = '/api/core/auth';

function randomPreviewToken(prefix: string): string {
  // Local preview tokens are randomized so they cannot be reused across sessions
  // or mistaken for a shared default credential.
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint32Array(4))).map((n) => n.toString(16)).join('')
    : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}-${rnd}`;
}

const DEFAULT_PREVIEW_ACCESS_TOKEN = randomPreviewToken('session-access');
const DEFAULT_PREVIEW_REFRESH_TOKEN = randomPreviewToken('session-refresh');
const LIVE_REFRESH_SESSION_REUSE_MS = 5_000;
const FALLBACK_USER = {
  id: 'user-1',
  username: 'scope-user',
  email: '',
  displayName: 'Scope traveler',
};

const EMAIL_IDENTIFIER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_IDENTIFIER_REGEX = /^[+\d().\-\s]+$/;
const AUTH_MOCK_USERS_ALLOWED_IN_BUILD = import.meta.env.MODE !== 'production' || import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === 'true';
type AuthMockUsersModule = typeof import('@/services/mockAuthUsers');

const loadAuthMockUsers: () => Promise<AuthMockUsersModule> = AUTH_MOCK_USERS_ALLOWED_IN_BUILD
  ? async () => import('@/services/mockAuthUsers')
  : async () => {
    throw new Error('Offline auth users are not available in this build.');
  };

function slugifyIdentifier(identifier: string): string {
  return identifier
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'local-user';
}

function titleizeIdentifier(identifier: string): string {
  const normalized = identifier.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function rememberLocalPreviewAuthPayload(payload: AuthPayload): AuthPayload {
  const sanitizedPayload = sanitizeAuthPayload(payload);

  rememberLocalPreviewUser({
    id: sanitizedPayload.id,
    username: sanitizedPayload.username,
    email: sanitizedPayload.email,
    displayName: sanitizedPayload.displayName ?? sanitizedPayload.username,
    avatarUrl: sanitizedPayload.avatarUrl,
    homeBase: sanitizedPayload.homeBase,
    interests: Array.isArray(payload.interests) ? sanitizedPayload.interests : undefined,
    showActivityStatus: payload.showActivityStatus,
  });

  return sanitizedPayload;
}

function buildLocalPreviewUserFromRegistration(payload: RegisterPayload): LocalPreviewStoredUser {
  const username = payload.username.trim() || slugifyIdentifier(payload.email.split('@')[0] ?? 'account');
  const existingUser = findLocalPreviewUser({
    username,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
  });

  return rememberLocalPreviewUser({
    id: existingUser?.id ?? `local-${username}`,
    username,
    email: payload.email,
    displayName: payload.displayName,
    phoneNumber: payload.phoneNumber,
  });
}

export interface RefreshSessionOptions {
  allowMockFallback?: boolean;
}

const liveRefreshSessionPromises = new Map<string, Promise<AuthPayload>>();
const recentLiveRefreshSessions = new Map<string, { payload: AuthPayload; expiresAt: number }>();

async function findMatchingMockUser(
  criteria: Partial<Pick<UserProfile, 'id' | 'email' | 'username' | 'displayName'>>,
): Promise<UserProfile | undefined> {
  if (import.meta.env.MODE === 'production' && import.meta.env.VITE_ENABLE_LOCAL_PREVIEW !== 'true') {
    return undefined;
  }

  const { findAuthMockUser } = await loadAuthMockUsers();
  return findAuthMockUser(criteria);
}

function pruneRecentLiveRefreshSessions(now = Date.now()): void {
  for (const [refreshToken, cachedSession] of recentLiveRefreshSessions) {
    if (cachedSession.expiresAt <= now) {
      recentLiveRefreshSessions.delete(refreshToken);
    }
  }
}

async function requestLiveRefreshSession(): Promise<AuthPayload> {
  const refreshToken = readStoredRefreshToken();
  const now = Date.now();
  pruneRecentLiveRefreshSessions(now);

  if (!refreshToken) {
    throw new Error('No stored refresh token is available.');
  }

  const recentSession = recentLiveRefreshSessions.get(refreshToken);
  if (recentSession && recentSession.expiresAt > now) {
    return recentSession.payload;
  }

  const inFlightRefresh = liveRefreshSessionPromises.get(refreshToken);
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refreshPromise = api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/refresh`, {
    refreshToken,
  }).then(({ data }) => {
    const payload = sanitizeAuthPayload(unwrapApiData(data));
    if (refreshToken) {
      recentLiveRefreshSessions.set(refreshToken, {
        payload,
        expiresAt: Date.now() + LIVE_REFRESH_SESSION_REUSE_MS,
      });
    }
    return payload;
  }).finally(() => {
    if (refreshToken) {
      liveRefreshSessionPromises.delete(refreshToken);
    }
  });

  liveRefreshSessionPromises.set(refreshToken, refreshPromise);

  return refreshPromise;
}

async function findMatchingAuthUser(
  criteria: Partial<Pick<LocalPreviewStoredUser, 'id' | 'email' | 'username' | 'displayName' | 'phoneNumber'>>,
): Promise<LocalPreviewStoredUser | UserProfile | undefined> {
  return findLocalPreviewUser(criteria) ?? findMatchingMockUser(criteria);
}

async function buildLoginFallbackIdentity(identifier: string): Promise<Partial<AuthPayload>> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    return {};
  }

  const compactIdentifier = normalizedIdentifier.replace(/\s+/g, '');
  const matchingUser = await findMatchingAuthUser({
    email: compactIdentifier.toLowerCase(),
    username: normalizedIdentifier,
    displayName: normalizedIdentifier,
    phoneNumber: normalizedIdentifier,
  });

  if (matchingUser) {
    return {
      id: matchingUser.id,
      username: matchingUser.username,
      email: matchingUser.email,
      displayName: matchingUser.displayName,
    };
  }

  if (EMAIL_IDENTIFIER_REGEX.test(compactIdentifier)) {
    const email = compactIdentifier.toLowerCase();
    const localPart = email.split('@')[0] ?? '';
    const username = slugifyIdentifier(localPart);

    return {
      id: `local-${username}`,
      username,
      email,
      displayName: titleizeIdentifier(localPart) || username,
    };
  }

  const phoneDigits = normalizedIdentifier.replace(/\D/g, '');

  if (PHONE_IDENTIFIER_REGEX.test(normalizedIdentifier) && phoneDigits.length >= 7) {
    return {
      id: `local-phone-${phoneDigits.slice(-4)}`,
      username: `phone-${phoneDigits.slice(-4)}`,
      displayName: 'Scope traveler',
    };
  }

  const username = slugifyIdentifier(normalizedIdentifier);

  return {
    id: `local-${username}`,
    username,
    displayName: titleizeIdentifier(normalizedIdentifier) || normalizedIdentifier,
  };
}

async function buildFallbackAuthPayload(overrides: Partial<AuthPayload> = {}): Promise<AuthPayload> {
  const matchingUser = await findMatchingAuthUser({
    id: overrides.id,
    email: overrides.email,
    username: overrides.username,
  });

  return sanitizeAuthPayload({
    id: overrides.id ?? matchingUser?.id ?? FALLBACK_USER.id,
    username: overrides.username ?? matchingUser?.username ?? FALLBACK_USER.username,
    email: overrides.email ?? matchingUser?.email ?? FALLBACK_USER.email,
    displayName: overrides.displayName ?? matchingUser?.displayName ?? FALLBACK_USER.displayName,
    avatarUrl: overrides.avatarUrl ?? matchingUser?.avatarUrl,
    homeBase: overrides.homeBase ?? matchingUser?.homeBase,
    interests: overrides.interests ?? matchingUser?.interests,
    showActivityStatus: overrides.showActivityStatus ?? matchingUser?.showActivityStatus,
    accessToken: overrides.accessToken ?? DEFAULT_PREVIEW_ACCESS_TOKEN,
    refreshToken: overrides.refreshToken ?? DEFAULT_PREVIEW_REFRESH_TOKEN,
  });
}

async function buildLocalPreviewAuthPayload(overrides: Partial<AuthPayload> = {}): Promise<AuthPayload> {
  const previewEmail = LOCAL_PREVIEW_LOGIN_EMAIL || FALLBACK_USER.email;
  const previewUser = await findMatchingMockUser({ email: previewEmail });

  return buildFallbackAuthPayload({
    id: previewUser?.id,
    username: previewUser?.username,
    email: previewEmail,
    displayName: previewUser?.displayName,
    accessToken: overrides.accessToken,
    refreshToken: overrides.refreshToken,
  });
}

function assertLocalPreviewCredentials(credentials: AuthForm): void {
  const sanitizedCredentials = sanitizeAuthForm(credentials);

  if (
    !LOCAL_PREVIEW_LOGIN_EMAIL ||
    !LOCAL_PREVIEW_LOGIN_PASSWORD ||
    sanitizedCredentials.email !== LOCAL_PREVIEW_LOGIN_EMAIL ||
    sanitizedCredentials.password !== LOCAL_PREVIEW_LOGIN_PASSWORD
  ) {
    throw new Error(LOCAL_PREVIEW_LOGIN_ERROR_MESSAGE);
  }
}

function hasUsableAuthTokens(payload: Partial<AuthPayload> | null | undefined): payload is AuthPayload {
  return Boolean(payload?.accessToken?.trim() && payload?.refreshToken?.trim());
}

export async function login(credentials: AuthForm): Promise<AuthPayload> {
  const sanitizedCredentials = sanitizeAuthForm(credentials);

  if (LOCAL_PREVIEW_MODE_ENABLED) {
    assertLocalPreviewCredentials(sanitizedCredentials);
    return buildLocalPreviewAuthPayload();
  }

  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/login`, sanitizedCredentials);
    const livePayload = sanitizeAuthPayload(unwrapApiData(data));
    return AUTH_MOCK_FALLBACK_ENABLED ? rememberLocalPreviewAuthPayload(livePayload) : livePayload;
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      const fallbackPayload = await buildFallbackAuthPayload(await buildLoginFallbackIdentity(sanitizedCredentials.email));
      return rememberLocalPreviewAuthPayload(fallbackPayload);
    }

    throw error;
  }
}

export async function register(payload: RegisterForm): Promise<AuthPayload> {
  const sanitizedPayload = sanitizeRegisterForm(payload);

  if (LOCAL_PREVIEW_MODE_ENABLED) {
    return rememberLocalPreviewAuthPayload(
      await buildFallbackAuthPayload(buildLocalPreviewUserFromRegistration(sanitizedPayload)),
    );
  }

  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/register`, sanitizedPayload);
    const unwrappedPayload = unwrapApiData(data);

    if (hasUsableAuthTokens(unwrappedPayload)) {
      const livePayload = sanitizeAuthPayload(unwrappedPayload);
      return AUTH_MOCK_FALLBACK_ENABLED ? rememberLocalPreviewAuthPayload(livePayload) : livePayload;
    }

    return login({
      email: sanitizedPayload.email,
      password: sanitizedPayload.password,
      rememberMe: false,
    });
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      return rememberLocalPreviewAuthPayload(
        await buildFallbackAuthPayload(buildLocalPreviewUserFromRegistration(sanitizedPayload)),
      );
    }

    throw error;
  }
}

export async function refreshSession(options: RefreshSessionOptions = {}): Promise<AuthPayload> {
  if (LOCAL_PREVIEW_MODE_ENABLED) {
    return buildLocalPreviewAuthPayload({
      accessToken: `${DEFAULT_PREVIEW_ACCESS_TOKEN}-${Date.now()}`,
      refreshToken: DEFAULT_PREVIEW_REFRESH_TOKEN,
    });
  }

  try {
    return await requestLiveRefreshSession();
  } catch (error) {
    if (options.allowMockFallback && AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload({
        ...readCurrentLocalPreviewUser(),
        accessToken: `${DEFAULT_PREVIEW_ACCESS_TOKEN}-${Date.now()}`,
        refreshToken: DEFAULT_PREVIEW_REFRESH_TOKEN,
      });
    }

    throw error;
  }
}

export async function logout(refreshToken = readStoredRefreshToken()): Promise<void> {
  if (LOCAL_PREVIEW_MODE_ENABLED) {
    return;
  }

  try {
    await api.post(`${AUTH_BASE_PATH}/logout`, { refreshToken });
  } catch {
    // Local development uses mock auth until the backend contract is live.
  }
}

export async function loginWithCognito(idToken: string): Promise<AuthPayload> {
  if (LOCAL_PREVIEW_MODE_ENABLED) {
    return buildLocalPreviewAuthPayload();
  }

  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/oauth/cognito`, {
      idToken: idToken.trim(),
    });
    const livePayload = sanitizeAuthPayload(unwrapApiData(data));
    return AUTH_MOCK_FALLBACK_ENABLED ? rememberLocalPreviewAuthPayload(livePayload) : livePayload;
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload();
    }

    throw error;
  }
}
