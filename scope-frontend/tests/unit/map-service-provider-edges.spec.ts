import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mapboxLoaderMock = vi.hoisted(() => ({
  token: 'test-mapbox-token',
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/services/mapboxLoader', () => ({
  getMapboxToken: () => mapboxLoaderMock.token,
}));

describe('mapService provider boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    apiMock.get.mockReset();
    mapboxLoaderMock.token = 'test-mapbox-token';
  });

  afterEach(() => {
    vi.doUnmock('@/services/demoMode');
    vi.doUnmock('@/services/mockDataLoader');
  });

  it('parses successful Mapbox geocode, suggestion, retrieval, and category payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [{ id: 'place.austin', center: [-97.7431, 30.2672] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          suggestions: [{ mapbox_id: 'suggestion-1', name: 'Austin' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [{ properties: { mapbox_id: 'feature-1', name: 'Austin' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [{ properties: { mapbox_id: 'category-1', name: 'Coffee' } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { __mapServiceCoverage } = await import('@/services/mapService');
    const coverage = __mapServiceCoverage!;
    const url = new URL('https://api.mapbox.com/search');

    await expect(coverage.fetchMapboxFeatures(url)).resolves.toEqual([
      expect.objectContaining({ id: 'place.austin' }),
    ]);
    await expect(coverage.fetchMapboxSearchBoxSuggestions(url)).resolves.toEqual([
      expect.objectContaining({ name: 'Austin' }),
    ]);
    await expect(coverage.fetchMapboxSearchBoxFeature(url)).resolves.toMatchObject({
      properties: { name: 'Austin' },
    });
    await expect(coverage.fetchMapboxSearchBoxCategoryFeatures(url)).resolves.toEqual([
      expect.objectContaining({ properties: expect.objectContaining({ name: 'Coffee' }) }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('treats malformed, rejected, and failed provider responses as empty data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ suggestions: 'invalid' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ features: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ features: 'invalid' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn(),
      })
      .mockRejectedValueOnce(new Error('network offline'));
    vi.stubGlobal('fetch', fetchMock);

    const { __mapServiceCoverage } = await import('@/services/mapService');
    const coverage = __mapServiceCoverage!;
    const url = new URL('https://api.mapbox.com/search');

    await expect(coverage.fetchMapboxFeatures(url)).resolves.toEqual([]);
    await expect(coverage.fetchMapboxSearchBoxSuggestions(url)).resolves.toEqual([]);
    await expect(coverage.fetchMapboxSearchBoxFeature(url)).resolves.toBeNull();
    await expect(coverage.fetchMapboxSearchBoxCategoryFeatures(url)).resolves.toEqual([]);
    await expect(coverage.getDevGooglePlacePhoto({
      title: 'Offline place',
      address: '100 Main Street',
      latitude: 32.75,
      longitude: -97.33,
      maxWidthPx: 640,
    })).resolves.toBeNull();
    await expect(coverage.getDevGooglePlacePhoto({
      title: 'Network failure',
      address: '200 Main Street',
      latitude: 32.76,
      longitude: -97.34,
      maxWidthPx: 640,
    })).resolves.toBeNull();
  });

  it('falls back from provider-looking geocodes without returning mocked coordinates', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [{
          latitude: 0,
          longitude: 0,
          placeName: 'Provider fallback',
          source: 'fallback',
          precision: 'fallback',
        }],
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [{
          id: 'place.fort-worth',
          center: [-97.3308, 32.7555],
          text: 'Fort Worth',
          place_name: 'Fort Worth, Texas, United States',
          place_type: ['place'],
        }],
      }),
    }));

    const mapService = await import('@/services/mapService');
    const result = await mapService.geocode('Fort Worth', 2);

    expect(result.data).toEqual([
      expect.objectContaining({
        placeName: 'Fort Worth',
        latitude: 32.7555,
        longitude: -97.3308,
      }),
    ]);
    expect(result.data).not.toContainEqual(expect.objectContaining({ source: 'fallback' }));
  });

  it('normalizes sparse provider data without inventing unsafe location metadata', async () => {
    const { __mapServiceCoverage } = await import('@/services/mapService');
    const coverage = __mapServiceCoverage!;

    expect(coverage.sanitizeGeocodeResult({
      latitude: 32.75,
      longitude: -97.33,
      placeName: '',
      formattedAddress: 'Fort Worth, TX',
    }).placeName).toBe('Fort Worth, TX');
    expect(coverage.sanitizeGeocodeResult({
      latitude: 32.75,
      longitude: -97.33,
      placeName: '',
      address: '100 Main Street',
    }).placeName).toBe('100 Main Street');
    expect(coverage.sanitizeGeocodeResult({
      latitude: 32.75,
      longitude: -97.33,
      placeName: '',
    }).placeName).toBe('Pinned location');
    expect(coverage.sanitizeGeocodeEnvelope({
      latitude: 32.75,
      longitude: -97.33,
      placeName: 'Single result',
    }).data).toHaveLength(1);
    expect(coverage.sanitizeExternalUrl('mailto:traveler@example.com')).toBeUndefined();
    expect(coverage.lookupCoordinateKey(Number.NaN)).toBe('NaN');

    const pending = Promise.resolve('lookup');
    const cache = new Map<string, Promise<string>>();
    coverage.setCachedLookup(cache, 'only', pending, -1);
    expect(cache.size).toBe(0);

    expect(coverage.readMapboxCoordinate({}, { latitude: 32.75, longitude: -97.33 })).toEqual({
      latitude: 32.75,
      longitude: -97.33,
    });
    expect(coverage.readMapboxContextValue([
      { id: 'place.empty', text: '' },
      { id: 'place.fort-worth', text: 'Fort Worth' },
    ], ['place'])).toBe('Fort Worth');
    expect(coverage.readMapboxPrecision({ place_type: [''] })).toBeUndefined();
    expect(coverage.readFlexibleTextList('')).toEqual([]);
    expect(coverage.readFlexibleTextList('coffee')).toEqual(['coffee']);
    expect(coverage.isPoiPrecision()).toBe(false);
    expect(coverage.isProviderFallbackResult({
      latitude: 32.75,
      longitude: -97.33,
      placeName: 'No precision',
    })).toBe(false);

    expect(coverage.mapboxFeatureToGeocodeResult({
      center: [-97.33, 32.75],
      text: '',
      place_name: '',
      address: '',
      place_type: [''],
    })).toMatchObject({
      placeName: 'Pinned location',
      formattedAddress: 'Pinned location',
      address: 'Pinned location',
    });
    expect(coverage.mapboxFeatureToPlaceSearchResult({
      center: [-97.33, 32.75],
      text: 'Unidentified place',
    })).toMatchObject({
      id: undefined,
      distanceKm: undefined,
      source: 'mapbox',
    });

    const exactPlace = {
      placeName: 'Austin',
      formattedAddress: 'Austin, Texas',
      latitude: 30.2672,
      longitude: -97.7431,
      precision: 'place',
      source: 'mapbox' as const,
    };
    const exactPoi = {
      ...exactPlace,
      id: 'poi-austin',
      precision: 'poi',
      distanceKm: 2,
    };
    const nonExactPlace = {
      ...exactPlace,
      id: 'place-round-rock',
      placeName: 'Round Rock',
      formattedAddress: 'Round Rock, Texas',
    };
    expect(coverage.rankLocationSearchResults('Austin', [
      nonExactPlace,
      exactPoi,
      exactPlace,
    ]).map((result) => result.placeName)).toEqual(['Austin', 'Austin', 'Round Rock']);
    expect(coverage.sortPlaceResultsByDistance([
      { ...exactPlace, distanceKm: undefined },
      { ...exactPlace, id: 'near', distanceKm: 1 },
      { ...exactPlace, id: 'also-unknown', distanceKm: undefined },
    ]).map((result) => result.id)).toEqual(['near', undefined, 'also-unknown']);
  });

  it('builds bounded provider URLs and works without AbortController support', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [{ id: 'place.austin', center: [-97.7431, 30.2672] }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('AbortController', undefined);

    const { __mapServiceCoverage } = await import('@/services/mapService');
    const coverage = __mapServiceCoverage!;

    expect(coverage.clampNearbyPlaceLimit()).toBe(72);
    expect(coverage.buildMapboxCategorySearchUrl('coffee', {
      center: { latitude: 32.75, longitude: -97.33 },
      bounds: null,
    }, 8)?.searchParams.has('bbox')).toBe(false);

    const defaultSuggestUrl = coverage.buildMapboxSearchBoxSuggestUrl(
      'coffee',
      4,
      'session',
      {},
    );
    expect(defaultSuggestUrl?.searchParams.get('types')).toBe('poi');
    expect(defaultSuggestUrl?.searchParams.has('bbox')).toBe(false);

    const unboundedSuggestUrl = coverage.buildMapboxSearchBoxSuggestUrl(
      'coffee',
      4,
      'session',
      {
        proximity: { latitude: 32.75, longitude: -97.33 },
        bboxRadiusKm: null,
      },
    );
    expect(unboundedSuggestUrl?.searchParams.has('proximity')).toBe(true);
    expect(unboundedSuggestUrl?.searchParams.has('bbox')).toBe(false);

    const boundedSuggestUrl = coverage.buildMapboxSearchBoxSuggestUrl(
      'coffee',
      4,
      'session',
      {
        proximity: { latitude: 32.75, longitude: -97.33 },
      },
    );
    expect(boundedSuggestUrl?.searchParams.has('bbox')).toBe(true);
    expect(coverage.buildMapboxSearchBoxSuggestUrl(
      'coffee',
      4,
      'session',
      {
        proximity: { latitude: 32.75, longitude: -97.33 },
        bboxRadiusKm: 0,
      },
    )?.searchParams.has('bbox')).toBe(false);

    const defaultGeocodeUrl = coverage.buildMapboxGeocodeUrl('Austin', 4);
    expect(defaultGeocodeUrl?.searchParams.get('types')).toContain('address');
    const unboundedGeocodeUrl = coverage.buildMapboxGeocodeUrl('Austin', 4, {
      proximity: { latitude: 30.2672, longitude: -97.7431 },
      bboxRadiusKm: null,
    });
    expect(unboundedGeocodeUrl?.searchParams.has('bbox')).toBe(false);
    const boundedGeocodeUrl = coverage.buildMapboxGeocodeUrl('Austin', 4, {
      proximity: { latitude: 30.2672, longitude: -97.7431 },
    });
    expect(boundedGeocodeUrl?.searchParams.has('bbox')).toBe(true);
    expect(coverage.buildMapboxGeocodeUrl('Austin', 4, {
      proximity: { latitude: 30.2672, longitude: -97.7431 },
      bboxRadiusKm: 0,
    })?.searchParams.has('bbox')).toBe(false);

    await expect(coverage.fetchMapboxFeatures(defaultGeocodeUrl)).resolves.toEqual([
      expect.objectContaining({ id: 'place.austin' }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(defaultGeocodeUrl?.toString(), undefined);

    mapboxLoaderMock.token = '';
    expect(coverage.buildMapboxGeocodeUrl('Austin', 4)).toBeNull();
    expect(coverage.buildMapboxSearchBoxSuggestUrl('Austin', 4, 'session', {})).toBeNull();
  });

  it('handles sparse Search Box features and distance-free nearby duplicates', async () => {
    const { __mapServiceCoverage } = await import('@/services/mapService');
    const coverage = __mapServiceCoverage!;

    expect(coverage.readSearchBoxFeatureCoordinate({})).toBeNull();
    expect(coverage.mapboxSearchBoxFeatureToPlaceSearchResult(
      {},
      {
        geometry: { coordinates: [-97.33, 32.75] },
      },
    )).toMatchObject({
      placeName: 'Pinned location',
      formattedAddress: 'Pinned location',
      precision: 'poi',
      providerPlaceId: undefined,
      id: undefined,
      distanceKm: undefined,
    });
    expect(coverage.mapboxSearchBoxCategoryFeatureToNearbyPlaceResult(
      '',
      {
        geometry: { coordinates: [-97.33, 32.75] },
      },
      { latitude: 32.75, longitude: -97.33 },
    )).toMatchObject({
      placeName: 'Nearby place',
      categoryLabel: '',
    });

    const normalized = coverage.normalizeNearbyPlaceResults([
      {
        id: 'same',
        placeName: 'First unknown distance',
        latitude: 32.75,
        longitude: -97.33,
        source: 'mapbox',
      },
      {
        id: 'same',
        placeName: 'Known distance',
        latitude: 32.751,
        longitude: -97.331,
        distanceKm: 1,
        source: 'mapbox',
      },
      {
        id: 'same',
        placeName: 'Later unknown distance',
        latitude: 32.753,
        longitude: -97.333,
        source: 'mapbox',
      },
      {
        id: 'other',
        placeName: 'Second unknown distance',
        latitude: 32.752,
        longitude: -97.332,
        source: 'mapbox',
      },
    ], {
      center: { latitude: 32.75, longitude: -97.33 },
    }, 3);
    expect(normalized.map((place) => place.placeName)).toEqual([
      'Known distance',
      'Second unknown distance',
    ]);
  });

  it('honors public defaults and rejects empty searches before provider calls', async () => {
    mapboxLoaderMock.token = '';
    apiMock.get.mockResolvedValue({ data: { data: [] } });

    const mapService = await import('@/services/mapService');

    await expect(mapService.geocode('Nowhere')).resolves.toEqual({ data: [] });
    await expect(mapService.searchPlaces('')).resolves.toEqual({ data: [] });
    await expect(mapService.searchLocations('')).resolves.toEqual({ data: [] });
    await expect(mapService.searchNearbyPlaces({
      center: { latitude: 32.75, longitude: -97.33 },
      categories: ['@@@'],
    })).resolves.toEqual({ data: [] });

    apiMock.get.mockResolvedValueOnce({
      data: {
        configured: true,
        coverage: 'exact',
        source: 'Google Places',
      },
    });
    await expect(mapService.getPlacePhoto({
      title: 'Width fallback place',
      latitude: 32.75,
      longitude: -97.33,
      maxWidthPx: Number.NaN,
    })).resolves.toMatchObject({ configured: true });
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/intel/place-photo', {
      params: expect.objectContaining({ maxWidthPx: 640 }),
    });
  });

  it('sorts mock place matches with and without proximity and preserves blank addresses', async () => {
    mapboxLoaderMock.token = '';
    apiMock.get.mockRejectedValue(new Error('intel offline'));
    vi.doMock('@/services/demoMode', () => ({
      localFallbackEnabled: vi.fn().mockReturnValue(true),
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue({
        mockSpots: [
          {
            id: 'blank-address',
            title: 'Coverage Place',
            address: '',
            city: '',
            country: '',
            category: 'scenic',
            vibe: 'quiet',
            latitude: 32.75,
            longitude: -97.33,
          },
          {
            id: 'far-address',
            title: 'Coverage Place Far',
            address: '900 Far Street',
            city: 'Fort Worth',
            country: 'United States',
            category: 'scenic',
            vibe: 'quiet',
            latitude: 33.75,
            longitude: -98.33,
          },
        ],
      }),
    }));

    const mapService = await import('@/services/mapService');

    const unordered = await mapService.searchPlaces('coverage place');
    expect(unordered.data).toHaveLength(2);
    expect(unordered.data[0]).toMatchObject({
      id: 'blank-address',
      formattedAddress: undefined,
      distanceKm: undefined,
    });

    const ordered = await mapService.searchPlaces('coverage place', {
      proximity: { latitude: 32.75, longitude: -97.33 },
    });
    expect(ordered.data.map((place) => place.id)).toEqual(['blank-address', 'far-address']);
    expect(ordered.data.every((place) => typeof place.distanceKm === 'number')).toBe(true);

    const nearby = await mapService.searchNearbyPlaces({
      center: { latitude: 32.75, longitude: -97.33 },
      categories: ['scenic'],
      limit: 2,
    });
    expect(nearby.data.find((place) => place.id === 'blank-address')?.formattedAddress).toBeUndefined();
  });
});
