import { expect as baseExpect, test as base, type Page, type Request, type Route } from '@playwright/test';

const VISUAL_QA_FLAG = '__ATLAS_VISUAL_QA__';
const DEFAULT_PASSWORD = 'SecurePass123!';
const AUTH_SESSION_HINT_STORAGE_KEY = 'atlas-auth-session-hint';
const AUTH_SESSION_HINT_VERSION = 1;

interface AtlasAuthSession {
  id: string;
  username: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

interface AtlasUserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests: string[];
  stats?: {
    spots: number;
    trips: number;
    friends: number;
  };
}

export interface AtlasApiMock {
  getCurrentSession: () => AtlasAuthSession | null;
  seedSession: (page: Page, overrides?: Partial<AtlasAuthSession>) => Promise<AtlasAuthSession>;
  clearSession: (page: Page) => Promise<void>;
}

const seedUsers: AtlasUserProfile[] = [
  {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    avatarUrl: 'https://i.pravatar.cc/160?img=12',
    bio: 'Collecting rooftop dinners, skyline pins, and story-worthy city nights across Texas.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: {
      spots: 42,
      trips: 8,
      friends: 126,
    },
  },
  {
    id: 'user-2',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Chen',
    avatarUrl: 'https://i.pravatar.cc/160?img=32',
    bio: 'Weekend explorer chasing river walks, gardens, and premium museum stops.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: {
      spots: 28,
      trips: 6,
      friends: 84,
    },
  },
  {
    id: 'user-3',
    username: 'elijah',
    email: 'elijah@example.com',
    displayName: 'Elijah Brooks',
    avatarUrl: 'https://i.pravatar.cc/160?img=45',
    bio: 'Adventure-first trip planner with a thing for steep hikes, vinyl rooms, and strong coffee.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: {
      spots: 36,
      trips: 11,
      friends: 64,
    },
  },
];

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readJsonBody(request: Request): Record<string, unknown> {
  try {
    const payload = request.postDataJSON();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function createValidationError(details: Array<{ field: string; message: string }>): string {
  return JSON.stringify({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed.',
      details,
    },
  });
}

function createUnhandledApiError(method: string, path: string): string {
  return JSON.stringify({
    error: {
      code: 'PLAYWRIGHT_API_MOCK',
      message: `No explicit Playwright API mock is configured for ${method} ${path}. The Atlas frontend should fall back to its deterministic client-side fixtures for this request.`,
    },
  });
}

function createUnauthorizedError(): string {
  return JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Your Atlas session is not active.',
    },
  });
}

function buildAuthSession(overrides: Partial<AtlasAuthSession> = {}): AtlasAuthSession {
  const username = normalizeString(overrides.username) || 'louisdo';
  const email = normalizeString(overrides.email) || `${username}@example.com`;

  return {
    id: normalizeString(overrides.id) || `user-${username}`,
    username,
    email,
    displayName: normalizeString(overrides.displayName) || 'Atlas Traveler',
    accessToken: normalizeString(overrides.accessToken) || `playwright-access-${username}`,
    refreshToken: normalizeString(overrides.refreshToken) || `playwright-refresh-${username}`,
  };
}

function buildUserProfile(session: AtlasAuthSession): AtlasUserProfile {
  const matchingSeedUser = seedUsers.find(
    (candidate) =>
      candidate.id === session.id ||
      candidate.username === session.username ||
      candidate.email === session.email,
  );

  return {
    id: session.id,
    username: session.username,
    email: session.email,
    displayName: session.displayName,
    avatarUrl: matchingSeedUser?.avatarUrl ?? 'https://i.pravatar.cc/160?img=12',
    bio: matchingSeedUser?.bio ?? 'Mapping premium city routes with skyline dinners, polished museums, and sunset lookouts.',
    homeBase: matchingSeedUser?.homeBase ?? 'Fort Worth, TX',
    interests: matchingSeedUser?.interests ?? ['food', 'culture', 'nightlife'],
    stats: matchingSeedUser?.stats ?? {
      spots: 12,
      trips: 3,
      friends: 18,
    },
  };
}

function buildSessionHint() {
  return {
    version: AUTH_SESSION_HINT_VERSION,
    hasSessionCookie: true,
    lastAuthenticatedAt: new Date().toISOString(),
  };
}

async function persistSessionHint(page: Page): Promise<void> {
  const serializedHint = JSON.stringify(buildSessionHint());

  await page.addInitScript(
    ({ storageKey, storageValue }) => {
      window.localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: AUTH_SESSION_HINT_STORAGE_KEY,
      storageValue: serializedHint,
    },
  );
}

async function clearSessionHint(page: Page): Promise<void> {
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, AUTH_SESSION_HINT_STORAGE_KEY);
}

async function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

