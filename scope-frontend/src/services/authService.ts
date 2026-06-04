import api from '@/services/api';
import {
  AUTH_MOCK_FALLBACK_ENABLED,
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_ERROR_MESSAGE,
  DEMO_LOGIN_PASSWORD,
  DEMO_MODE_ENABLED,
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

function randomDemoToken(prefix: string): string {
  // Demo tokens must be unpredictable so they cannot be reused across sessions
  // or mistaken for a shared "default" credential. These values are ONLY ever
  // used when the local demo/mock fallback is explicitly enabled at build time.
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint32Array(4))).map((n) => n.toString(16)).join('')
    : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}-${rnd}`;
}

const DEFAULT_DEMO_ACCESS_TOKEN = randomDemoToken('demo-access');
const DEFAULT_DEMO_REFRESH_TOKEN = randomDemoToken('demo-refresh');
const LIVE_REFRESH_SESSION_REUSE_MS = 5_000;
const FALLBACK_USER = {
  id: 'user-1',
  username: 'scopedemo',
  email: 'demo@scope.travel',
  displayName: 'Scope traveler',
};

const EMAIL_IDENTIFIER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_IDENTIFIER_REGEX = /^[+\d().\-\s]+$/;

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
  const { findAuthMockUser } = await import('@/services/mockAuthUsers');
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

  const recentSession = refreshToken ? recentLiveRefreshSessions.get(refreshToken) : undefined;
  if (recentSession && recentSession.expiresAt > now) {
    return recentSession.payload;
  }

  const inFlightRefresh = refreshToken ? liveRefreshSessionPromises.get(refreshToken) : undefined;
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

  if (refreshToken) {
    liveRefreshSessionPromises.set(refreshToken, refreshPromise);
  }

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
    accessToken: overrides.accessToken ?? DEFAULT_DEMO_ACCESS_TOKEN,
    refreshToken: overrides.refreshToken ?? DEFAULT_DEMO_REFRESH_TOKEN,
  });
}

async function buildDemoAuthPayload(overrides: Partial<AuthPayload> = {}): Promise<AuthPayload> {
  const demoUser = await findMatchingMockUser({ email: DEMO_LOGIN_EMAIL });

  return buildFallbackAuthPayload({
    id: demoUser?.id,
    username: demoUser?.username,
    email: DEMO_LOGIN_EMAIL,
    displayName: demoUser?.displayName,
    accessToken: overrides.accessToken,
    refreshToken: overrides.refreshToken,
  });
}

function assertDemoCredentials(credentials: AuthForm): void {
  const sanitizedCredentials = sanitizeAuthForm(credentials);

  if (
    sanitizedCredentials.email !== DEMO_LOGIN_EMAIL ||
    sanitizedCredentials.password !== DEMO_LOGIN_PASSWORD
  ) {
    throw new Error(DEMO_LOGIN_ERROR_MESSAGE);
  }
}

function hasUsableAuthTokens(payload: Partial<AuthPayload> | null | undefined): payload is AuthPayload {
  return Boolean(payload?.accessToken?.trim() && payload?.refreshToken?.trim());
}

export async function login(credentials: AuthForm): Promise<AuthPayload> {
  const sanitizedCredentials = sanitizeAuthForm(credentials);

  if (DEMO_MODE_ENABLED) {
    assertDemoCredentials(sanitizedCredentials);
    return buildDemoAuthPayload();
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

  if (DEMO_MODE_ENABLED) {
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
  if (DEMO_MODE_ENABLED) {
    return buildDemoAuthPayload({
      accessToken: `${DEFAULT_DEMO_ACCESS_TOKEN}-${Date.now()}`,
      refreshToken: DEFAULT_DEMO_REFRESH_TOKEN,
    });
  }

  try {
    return await requestLiveRefreshSession();
  } catch (error) {
    if (options.allowMockFallback && AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload({
        ...readCurrentLocalPreviewUser(),
        accessToken: `${DEFAULT_DEMO_ACCESS_TOKEN}-${Date.now()}`,
        refreshToken: DEFAULT_DEMO_REFRESH_TOKEN,
      });
    }

    throw error;
  }
}

export async function logout(refreshToken = readStoredRefreshToken()): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    return;
  }

  try {
    await api.post(`${AUTH_BASE_PATH}/logout`, { refreshToken });
  } catch {
    // Local development uses mock auth until the backend contract is live.
  }
}

export async function loginWithCognito(idToken: string): Promise<AuthPayload> {
  if (DEMO_MODE_ENABLED) {
    return buildDemoAuthPayload();
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
