import { sanitizeSingleLineText } from '@/utils/sanitizers';

const SAFE_BASE_URL = 'https://scope.local';

function normalizeFallback(fallback: string): string {
  if (fallback === '') {
    return '';
  }

  return fallback.startsWith('/') && !fallback.startsWith('//') ? fallback : '/';
}

export function sanitizeInternalRouteTarget(value: unknown, fallback = '/'): string {
  const safeFallback = normalizeFallback(fallback);

  if (typeof value !== 'string') {
    return safeFallback;
  }

  const target = sanitizeSingleLineText(value);
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return safeFallback;
  }

  try {
    const url = new URL(target, SAFE_BASE_URL);
    if (url.origin !== SAFE_BASE_URL) {
      return safeFallback;
    }

    const normalizedTarget = `${url.pathname}${url.search}${url.hash}`;
    return normalizedTarget.startsWith('/') && !normalizedTarget.startsWith('//')
      ? normalizedTarget
      : safeFallback;
  } catch {
    return safeFallback;
  }
}
