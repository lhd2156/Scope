import type { SpotSummary } from '@/types';
import { getSpotDeduplicationKey, getSpotFingerprint } from '@/utils/spotIdentity';

function spot(overrides: Partial<SpotSummary> = {}): SpotSummary {
  return {
    id: 'spot-1',
    title: '  Sunset Rooftop Tacos ',
    latitude: 32.75523,
    longitude: -97.33091,
    city: ' Fort Worth ',
    category: 'food',
    rating: 4.7,
    createdAt: '2026-04-24T12:00:00Z',
    ...overrides,
  };
}

describe('spot identity utilities', () => {
  it('builds stable fingerprints from normalized title, city, and rounded coordinates', () => {
    expect(getSpotFingerprint(spot())).toBe('sunset rooftop tacos|fort worth|32.7552,-97.3309');
  });

  it('preserves the profile deduplication key shape with id before fingerprint', () => {
    expect(getSpotDeduplicationKey(spot({ id: 'abc123' }))).toBe('abc123|sunset rooftop tacos|fort worth|32.7552,-97.3309');
  });

  it('omits missing or invalid identity parts without adding empty separators', () => {
    expect(getSpotFingerprint(spot({ title: '  ', city: ' Austin ', latitude: Number.NaN }))).toBe('austin');
    expect(getSpotDeduplicationKey(spot({ id: '', title: '  ', city: ' Austin ', latitude: Number.NaN }))).toBe('austin');
  });
});