async function installAtlasApiMocks(page: Page): Promise<AtlasApiMock> {
  const state: { currentSession: AtlasAuthSession | null } = {
    currentSession: null,
  };

  await page.addInitScript((flagName) => {
    (window as Window & Record<string, boolean>)[flagName] = true;
  }, VISUAL_QA_FLAG);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const requestBody = readJsonBody(request);
    const requestUrl = new URL(request.url());
    const requestPath = requestUrl.pathname;
    const requestMethod = request.method().toUpperCase();

    if (requestPath === '/api/core/auth/register' && requestMethod === 'POST') {
      const username = normalizeString(requestBody.username);
      const displayName = normalizeString(requestBody.displayName);
      const email = normalizeString(requestBody.email).toLowerCase();
      const password = normalizeString(requestBody.password);
      const validationDetails: Array<{ field: string; message: string }> = [];

      if (!username) {
        validationDetails.push({ field: 'username', message: 'Username is required.' });
      }

      if (!displayName) {
        validationDetails.push({ field: 'displayName', message: 'Display name is required.' });
      }

      if (!email) {
        validationDetails.push({ field: 'email', message: 'Email is required.' });
      }

      if (!password) {
        validationDetails.push({ field: 'password', message: 'Password is required.' });
      }

      if (validationDetails.length) {
        await fulfillJson(route, 400, createValidationError(validationDetails));
        return;
      }

      state.currentSession = buildAuthSession({
        id: `user-${username}`,
        username,
        email,
        displayName,
      });

      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if ((requestPath === '/api/core/auth/login' || requestPath === '/api/core/auth/oauth/cognito') && requestMethod === 'POST') {
      const email = normalizeString(requestBody.email).toLowerCase() || 'louis@example.com';
      const password = normalizeString(requestBody.password);

      if (requestPath === '/api/core/auth/login' && !password) {
        await fulfillJson(route, 400, createValidationError([{ field: 'password', message: 'Password is required.' }]));
        return;
      }

      const matchingSeedUser = seedUsers.find((candidate) => candidate.email === email);
      const fallbackUsername = email.split('@')[0] || 'atlas-user';
      const username = matchingSeedUser?.username ?? fallbackUsername;
      const displayName = matchingSeedUser?.displayName ?? username;

      if (requestPath === '/api/core/auth/login' && password && password !== DEFAULT_PASSWORD) {
        await fulfillJson(route, 401, JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
          },
        }));
        return;
      }

      state.currentSession = buildAuthSession({
        id: matchingSeedUser?.id ?? `user-${username}`,
        username,
        email,
        displayName,
      });

      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if (requestPath === '/api/core/auth/refresh' && requestMethod === 'POST') {
      if (!state.currentSession) {
        await fulfillJson(route, 401, createUnauthorizedError());
        return;
      }

      state.currentSession = buildAuthSession({
        ...state.currentSession,
        accessToken: `playwright-access-${state.currentSession.username}-${Date.now()}`,
      });

      await fulfillJson(route, 200, state.currentSession);
      return;
    }

    if (requestPath === '/api/core/auth/logout' && requestMethod === 'POST') {
      state.currentSession = null;
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    if (requestPath === '/api/core/auth/me' && requestMethod === 'GET') {
      if (!state.currentSession) {
        await fulfillJson(route, 401, createUnauthorizedError());
        return;
      }

      await fulfillJson(route, 200, {
        data: buildUserProfile(state.currentSession),
      });
      return;
    }

    if (requestPath === '/api/core/users/search' && requestMethod === 'GET') {
      const query = normalizeString(requestUrl.searchParams.get('q')).toLowerCase();
      const matchingUsers = seedUsers.filter((user) => {
        if (!query) {
          return true;
        }

        const searchableText = [user.username, user.displayName, user.email, user.homeBase]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });

      await fulfillJson(route, 200, {
        data: matchingUsers,
        meta: {
          page: 1,
          pageSize: matchingUsers.length || 1,
          total: matchingUsers.length,
          totalPages: 1,
        },
      });
      return;
    }

    if (requestPath.startsWith('/api/core/users/') && requestMethod === 'GET') {
      const pathSegments = requestPath.split('/').filter(Boolean);
      const userId = pathSegments[3] ?? '';
      const matchingSeedUser = seedUsers.find((candidate) => candidate.id === userId);

      if (!matchingSeedUser) {
        await fulfillJson(route, 404, JSON.stringify({
          error: {
            code: 'USER_NOT_FOUND',
            message: `User ${userId} was not found.`,
          },
        }));
        return;
      }

      if (requestPath.endsWith('/stats')) {
        await fulfillJson(route, 200, {
          data: matchingSeedUser.stats ?? {
            spots: 0,
            trips: 0,
            friends: 0,
          },
        });
        return;
      }

      await fulfillJson(route, 200, {
        data: matchingSeedUser,
      });
      return;
    }

    await fulfillJson(route, 503, createUnhandledApiError(requestMethod, requestPath));
  });

  return {
    getCurrentSession: () => state.currentSession,
    seedSession: async (page, overrides = {}) => {
      const matchingSeedUser = seedUsers.find(
        (candidate) =>
          candidate.id === overrides.id ||
          candidate.username === overrides.username ||
          candidate.email === overrides.email,
      );

      state.currentSession = buildAuthSession({
        id: overrides.id ?? matchingSeedUser?.id,
        username: overrides.username ?? matchingSeedUser?.username,
        email: overrides.email ?? matchingSeedUser?.email,
        displayName: overrides.displayName ?? matchingSeedUser?.displayName,
        accessToken: overrides.accessToken,
        refreshToken: overrides.refreshToken,
      });

      await persistSessionHint(page);
      return state.currentSession;
    },
    clearSession: async (page) => {
      state.currentSession = null;
      await clearSessionHint(page);
    },
  };
}

export const test = base.extend<{ atlasApi: AtlasApiMock }>({
  atlasApi: [async ({ page }, use) => {
    const atlasApi = await installAtlasApiMocks(page);
    await use(atlasApi);
  }, { auto: true }],
});

export const expect = baseExpect;
