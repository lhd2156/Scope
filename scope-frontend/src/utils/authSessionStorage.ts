const AUTH_SESSION_HINT_VERSION = 1;
export const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
export const AUTH_SESSION_HINT_CHANGE_EVENT = 'scope-auth-session-hint-change';
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'scope-auth-refresh-token-v1';
export const REMEMBERED_AUTH_SESSION_DAYS = 7;

export type AuthSessionPersistence = 'local' | 'session';

const LEGACY_AUTH_TOKEN_STORAGE_KEYS = [
  'scope-auth-access-token',
  'scope-auth-refresh-token',
  'scope.auth.accessToken',
  'scope.auth.refreshToken',
  'scope.accessToken',
  'scope.refreshToken',
  'scope.jwt',
  'scope.auth.jwt',
] as const;

interface StoredAuthSessionHint {
  version: number;
  hasSessionCookie: boolean;
  lastAuthenticatedAt: string;
  persistence: AuthSessionPersistence;
  expiresAt?: string;
}

function getBrowserStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

function readStorageItem(storage: Storage | null, key: string): string | null {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorageItem(storage: Storage | null, key: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage access failures and keep the session in-memory only.
  }
}

function dispatchAuthSessionHintChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_HINT_CHANGE_EVENT));
}

export function clearStoredAuthSessionHint(): void {
  removeStorageItem(getBrowserStorage('local'), AUTH_SESSION_HINT_STORAGE_KEY);
  removeStorageItem(getBrowserStorage('session'), AUTH_SESSION_HINT_STORAGE_KEY);
  removeStorageItem(getBrowserStorage('local'), AUTH_REFRESH_TOKEN_STORAGE_KEY);
  removeStorageItem(getBrowserStorage('session'), AUTH_REFRESH_TOKEN_STORAGE_KEY);
  dispatchAuthSessionHintChange();
}

function isAuthSessionPersistence(value: unknown): value is AuthSessionPersistence {
  return value === 'local' || value === 'session';
}

function resolveLegacyHintPersistence(): AuthSessionPersistence {
  const localRefreshToken = readStorageItem(getBrowserStorage('local'), AUTH_REFRESH_TOKEN_STORAGE_KEY)?.trim();
  return localRefreshToken ? 'local' : 'session';
}

function isExpired(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const expiresAtMs = Date.parse(value);
  return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
}

function readStoredAuthSessionHint(): StoredAuthSessionHint | null {
  for (const storageKind of ['session', 'local'] as const) {
    const rawValue = readStorageItem(getBrowserStorage(storageKind), AUTH_SESSION_HINT_STORAGE_KEY);

    if (!rawValue) {
      continue;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthSessionHint>;
      const persistence = isAuthSessionPersistence(parsedValue.persistence)
        ? parsedValue.persistence
        : resolveLegacyHintPersistence();
      const isValidHint =
        parsedValue.version === AUTH_SESSION_HINT_VERSION &&
        parsedValue.hasSessionCookie === true &&
        typeof parsedValue.lastAuthenticatedAt === 'string' &&
        Boolean(parsedValue.lastAuthenticatedAt.trim()) &&
        !isExpired(parsedValue.expiresAt);

      if (!isValidHint) {
        clearStoredAuthSessionHint();
        return null;
      }

      return {
        version: AUTH_SESSION_HINT_VERSION,
        hasSessionCookie: true,
        lastAuthenticatedAt: parsedValue.lastAuthenticatedAt,
        persistence,
        expiresAt: parsedValue.expiresAt,
      };
    } catch {
      clearStoredAuthSessionHint();
      return null;
    }
  }

  return null;
}

export function hasStoredAuthSessionHint(): boolean {
  return readStoredAuthSessionHint() !== null;
}

export function readStoredAuthSessionPersistence(): AuthSessionPersistence {
  return readStoredAuthSessionHint()?.persistence ?? resolveLegacyHintPersistence();
}

export function readStoredRefreshToken(): string {
  const hint = readStoredAuthSessionHint();
  const preferredStorage = hint?.persistence ?? resolveLegacyHintPersistence();
  const fallbackStorage = preferredStorage === 'local' ? 'session' : 'local';

  return (
    readStorageItem(getBrowserStorage(preferredStorage), AUTH_REFRESH_TOKEN_STORAGE_KEY)?.trim() ||
    readStorageItem(getBrowserStorage(fallbackStorage), AUTH_REFRESH_TOKEN_STORAGE_KEY)?.trim() ||
    ''
  );
}

export function persistAuthSessionHint(
  refreshToken?: string,
  options: { persistence?: AuthSessionPersistence } = {},
): void {
  const persistence = options.persistence ?? 'session';
  const storage = getBrowserStorage(persistence);

  if (!storage) {
    return;
  }

  const lastAuthenticatedAt = new Date();
  const storagePayload: StoredAuthSessionHint = {
    version: AUTH_SESSION_HINT_VERSION,
    hasSessionCookie: true,
    lastAuthenticatedAt: lastAuthenticatedAt.toISOString(),
    persistence,
  };

  if (persistence === 'local') {
    storagePayload.expiresAt = new Date(
      lastAuthenticatedAt.getTime() + REMEMBERED_AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  try {
    storage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, JSON.stringify(storagePayload));
  } catch {
    // Ignore storage write failures and keep the session in-memory only.
  }

  const normalizedRefreshToken = refreshToken?.trim() ?? '';
  const refreshTokenStorage = getBrowserStorage(persistence);
  const unusedStorageKind = persistence === 'local' ? 'session' : 'local';
  removeStorageItem(getBrowserStorage(unusedStorageKind), AUTH_SESSION_HINT_STORAGE_KEY);
  removeStorageItem(getBrowserStorage(unusedStorageKind), AUTH_REFRESH_TOKEN_STORAGE_KEY);

  if (normalizedRefreshToken && refreshTokenStorage) {
    try {
      refreshTokenStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, normalizedRefreshToken);
    } catch {
      // Ignore storage write failures and keep refresh in-memory only.
    }
  }

  dispatchAuthSessionHintChange();
}

export function purgeLegacyAuthStorage(): void {
  for (const storageKind of ['local', 'session'] as const) {
    const storage = getBrowserStorage(storageKind);

    for (const storageKey of LEGACY_AUTH_TOKEN_STORAGE_KEYS) {
      removeStorageItem(storage, storageKey);
    }
  }
}
