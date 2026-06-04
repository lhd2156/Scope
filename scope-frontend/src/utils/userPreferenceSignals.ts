import type { SpotCategory } from '@/types';

const USER_VIBE_CATEGORIES: readonly SpotCategory[] = [
  'food',
  'nature',
  'nightlife',
  'culture',
  'adventure',
  'shopping',
  'entertainment',
  'scenic',
  'other',
];

const USER_VIBE_CATEGORY_SET = new Set<SpotCategory>(USER_VIBE_CATEGORIES);

export function normalizeUserVibes(
  values: readonly string[] | null | undefined,
  options: { includeSurprise?: boolean } = {},
): SpotCategory[] {
  const includeSurprise = options.includeSurprise ?? true;
  const seen = new Set<SpotCategory>();
  const normalized: SpotCategory[] = [];

  for (const value of values ?? []) {
    const candidate = value.trim().toLowerCase() as SpotCategory;
    if (!USER_VIBE_CATEGORY_SET.has(candidate) || (!includeSurprise && candidate === 'other') || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

export function areUserVibesEqual(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizeUserVibes(left);
  const normalizedRight = normalizeUserVibes(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function formatUserVibes(values: readonly string[], fallback = 'smart defaults'): string {
  const vibes = normalizeUserVibes(values);
  return vibes.length ? vibes.join(', ') : fallback;
}
