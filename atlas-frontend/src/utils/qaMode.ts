export const ATLAS_QA_SESSION_QUERY_PARAM = 'atlasQaSession';

export type AtlasQaSession = 'guest' | 'authenticated';

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

export function getAtlasQaSession(search?: string): AtlasQaSession | null {
  const searchParams = new URLSearchParams(resolveSearchValue(search));
  const qaSession = searchParams.get(ATLAS_QA_SESSION_QUERY_PARAM);

  if (qaSession === 'guest' || qaSession === 'authenticated') {
    return qaSession;
  }

  return null;
}

export function isAtlasQaMode(search?: string): boolean {
  return getAtlasQaSession(search) !== null;
}

export function syncAtlasQaDocumentState(search?: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (isAtlasQaMode(search)) {
    document.documentElement.dataset.atlasQa = 'true';
    return;
  }

  delete document.documentElement.dataset.atlasQa;
}
