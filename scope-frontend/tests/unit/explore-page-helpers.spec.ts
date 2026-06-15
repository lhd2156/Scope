import {
  clampExplorePage,
  deriveCityFilterOptions,
  deriveCountryOptions,
  deriveRegionOptions,
  deriveVibes,
  filterCityOptionsByScope,
  formatExplorePaginationStatus,
  getExplorePageRange,
  getHiddenOptionCount,
  getTotalExplorePages,
  getVisibleCityOptions,
  getVisibleCountryOptions,
  getVisibleExploreVibes,
  mapSearchResultToSpot,
  matchesSearch,
  matchesSelectedCity,
  matchesSelectedCountry,
  matchesSelectedRegion,
  resolveSearchSnippet,
  resolveSpotVibes,
  shouldShowExplorePagination,
  sortExploreSpotsForMode,
} from '@/views/explorePageHelpers';
import type { SearchResult } from '@/services/searchService';
import type { SpotCategory, SpotSummary } from '@/types';

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];

function buildSpot(overrides: Partial<SpotSummary> = {}): SpotSummary {
  return {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    description: 'Street tacos, skyline views, and a late-night crowd.',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'food',
    city: 'Fort Worth',
    country: 'US',
    stateCode: 'TX',
    vibe: 'electric',
    rating: 4.8,
    photoUrl: 'https://images.example/sunset.jpg',
    likesCount: 88,
    createdAt: '2026-03-26T20:00:00Z',
    author: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food'],
    },
    ...overrides,
  };
}

function buildSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'search-1',
    name: 'Shibuya Ramen Counter',
    description: 'Counter seats and late broth.',
    category: 'food',
    location: { lat: 35.6595, lon: 139.7005 },
    avg_rating: 4.9,
    review_count: 42,
    _score: 12,
    ...overrides,
  };
}

