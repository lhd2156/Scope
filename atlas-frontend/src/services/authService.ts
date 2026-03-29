import api from '@/services/api';
import { mockUsers } from '@/services/mockData';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, AuthForm, AuthPayload, RegisterForm } from '@/types';

const AUTH_BASE_PATH = '/api/core/auth';
const DEFAULT_DEMO_ACCESS_TOKEN = 'demo-token';
const DEFAULT_DEMO_REFRESH_TOKEN = 'demo-refresh-token';
const FALLBACK_USER = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
};

function buildFallbackAuthPayload(overrides: Partial<AuthPayload> = {}): AuthPayload {
  const matchingUser = mockUsers.find(
    (user) =>
      user.id === overrides.id ||
      user.email === overrides.email ||
      user.username === overrides.username,
  );

  return {
    id: overrides.id ?? matchingUser?.id ?? FALLBACK_USER.id,
    username: overrides.username ?? matchingUser?.username ?? FALLBACK_USER.username,
    email: overrides.email ?? matchingUser?.email ?? FALLBACK_USER.email,
    displayName: overrides.displayName ?? matchingUser?.displayName ?? FALLBACK_USER.displayName,
    accessToken: overrides.accessToken ?? DEFAULT_DEMO_ACCESS_TOKEN,
    refreshToken: overrides.refreshToken ?? DEFAULT_DEMO_REFRESH_TOKEN,
  };
}

export async function login(credentials: AuthForm): Promise<AuthPayload> {
  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/login`, credentials);
    return unwrapApiData(data);
  } catch {
    return buildFallbackAuthPayload({ email: credentials.email });
  }
}

export async function register(payload: RegisterForm): Promise<AuthPayload> {
  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/register`, payload);
    return unwrapApiData(data);
  } catch {
    return buildFallbackAuthPayload({
      username: payload.username,
      email: payload.email,
      displayName: payload.displayName,
    });
  }
}

export async function refreshSession(refreshToken?: string): Promise<AuthPayload> {
  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/refresh`, undefined);
    return unwrapApiData(data);
  } catch {
    return buildFallbackAuthPayload({
      accessToken: `${DEFAULT_DEMO_ACCESS_TOKEN}-${Date.now()}`,
      refreshToken: refreshToken || DEFAULT_DEMO_REFRESH_TOKEN,
    });
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post(`${AUTH_BASE_PATH}/logout`, undefined);
  } catch {
    // Local development uses mock auth until the backend contract is live.
  }
}

export async function loginWithCognito(idToken: string): Promise<AuthPayload> {
  try {
    const { data } = await api.post<ApiEnvelope<AuthPayload> | AuthPayload>(`${AUTH_BASE_PATH}/oauth/cognito`, {
      idToken,
    });
    return unwrapApiData(data);
  } catch {
    return buildFallbackAuthPayload();
  }
}
