import { areUserVibesEqual, formatUserVibes, normalizeUserVibes } from '@/utils/userPreferenceSignals';

describe('user preference signals', () => {
  it('normalizes saved account vibes into supported app categories', () => {
    expect(normalizeUserVibes([' Food ', 'SCENIC', 'ENTERTAINMENT', 'unknown', 'food', 'other'])).toEqual([
      'food',
      'scenic',
      'entertainment',
      'other',
    ]);
  });

  it('can exclude surprise/default vibes from concrete suggestion categories', () => {
    expect(normalizeUserVibes(['nightlife', 'other', 'culture'], { includeSurprise: false })).toEqual([
      'nightlife',
      'culture',
    ]);
  });

  it('compares normalized vibes in order and formats fallback copy', () => {
    expect(areUserVibesEqual([' FOOD ', 'scenic'], ['food', 'scenic'])).toBe(true);
    expect(areUserVibesEqual(['scenic', 'food'], ['food', 'scenic'])).toBe(false);
    expect(formatUserVibes(['unknown'], 'smart defaults')).toBe('smart defaults');
  });
});