describe('explorePageHelpers', () => {
  it('derives city, country, and region filter options with the existing labels and counts', () => {
    const spots = [
      buildSpot(),
      buildSpot({ id: 'spot-2', title: 'Botanic River Walk', category: 'nature', vibe: 'calm', likesCount: 63 }),
      buildSpot({
        id: 'spot-3',
        title: 'Sydney Morning Market',
        city: 'Sydney',
        country: 'AU',
        stateCode: 'NSW',
        category: 'scenic',
        vibe: 'cinematic',
      }),
      buildSpot({
        id: 'spot-4',
        title: 'Barcelona Morning Market',
        city: 'Barcelona',
        country: 'Spain',
        region: 'Catalonia',
        stateCode: '',
        category: 'culture',
        vibe: 'curated',
      }),
    ];

    const cityOptions = deriveCityFilterOptions(spots);

    expect(cityOptions.map(({ key, label, count, country, region }) => ({ key, label, count, country, region }))).toEqual([
      { key: 'Spain::Catalonia::Barcelona', label: 'Barcelona, Catalonia', count: 1, country: 'Spain', region: 'Catalonia' },
      { key: 'USA::TX::Fort Worth', label: 'Fort Worth, TX', count: 2, country: 'USA', region: 'TX' },
      { key: 'AU::NSW::Sydney', label: 'Sydney, NSW', count: 1, country: 'AU', region: 'NSW' },
    ]);
    expect(deriveCountryOptions(cityOptions).map(({ value, count }) => ({ value, count }))).toEqual([
      { value: 'USA', count: 2 },
      { value: 'AU', count: 1 },
      { value: 'Spain', count: 1 },
    ]);
    expect(deriveRegionOptions(cityOptions, 'USA')).toEqual([
      { value: 'TX', label: 'TX', count: 1 },
    ]);
    expect(filterCityOptionsByScope(cityOptions, 'USA', 'TX').map((city) => city.label)).toEqual(['Fort Worth, TX']);
  });

  it('preserves vibe fallback, search matching, and location match behavior', () => {
    const pillarSpot = buildSpot({
      id: 'pillar-only',
      title: 'Production Water Garden',
      vibe: undefined,
      pillars: ['photo-worthy', 'group-friendly'],
    });
    const cityOption = deriveCityFilterOptions([pillarSpot])[0] ?? null;

    expect(resolveSpotVibes(pillarSpot)).toEqual(['photo-worthy', 'group-friendly']);
    expect(deriveVibes([buildSpot({ vibe: 'calm' }), pillarSpot])).toEqual(['calm', 'group-friendly', 'photo-worthy']);
    expect(matchesSearch(pillarSpot, 'group-friendly')).toBe(true);
    expect(matchesSearch(pillarSpot, 'Fort Worth, TX')).toBe(true);
    expect(matchesSelectedCountry(pillarSpot, 'USA')).toBe(true);
    expect(matchesSelectedRegion(pillarSpot, 'USA', 'TX')).toBe(true);
    expect(matchesSelectedCity(pillarSpot, cityOption)).toBe(true);
  });

  it('maps elastic search results through the existing safe snippet and category fallbacks', () => {
    const highlighted = buildSearchResult({
      category: 'mystery',
      _highlights: {
        description: ['Late <em>ramen</em> & "broth" <script>'],
      },
    });
    const fallback = buildSearchResult({
      id: 'fallback',
      description: 'A <quiet> courtyard with tea & shade.',
    });

    expect(mapSearchResultToSpot(highlighted, categories)).toMatchObject({
      id: 'search-1',
      title: 'Shibuya Ramen Counter',
      category: 'other',
      latitude: 35.6595,
      longitude: 139.7005,
      likesCount: 42,
      searchSnippet: 'Late <mark>ramen</mark> &amp; &quot;broth&quot; &lt;script&gt;',
    });
    expect(resolveSearchSnippet(fallback)).toBe('A &lt;quiet&gt; courtyard with tea &amp; shade.');
  });

  it('keeps visible chip overflow, sorting, and pagination helpers behavior-preserving', () => {
    const countryOptions = [
      { value: 'USA', label: 'USA', count: 3 },
      { value: 'AU', label: 'AU', count: 1 },
      { value: 'Spain', label: 'Spain', count: 1 },
      { value: 'JP', label: 'JP', count: 1 },
    ];
    const cityOptions = deriveCityFilterOptions([
      buildSpot({ id: 'a', title: 'A', city: 'Austin', likesCount: 2 }),
      buildSpot({ id: 'b', title: 'B', city: 'Chicago', stateCode: 'IL', likesCount: 4 }),
      buildSpot({ id: 'c', title: 'C', city: 'Seattle', stateCode: 'WA', likesCount: 6 }),
      buildSpot({ id: 'd', title: 'D', city: 'Sydney', country: 'AU', stateCode: 'NSW', likesCount: 8 }),
    ]);
    const selectedCity = cityOptions.find((city) => city.label === 'Sydney, NSW') ?? null;
    const sorted = sortExploreSpotsForMode([
      buildSpot({ id: 'low', title: 'Low', likesCount: 1, rating: 5, createdAt: '2026-03-28T00:00:00Z' }),
      buildSpot({ id: 'high', title: 'High', likesCount: 9, rating: 4, createdAt: '2026-03-20T00:00:00Z' }),
    ], 'popular');

    expect(getVisibleExploreVibes(['calm', 'curated', 'electric', 'photo-worthy'], 'photo-worthy', false, 3)).toEqual([
      'photo-worthy',
      'calm',
      'curated',
    ]);
    expect(getVisibleCountryOptions(countryOptions, 'JP', false, 3).map((country) => country.value)).toEqual(['JP', 'USA', 'AU']);
    expect(getVisibleCityOptions(cityOptions, selectedCity, false, 3).map((city) => city.label)).toEqual([
      'Sydney, NSW',
      'Austin, TX',
      'Chicago, IL',
    ]);
    expect(getHiddenOptionCount(4, 3)).toBe(1);
    expect(sorted.map((spot) => spot.id)).toEqual(['high', 'low']);
    expect(getTotalExplorePages(19, 9)).toBe(3);
    expect(getExplorePageRange(2, 9)).toEqual({ startIndex: 9, endIndex: 18 });
    expect(clampExplorePage(99, 3)).toBe(3);
    expect(clampExplorePage(0, 3)).toBe(1);
    expect(formatExplorePaginationStatus(19, 9, 18, 2, 3)).toBe('10-18 of 19 - Page 2 of 3');
    expect(formatExplorePaginationStatus(0, 0, 9, 1, 1)).toBe('Page 1 of 1');
    expect(shouldShowExplorePagination(false, false, 10, 9)).toBe(true);
    expect(shouldShowExplorePagination(true, false, 10, 9)).toBe(false);
  });
});
