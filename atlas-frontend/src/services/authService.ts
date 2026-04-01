import api from '@/services/api';
import {
  AUTH_MOCK_FALLBACK_ENABLED,
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_ERROR_MESSAGE,
  DEMO_LOGIN_PASSWORD,
  DEMO_MODE_ENABLED,
} from '@/services/demoMode';
import { mockUsers } from '@/services/mockData';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, AuthForm, AuthPayload, RegisterForm } from '@/types';
import { sanitizeAuthForm, sanitizeAuthPayload, sanitizeRegisterForm } from '@/utils/sanitizers';

const AUTH_BASE_PATH = '/api/core/auth';
const DEFAULT_DEMO_ACCESS_TOKEN = 'demo-token';
const DEFAULT_DEMO_REFRESH_TOKEN = 'demo-refresh-token';
const FALLBACK_USER = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
};

export interface RefreshSessionOptions {
  allowMockFallback?: boolean;
}

function buildFallbackAuthPayload(overrides: Partial<AuthPayload> = {}): AuthPayload {
  const matchingUser = mockUsers.find(
    (user) =>
      user.id === overrides.id ||
      user.email === overrides.email ||
      user.username === overrides.username,
  );

  return sanitizeAuthPayload({
    id: overrides.id ?? matchingUser?.id ?? FALLBACK_USER.id,
    username: overrides.username ?? matchingUser?.username ?? FALLBACK_USER.username,
    email: overrides.email ?? matchingUser?.email ?? FALLBACK_USER.email,
    displayName: overrides.displayName ?? matchingUser?.displayName ?? FALLBACK_USER.displayName,
    accessToken: overrides.accessToken ?? DEFAULT_DEMO_ACCESS_TOKEN,
    refreshToken: overrides.refreshToken ?? DEFAULT_DEMO_REFRESH_TOKEN,
  });
}

function buildDemoAuthPayload(overrides: Partial<AuthPayload> = {}): AuthPayload {
  const demoUser = mockUsers.find((user) => user.email === DEMO_LOGIN_EMAIL) ?? mockUsers[0];

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

export async function login(credentials: AuthForm): Promise<AuthPayload> {
  const sanitizedCredentials = sanitizeAuthForm(credentials);

  if (DEMO_MODE_ENABLED) {
    assertDemoCredentials(sanitizedCredentials);
    return buildDemoAuthPayload();
  }

  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/login`, sanitizedCredentials);
    return sanitizeAuthPayload(unwrapApiData(data));
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload({ email: sanitizedCredentials.email });
    }

    throw error;
  }
}

export async function register(payload: RegisterForm): Promise<AuthPayload> {
  const sanitizedPayload = sanitizeRegisterForm(payload);

  if (DEMO_MODE_ENABLED) {
    return buildDemoAuthPayload();
  }

  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/register`, sanitizedPayload);
    return sanitizeAuthPayload(unwrapApiData(data));
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload({
        username: sanitizedPayload.username,
        email: sanitizedPayload.email,
        displayName: sanitizedPayload.displayName,
      });
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
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/refresh`, undefined);
    return sanitizeAuthPayload(unwrapApiData(data));
  } catch (error) {
    if (options.allowMockFallback && AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload({
        accessToken: `${DEFAULT_DEMO_ACCESS_TOKEN}-${Date.now()}`,
        refreshToken: DEFAULT_DEMO_REFRESH_TOKEN,
      });
    }

    throw error;
  }
}

export async function logout(): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    return;
  }

  try {
    await api.post(`${AUTH_BASE_PATH}/logout`, undefined);
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
    return sanitizeAuthPayload(unwrapApiData(data));
  } catch (error) {
    if (AUTH_MOCK_FALLBACK_ENABLED) {
      return buildFallbackAuthPayload();
    }

    throw error;
  }
}
