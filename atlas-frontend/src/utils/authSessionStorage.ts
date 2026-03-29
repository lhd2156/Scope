const AUTH_SESSION_HINT_VERSION = 1;
export const AUTH_SESSION_HINT_STORAGE_KEY = 'atlas-auth-session-hint';

const LEGACY_AUTH_TOKEN_STORAGE_KEYS = [
  'atlas-auth-access-token',
  'atlas-auth-refresh-token',
  'atlas.auth.accessToken',
  'atlas.auth.refreshToken',
  'atlas.accessToken',
  'atlas.refreshToken',
  'atlas.jwt',
  'atlas.auth.jwt',
] as const;

interface StoredAuthSessionHint {
  version: number;
  hasSessionCookie: boolean;
  lastAuthenticatedAt: string;
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

export function clearStoredAuthSessionHint(): void {
  removeStorageItem(getBrowserStorage('local'), AUTH_SESSION_HINT_STORAGE_KEY);
}

export function hasStoredAuthSessionHint(): boolean {
  const rawValue = readStorageItem(getBrowserStorage('local'), AUTH_SESSION_HINT_STORAGE_KEY);

  if (!rawValue) {
    return false;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthSessionHint>;
    const isValidHint =
      parsedValue.version === AUTH_SESSION_HINT_VERSION &&
      parsedValue.hasSessionCookie === true &&
      typeof parsedValue.lastAuthenticatedAt === 'string' &&
      Boolean(parsedValue.lastAuthenticatedAt.trim());

    if (!isValidHint) {
      clearStoredAuthSessionHint();
    }

    return isValidHint;
  } catch {
    clearStoredAuthSessionHint();
    return false;
  }
}

export function persistAuthSessionHint(): void {
  const storage = getBrowserStorage('local');

  if (!storage) {
    return;
  }

  const storagePayload: StoredAuthSessionHint = {
    version: AUTH_SESSION_HINT_VERSION,
    hasSessionCookie: true,
    lastAuthenticatedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, JSON.stringify(storagePayload));
  } catch {
    // Ignore storage write failures and keep the session in-memory only.
  }
}

export function purgeLegacyAuthStorage(): void {
  for (const storageKind of ['local', 'session'] as const) {
    const storage = getBrowserStorage(storageKind);

    for (const storageKey of LEGACY_AUTH_TOKEN_STORAGE_KEYS) {
      removeStorageItem(storage, storageKey);
    }
  }
}
