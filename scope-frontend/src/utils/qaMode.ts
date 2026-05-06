export const SCOPE_QA_SESSION_QUERY_PARAM = 'scopeQaSession';

export type ScopeQaSession = 'guest' | 'authenticated';

const SCOPE_VISUAL_QA_FLAG = '__SCOPE_VISUAL_QA__';

function resolveSearchValue(search?: string): string {
  if (typeof search === 'string') {
    if (search.startsWith('?')) {
      return search;
    }

    const questionMarkIndex = search.indexOf('?');
    return questionMarkIndex >= 0 ? search.slice(questionMarkIndex) : search;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.search;
}

function isQaModeAllowed(): boolean {
  // Gate behind an explicit flag so production builds cannot be tricked into
  // accepting synthetic tokens simply because the URL carries ?scopeQaSession=.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const allow = env.VITE_ENABLE_AUTH_MOCK_FALLBACK ?? env.VITE_DEMO_MODE;
  if (allow && allow.toLowerCase() === 'true') {
    return true;
  }
  return env.MODE !== 'production' && env.NODE_ENV !== 'production';
}

function isScopeVisualQaRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as Window & { __SCOPE_VISUAL_QA__?: boolean })[SCOPE_VISUAL_QA_FLAG])
  );
}

export function getScopeQaSession(search?: string): ScopeQaSession | null {
  if (!isQaModeAllowed()) {
    return null;
  }
  const searchParams = new URLSearchParams(resolveSearchValue(search));
  const qaSession = searchParams.get(SCOPE_QA_SESSION_QUERY_PARAM);

  if (qaSession === 'guest' || qaSession === 'authenticated') {
    return qaSession;
  }

  return null;
}

export function isScopeQaMode(search?: string): boolean {
  return getScopeQaSession(search) !== null;
}

export function syncScopeQaDocumentState(search?: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (isScopeQaMode(search) || isScopeVisualQaRuntime()) {
    document.documentElement.dataset.scopeQa = 'true';
    return;
  }

  delete document.documentElement.dataset.scopeQa;
}
