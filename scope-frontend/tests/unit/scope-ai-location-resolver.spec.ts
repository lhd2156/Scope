import {
  formatScopeAiResolvedPlaceLabel,
  resolveScopeAiLocationIntent,
} from '@/services/scopeAiLocationResolver';

const geocodeMock = vi.hoisted(() => vi.fn());
const searchLocationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  geocode: geocodeMock,
  searchLocations: searchLocationsMock,
}));

describe('scope AI location resolver', () => {
  beforeEach(() => {
    geocodeMock.mockReset();
    searchLocationsMock.mockReset();
    geocodeMock.mockResolvedValue({ data: [] });
    searchLocationsMock.mockResolvedValue({ data: [] });
  });

  it('returns not_found for empty location prompts without calling providers', async () => {
    const result = await resolveScopeAiLocationIntent(' ??? ');

    expect(result).toEqual({
      status: 'not_found',
      query: '',
      result: null,
      candidates: [],
    });
    expect(searchLocationsMock).not.toHaveBeenCalled();
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('falls back to geocoding when search has no usable coordinates', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'No Coordinate Cafe',
          formattedAddress: 'No Coordinate Cafe, Test City',
          latitude: Number.NaN,
          longitude: Number.NaN,
        },
      ],
    });
    geocodeMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Provider Cafe',
          formattedAddress: 'Provider Cafe, Test City, United States',
          latitude: 32.75,
          longitude: -97.33,
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Provider Cafe', { limit: 9 });

    expect(searchLocationsMock).toHaveBeenCalledWith('Provider Cafe', {
      limit: 5,
      sortByDistance: false,
    });
    expect(geocodeMock).toHaveBeenCalledWith('Provider Cafe', 5);
    expect(result.status).toBe('resolved');
    expect(result.result).toMatchObject({
      placeName: 'Provider Cafe',
      source: 'mapbox',
    });
  });

  it('uses a strong route-biased address match when duplicate streets are far apart', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Nearby City, Texas, United States',
          latitude: 32.7768,
          longitude: -96.7971,
          source: 'mapbox',
        },
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Far City, Florida, United States',
          latitude: 28.5383,
          longitude: -81.3792,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('100 Main Street', {
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('100 Main Street', expect.objectContaining({
      limit: 3,
      sortByDistance: true,
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    }));
    expect(result.status).toBe('resolved');
    expect(result.result?.formattedAddress).toBe('100 Main Street, Nearby City, Texas, United States');
    expect(result.candidates[0]?.distanceKm).toBeLessThan(1);
  });

  it('keeps typed state and ZIP mismatches ambiguous instead of guessing', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Dallas, Texas 75201, United States',
          latitude: 32.7767,
          longitude: -96.797,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('100 Main Street, Austin, TX 78701');

    expect(result.status).toBe('ambiguous');
    expect(result.result).toBeNull();
    expect(result.candidates).toHaveLength(1);
  });

  it('resolves an exact named place when the next candidate is only a partial match', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Provider Cafe',
          formattedAddress: 'Provider Cafe, Test City, United States',
          latitude: 32.75,
          longitude: -97.33,
          source: 'mapbox',
        },
        {
          placeName: 'Provider Cafe Annex',
          formattedAddress: 'Provider Cafe Annex, Test City, United States',
          latitude: 32.76,
          longitude: -97.34,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Provider Cafe');

    expect(result.status).toBe('resolved');
    expect(result.result?.placeName).toBe('Provider Cafe');
  });

  it('resolves exact city-state matches ahead of noisy nearby POI candidates', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Dallas, Texas, United States',
          formattedAddress: 'Dallas, Texas, United States',
          latitude: 32.7767,
          longitude: -96.797,
          source: 'mapbox',
        },
        {
          placeName: '2395 Stemmons Trail',
          formattedAddress: '2395 Stemmons Trail, Dallas, Texas 75220, United States',
          latitude: 32.825,
          longitude: -96.87,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Dallas, TX');

    expect(result.status).toBe('resolved');
    expect(result.result?.formattedAddress).toBe('Dallas, Texas, United States');
  });

  it('does not treat city metadata as an exact city-state candidate', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '2395 Stemmons Trail',
          formattedAddress: '2395 Stemmons Trail, Dallas, Texas 75220, United States',
          city: 'Dallas',
          latitude: 32.825,
          longitude: -96.87,
          source: 'mapbox',
        },
        {
          placeName: '3333 Canyon Bluff Blvd.',
          formattedAddress: '3333 Canyon Bluff Blvd., Dallas, Texas 75211, United States',
          city: 'Dallas',
          latitude: 32.76,
          longitude: -96.88,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Dallas, TX');

    expect(result.status).toBe('ambiguous');
    expect(result.result).toBeNull();
  });

  it('keeps typed city-state endpoint searches global instead of route-biased', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Austin, Texas, United States',
          formattedAddress: 'Austin, Texas, United States',
          latitude: 30.2672,
          longitude: -97.7431,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Austin, TX', {
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('Austin, TX', {
      limit: 3,
      sortByDistance: false,
    });
    expect(result.status).toBe('resolved');
    expect(result.result?.formattedAddress).toBe('Austin, Texas, United States');
  });

  it('does not auto-resolve state-only matches for typed city-state queries', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '5312 TX-66',
          formattedAddress: '5312 TX-66, Royse City, Texas 75189, United States',
          city: 'Royse City',
          latitude: 32.975,
          longitude: -96.332,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('Austin, TX');

    expect(result.status).toBe('ambiguous');
    expect(result.result).toBeNull();
  });

  it('rejects specific street results when the house number or typed locality does not match', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Main Street',
          formattedAddress: 'Main Street, Austin, Texas, United States',
          latitude: 30.2672,
          longitude: -97.7431,
          source: 'mapbox',
        },
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Dallas, Texas, United States',
          latitude: 32.7767,
          longitude: -96.797,
          source: 'mapbox',
        },
      ],
    });

    const result = await resolveScopeAiLocationIntent('100 Main Street, Austin, TX');

    expect(result.status).toBe('ambiguous');
    expect(result.result).toBeNull();
    expect(result.candidates.map((candidate) => candidate.formattedAddress)).toEqual([
      'Main Street, Austin, Texas, United States',
      '100 Main Street, Dallas, Texas, United States',
    ]);
  });

  it('formats provider labels with safe fallbacks', () => {
    expect(formatScopeAiResolvedPlaceLabel({
      placeName: '',
      formattedAddress: '',
      address: 'Fallback address',
      latitude: 1,
      longitude: 2,
    })).toBe('Fallback address');
    expect(formatScopeAiResolvedPlaceLabel({
      placeName: '',
      latitude: 1,
      longitude: 2,
    })).toBe('Pinned location');
  });
});
