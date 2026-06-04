import type { SpotSummary } from '@/types';
import { getSpotTrendingScore, rankTrendingSpots } from '@/utils/spotRanking';

const NOW = Date.parse('2026-04-24T12:00:00Z');

function spot(overrides: Partial<SpotSummary>): SpotSummary {
  return {
    id: 'spot',
    title: 'Scope Spot',
    latitude: 32.75,
    longitude: -97.33,
    category: 'food',
    rating: 4,
    createdAt: '2026-04-01T12:00:00Z',
    likesCount: 0,
    ...overrides,
  };
}

describe('spot trending ranking', () => {
  it('combines social proof, quality, and freshness into one score', () => {
    const establishedFavorite = spot({
      id: 'favorite',
      title: 'Established Favorite',
      rating: 4.8,
      likesCount: 120,
      createdAt: '2026-03-24T12:00:00Z',
    });
    const brandNewPin = spot({
      id: 'new',
      title: 'Brand New Pin',
      rating: 5,
      likesCount: 4,
      createdAt: '2026-04-24T10:00:00Z',
    });
    const staleCrowdPleaser = spot({
      id: 'stale',
      title: 'Stale Crowd Pleaser',
      rating: 3.2,
      likesCount: 50,
      createdAt: '2025-11-01T12:00:00Z',
    });

    expect(rankTrendingSpots([brandNewPin, staleCrowdPleaser, establishedFavorite], 2, NOW).map((entry) => entry.id))
      .toEqual(['favorite', 'stale']);
    expect(getSpotTrendingScore(establishedFavorite, NOW)).toBeGreaterThan(getSpotTrendingScore(brandNewPin, NOW));
  });

  it('limits results without mutating the original collection', () => {
    const spots = [
      spot({ id: 'low', title: 'Low', likesCount: 1, rating: 3.8 }),
      spot({ id: 'high', title: 'High', likesCount: 80, rating: 4.9 }),
      spot({ id: 'mid', title: 'Mid', likesCount: 25, rating: 4.4 }),
    ];

    const ranked = rankTrendingSpots(spots, 2, NOW);

    expect(ranked.map((entry) => entry.id)).toEqual(['high', 'mid']);
    expect(spots.map((entry) => entry.id)).toEqual(['low', 'high', 'mid']);
  });

  it('uses deterministic tie-breakers and clamps invalid score inputs', () => {
    const tiedSpots = [
      spot({ id: 'b', title: 'Beta', likesCount: 2, rating: 4, createdAt: '2026-04-20T12:00:00Z' }),
      spot({ id: 'a', title: 'Alpha', likesCount: 2, rating: 4, createdAt: '2026-04-20T12:00:00Z' }),
      spot({ id: 'c', title: 'Alpha', likesCount: 2, rating: 4, createdAt: '2026-04-20T12:00:00Z' }),
    ];
    const malformedSpot = spot({
      id: 'malformed',
      title: 'Malformed',
      likesCount: -10,
      rating: -2,
      createdAt: 'not-a-date',
    });

    expect(rankTrendingSpots(tiedSpots, tiedSpots.length, NOW).map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
    expect(rankTrendingSpots(tiedSpots, -1, NOW)).toEqual([]);
    expect(getSpotTrendingScore(malformedSpot, NOW)).toBe(0);
  });
});
