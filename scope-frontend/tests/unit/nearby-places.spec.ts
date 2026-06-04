const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

describe('nearby place search', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    apiMock.get.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fetches Mapbox category results for the current viewport and normalizes marker details', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      const category = url.pathname.split('/').pop();

      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          type: 'FeatureCollection',
          features: category === 'school'
            ? [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [-97.196, 32.704] },
                  properties: {
                    name: 'Birdville High School',
                    mapbox_id: 'school.1',
                    feature_type: 'poi',
                    address: '9100 Mid Cities Blvd',
                    full_address: '9100 Mid Cities Blvd, North Richland Hills, Texas',
                    image_url: 'https://images.example.com/birdville.jpg',
                    poi_category: ['education'],
                    context: {
                      place: { name: 'North Richland Hills' },
                      country: { name: 'United States' },
                    },
                  },
                },
              ]
            : [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [-97.203, 32.699] },
                  properties: {
                    name: 'Kroger',
                    mapbox_id: 'store.1',
                    feature_type: 'poi',
                    full_address: '7201 Boulevard 26, North Richland Hills, Texas',
                    photos: [{ url: 'https://images.example.com/kroger.jpg' }],
                    poi_category: ['grocery'],
                    context: {
                      place: { name: 'North Richland Hills' },
                      country: { name: 'United States' },
                    },
                  },
                },
              ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchNearbyPlaces } = await import('@/services/mapService');
    const response = await searchNearbyPlaces({
      center: { latitude: 32.7, longitude: -97.2 },
      bounds: {
        west: -97.3,
        south: 32.6,
        east: -97.1,
        north: 32.8,
      },
      categories: ['food_and_drink', 'school'],
      limit: 4,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/category/food_and_drink?'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/category/school?'));

    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(firstUrl.searchParams.get('access_token')).toBe('pk.test-token');
    expect(firstUrl.searchParams.get('proximity')).toBe('-97.2,32.7');
    expect(firstUrl.searchParams.get('bbox')).toBe('-97.300000,32.600000,-97.100000,32.800000');

    expect(response.data).toHaveLength(2);
    expect(response.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        placeName: 'Birdville High School',
        categoryLabel: 'School',
        formattedAddress: '9100 Mid Cities Blvd, North Richland Hills, Texas',
        city: 'North Richland Hills',
        photoUrl: 'https://images.example.com/birdville.jpg',
      }),
      expect.objectContaining({
        placeName: 'Kroger',
        categoryLabel: 'Food & drink',
        formattedAddress: '7201 Boulevard 26, North Richland Hills, Texas',
        photoUrl: 'https://images.example.com/kroger.jpg',
      }),
    ]));
  });

  it('uses Mapbox Search Box suggestions and retrieval for place search results', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            suggestions: [
              {
                mapbox_id: 'poi.kimbell',
                name: 'Kimbell Art Museum',
                full_address: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
                poi_category: ['museum'],
                distance: 1200,
              },
              {
                mapbox_id: 'poi.irrelevant',
                name: 'Random Coffee',
                full_address: '1 Main Street, Fort Worth, Texas',
                poi_category: ['coffee'],
                distance: 100,
              },
            ],
          }),
        };
      }

      const mapboxId = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: mapboxId === 'poi.kimbell'
            ? [
                {
                  geometry: { coordinates: [-97.365, 32.748] },
                  properties: {
                    name: 'Kimbell Art Museum',
                    full_address: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
                    address: '3333 Camp Bowie Boulevard',
                    feature_type: 'poi',
                    mapbox_id: 'poi.kimbell',
                    poi_category: ['museum'],
                    context: {
                      place: { name: 'Fort Worth' },
                      country: { name: 'United States', country_code: 'us' },
                    },
                    photos: [{ url: 'https://images.example.com/kimbell.jpg' }],
                  },
                },
              ]
            : [
                {
                  geometry: { coordinates: [-97.33, 32.75] },
                  properties: {
                    name: 'Random Coffee',
                    full_address: '1 Main Street, Fort Worth, Texas',
                    feature_type: 'poi',
                    mapbox_id: 'poi.irrelevant',
                    poi_category: ['coffee'],
                  },
                },
              ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchPlaces } = await import('@/services/mapService');
    const response = await searchPlaces('Kimbell museum', {
      proximity: { latitude: 32.75, longitude: -97.36 },
      limit: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/suggest?'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/retrieve/poi.kimbell?'));
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'poi.kimbell',
        placeName: 'Kimbell Art Museum',
        city: 'Fort Worth',
        countryCode: 'us',
        category: 'museum',
        photoUrl: 'https://images.example.com/kimbell.jpg',
        source: 'mapbox',
      }),
    ]);
  });

  it('ranks exact location matches ahead of nearby POIs for route endpoint search', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            suggestions: [
              {
                mapbox_id: 'poi.austin-shop',
                name: 'Austin Gift Shop',
                full_address: '1 Congress Avenue, Austin, Texas',
                feature_type: 'poi',
                poi_category: ['shopping'],
                distance: 80,
              },
              {
                mapbox_id: 'place.austin',
                name: 'Austin',
                place_formatted: 'Texas, United States',
                feature_type: 'place',
                distance: 4000,
              },
            ],
          }),
        };
      }

      const mapboxId = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: mapboxId === 'place.austin'
            ? [
                {
                  geometry: { coordinates: [-97.7431, 30.2672] },
                  properties: {
                    name: 'Austin',
                    full_address: 'Austin, Texas, United States',
                    feature_type: 'place',
                    mapbox_id: 'place.austin',
                    context: {
                      place: { name: 'Austin' },
                      country: { name: 'United States', country_code: 'us' },
                    },
                  },
                },
              ]
            : [
                {
                  geometry: { coordinates: [-97.741, 30.268] },
                  properties: {
                    name: 'Austin Gift Shop',
                    full_address: '1 Congress Avenue, Austin, Texas',
                    feature_type: 'poi',
                    mapbox_id: 'poi.austin-shop',
                    poi_category: ['shopping'],
                  },
                },
              ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchLocations } = await import('@/services/mapService');
    const response = await searchLocations('Austin', {
      proximity: { latitude: 30.27, longitude: -97.74 },
      limit: 2,
    });

    expect(response.data.map((result) => result.id)).toEqual(['place.austin', 'poi.austin-shop']);
    expect(response.data[0]).toMatchObject({
      placeName: 'Austin',
      precision: 'place',
      source: 'mapbox',
    });
  });

  it('does not show mock nearby places unless map fallback is explicitly enabled', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { searchNearbyPlaces } = await import('@/services/mapService');
    const response = await searchNearbyPlaces({
      center: { latitude: 32.7, longitude: -97.2 },
      bounds: {
        west: -97.21,
        south: 32.69,
        east: -97.19,
        north: 32.71,
      },
      limit: 4,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.data).toEqual([]);
  });

  it('falls back from empty Search Box suggestions to unbounded Mapbox geocoding for place search', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({ suggestions: [] }),
        };
      }

      const hasBbox = url.searchParams.has('bbox');
      const types = url.searchParams.get('types');
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: hasBbox || types?.includes('address')
            ? []
            : [
                {
                  id: 'poi.coffee-stand',
                  center: [-97.331, 32.755],
                  text: 'Coffee Stand',
                  address: '400',
                  place_name: '400 Coffee Stand, Fort Worth, Texas',
                  place_type: ['poi'],
                  properties: {
                    maki: 'cafe',
                    photos: [{ url: 'https://images.example.com/coffee.jpg' }],
                  },
                  context: [
                    { id: 'place.1', text: 'Fort Worth' },
                    { id: 'country.1', text: 'United States', short_code: 'us' },
                  ],
                },
              ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchPlaces } = await import('@/services/mapService');
    const response = await searchPlaces('coffee', {
      proximity: { latitude: 32.754, longitude: -97.332 },
      limit: 4,
    });

    const geocodeCalls = fetchMock.mock.calls
      .map((call) => new URL(call[0] as string))
      .filter((url) => url.hostname === 'api.mapbox.com' && url.pathname.includes('/geocoding/'));
    expect(geocodeCalls.length).toBeGreaterThanOrEqual(3);
    expect(geocodeCalls[0]?.searchParams.get('bbox')).toBeTruthy();
    expect(geocodeCalls[1]?.searchParams.get('types')).toContain('address');
    expect(geocodeCalls.some((url) => !url.searchParams.has('bbox'))).toBe(true);
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'poi.coffee-stand',
        placeName: 'Coffee Stand',
        address: '400 Coffee Stand',
        city: 'Fort Worth',
        countryCode: 'us',
        category: 'cafe',
        photoUrl: 'https://images.example.com/coffee.jpg',
        source: 'mapbox',
      }),
    ]);
  });

  it('uses Mapbox geocoding for endpoint search when Search Box and POI lookup miss', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({ suggestions: [] }),
        };
      }

      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              id: 'place.denton',
              center: [-97.1331, 33.2148],
              text: 'Denton',
              place_name: 'Denton, Texas, United States',
              place_type: ['place'],
              context: [
                { id: 'place.1', text: 'Denton' },
                { id: 'country.1', text: 'United States', short_code: 'us' },
              ],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchLocations } = await import('@/services/mapService');
    const response = await searchLocations('Denton', {
      preferPoi: false,
      limit: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/suggest?'));
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('mapbox.places/Denton.json'))).toBe(true);
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'place.denton',
        placeName: 'Denton',
        precision: 'place',
        source: 'mapbox',
      }),
    ]);
  });

  it('returns explicit mock place search results only when the map fallback flag is enabled', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('VITE_ENABLE_MAP_MOCK_FALLBACK', 'true');
    vi.stubGlobal('fetch', vi.fn());

    const { searchPlaces } = await import('@/services/mapService');
    const response = await searchPlaces('rooftop tacos', {
      proximity: { latitude: 32.75, longitude: -97.33 },
      limit: 2,
    });

    expect(response.data[0]).toMatchObject({
      placeName: 'Sunset Rooftop Tacos',
      precision: 'mock',
      source: 'mock',
    });
    expect(response.data[0]?.distanceKm).toBeGreaterThan(0);
  });

  it('uses explicit mock nearby places for planner map exploration when Mapbox is unavailable', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('VITE_ENABLE_MAP_MOCK_FALLBACK', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { searchNearbyPlaces } = await import('@/services/mapService');
    const response = await searchNearbyPlaces({
      center: { latitude: 32.754, longitude: -97.331 },
      bounds: {
        west: -97.5,
        south: 32.6,
        east: -97.1,
        north: 32.9,
      },
      categories: ['restaurant', 'coffee'],
      limit: 5,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data.every((place) => place.source === 'mock')).toBe(true);
    expect(response.data[0]).toEqual(expect.objectContaining({
      categoryLabel: expect.any(String),
      distanceKm: expect.any(Number),
    }));
  });

  it('validates and caches Google place photo lookups from the intel API', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        configured: true,
        photoUrl: 'https://lh3.googleusercontent.com/scope-place-photo=w640',
        photoAttribution: 'Scope Photos',
        photoAttributionUrl: 'https://maps.google.com',
        source: 'Google Places',
      },
    });

    const { getPlacePhoto } = await import('@/services/mapService');
    const invalid = await getPlacePhoto({
      title: '',
      latitude: 132,
      longitude: -97,
    });
    expect(invalid).toMatchObject({
      configured: false,
      coverage: 'A place name and coordinates are required before loading a photo.',
      source: 'Google Places',
    });

    const firstLookup = await getPlacePhoto({
      title: 'Kimbell Art Museum',
      address: '3333 Camp Bowie Blvd, Fort Worth, TX',
      latitude: 32.7487,
      longitude: -97.3654,
      maxWidthPx: 4096,
    });
    const cachedLookup = await getPlacePhoto({
      title: 'Kimbell Art Museum',
      address: '3333 Camp Bowie Blvd, Fort Worth, TX',
      latitude: 32.7487,
      longitude: -97.3654,
      maxWidthPx: 4096,
    });

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/place-photo', {
      params: {
        q: 'Kimbell Art Museum',
        address: '3333 Camp Bowie Blvd, Fort Worth, TX',
        lat: 32.7487,
        lng: -97.3654,
        maxWidthPx: 1600,
      },
    });
    expect(firstLookup).toMatchObject({
      configured: true,
      photoUrl: 'https://lh3.googleusercontent.com/scope-place-photo=w640',
      source: 'Google Places',
    });
    expect(cachedLookup).toEqual(firstLookup);
  });

  it('returns a clear place-photo fallback when configured providers are unavailable', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('photo provider unavailable'));

    const { getPlacePhoto } = await import('@/services/mapService');
    const response = await getPlacePhoto({
      title: 'Main Street Coffee',
      latitude: 32.9343,
      longitude: -97.0781,
      maxWidthPx: 64,
    });

    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/place-photo', {
      params: expect.objectContaining({
        q: 'Main Street Coffee',
        maxWidthPx: 128,
      }),
    });
    expect(response).toMatchObject({
      configured: false,
      coverage: 'Google Places photo lookup is unavailable right now.',
      source: 'Google Places',
    });
  });

  it('keeps empty map searches local and sanitizes unsafe provider photo metadata', async () => {
    const {
      geocodeMapTarget,
      getPlacePhoto,
      searchLocations,
      searchNearbyPlaces,
      searchPlaces,
    } = await import('@/services/mapService');

    await expect(geocodeMapTarget('   ')).resolves.toEqual({ data: [] });
    await expect(searchPlaces('   ', { limit: 99 })).resolves.toEqual({ data: [] });
    await expect(searchLocations('', { limit: 99 })).resolves.toEqual({ data: [] });
    await expect(searchNearbyPlaces({
      center: { latitude: Number.NaN, longitude: -97.2 },
      categories: ['coffee'],
      limit: 99,
    })).resolves.toEqual({ data: [] });

    apiMock.get.mockResolvedValueOnce({
      data: {
        data: {
          configured: true,
          coverage: '  Live provider  ',
          photoUrl: 'javascript:alert(1)',
          photoAttribution: '  Provider Photos  ',
          photoAttributionUrl: 'http://[::1',
          source: '',
          license: '  CC BY  ',
        },
      },
    });

    const photo = await getPlacePhoto({
      title: 'Unsafe Photo Row',
      latitude: 32.755,
      longitude: -97.331,
    });

    expect(photo).toEqual({
      configured: true,
      coverage: 'Live provider',
      photoUrl: undefined,
      photoAttribution: 'Provider Photos',
      photoAttributionUrl: undefined,
      source: 'Google Places',
      license: 'CC BY',
    });
  });

  it('uses the local dev place-photo proxy before the intel API outside test mode', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn().mockResolvedValue({
        configured: true,
        photoUrl: 'https://lh3.googleusercontent.com/dev-proxy-photo=w512',
        source: 'Google Places',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { getPlacePhoto } = await import('@/services/mapService');
    const response = await getPlacePhoto({
      title: 'Dev Proxy Cafe',
      address: '100 Main Street',
      latitude: 32.755,
      longitude: -97.331,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const requestUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(requestUrl.pathname).toBe('/__scope-dev/place-photo');
    expect(requestUrl.searchParams.get('q')).toBe('Dev Proxy Cafe');
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(response.photoUrl).toContain('dev-proxy-photo');
  });

  it('falls back from provider reverse-geocode placeholders to Mapbox or coordinates', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    apiMock.get.mockResolvedValueOnce({
      data: {
        latitude: 32.1,
        longitude: -97.1,
        placeName: 'Fallback coordinate',
        precision: 'fallback',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [{
          id: 'address.1',
          center: [-97.0781, 32.9343],
          text: '500 Main Street',
          place_name: '500 Main Street, Grapevine, Texas, United States',
          place_type: ['address'],
          context: [
            { id: 'place.1', text: 'Grapevine' },
            { id: 'country.1', text: 'United States', short_code: 'us' },
          ],
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { reverseGeocode } = await import('@/services/mapService');
    const result = await reverseGeocode(32.9343, -97.0781);
    expect(result).toMatchObject({
      latitude: 32.9343,
      longitude: -97.0781,
      placeName: '500 Main Street',
      city: 'Grapevine',
      precision: 'address',
    });

    apiMock.get.mockRejectedValueOnce(new Error('reverse unavailable'));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    });
    const coordinateFallback = await reverseGeocode(33.1234, -96.5678);
    expect(coordinateFallback).toMatchObject({
      latitude: 33.1234,
      longitude: -96.5678,
      precision: 'coordinate',
    });
  });

  it('filters provider geocode placeholders before using Mapbox or mock location fallbacks', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            latitude: 32.7,
            longitude: -97.2,
            placeName: 'Provider fallback',
            precision: 'fallback',
          },
          {
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Austin',
            formattedAddress: 'Austin, Texas, United States',
            precision: 'place',
          },
        ],
      },
    });

    const { geocode } = await import('@/services/mapService');
    const providerResults = await geocode('Austin', 4);
    expect(providerResults.data).toEqual([
      expect.objectContaining({
        placeName: 'Austin',
        precision: 'place',
      }),
    ]);

    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('VITE_ENABLE_MAP_MOCK_FALLBACK', 'true');
    apiMock.get.mockReset();
    apiMock.get.mockRejectedValueOnce(new Error('provider offline'));

    const fallbackService = await import('@/services/mapService');
    const fallbackResults = await fallbackService.geocode('rooftop tacos', 2);
    expect(fallbackResults.data[0]).toMatchObject({
      placeName: 'Sunset Rooftop Tacos',
      city: 'Fort Worth',
    });
  });

  it('dedupes, bounds-filters, and batches Mapbox nearby category searches for route exploration', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      const category = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const features = category === 'coffee'
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.203, 32.699] },
              properties: {
                name: 'Route Coffee',
                mapbox_id: 'shared-route-place',
                full_address: '10 Route Coffee Rd, Fort Worth, Texas',
                poi_category: ['coffee'],
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-99.2, 34.1] },
              properties: {
                name: 'Out of bounds coffee',
                mapbox_id: 'out-of-bounds',
              },
            },
          ]
        : category === 'restaurant'
          ? [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-97.201, 32.701] },
                properties: {
                  name: 'Route Coffee',
                  mapbox_id: 'shared-route-place',
                  full_address: '12 Better Route Coffee Rd, Fort Worth, Texas',
                  poi_category: ['restaurant'],
                },
              },
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: ['bad', 32.7] },
                properties: {
                  name: 'Broken provider row',
                  mapbox_id: 'broken-row',
                },
              },
            ]
          : [];

      return {
        ok: true,
        json: vi.fn().mockResolvedValue({ features }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchNearbyPlaces } = await import('@/services/mapService');
    const response = await searchNearbyPlaces({
      center: { latitude: 32.7, longitude: -97.2 },
      bounds: {
        west: -97.4,
        south: 32.5,
        east: -97.0,
        north: 32.9,
      },
      categories: ['coffee', 'restaurant', 'park', 'museum', 'hotel', 'pharmacy', 'shopping'],
      limit: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).searchParams.get('limit')).toBe('25');
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'shared-route-place',
        placeName: 'Route Coffee',
        formattedAddress: '12 Better Route Coffee Rd, Fort Worth, Texas',
        categoryId: 'restaurant',
      }),
    ]);
  });

  it('falls through Search Box misses and invalid retrieve features before ranking endpoint POIs', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            suggestions: [
              {
                mapbox_id: 'poi.missing',
                name: 'Missing Feature',
                full_address: '1 Nowhere',
                feature_type: 'poi',
              },
              {
                mapbox_id: 'poi.bad-coords',
                name: 'Bad Coordinates',
                full_address: '2 Nowhere',
                feature_type: 'poi',
              },
            ],
          }),
        };
      }

      if (url.pathname.includes('/retrieve/poi.missing')) {
        return {
          ok: false,
          json: vi.fn().mockResolvedValue({}),
        };
      }

      if (url.pathname.includes('/retrieve/poi.bad-coords')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            features: [
              {
                geometry: { coordinates: [] },
                properties: { name: 'Bad Coordinates' },
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              id: 'poi.austin-market',
              center: [-97.745, 30.268],
              text: 'Austin Market',
              place_name: 'Austin Market, Austin, Texas',
              place_type: ['poi'],
              properties: {
                maki: 'market',
              },
              context: [
                { id: 'place.1', text: 'Austin' },
                { id: 'country.1', text: 'United States' },
              ],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchLocations } = await import('@/services/mapService');
    const response = await searchLocations('Austin Market', {
      proximity: { latitude: 30.2672, longitude: -97.7431 },
      limit: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/retrieve/poi.missing?'));
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'poi.austin-market',
        placeName: 'Austin Market',
        category: 'market',
      }),
    ]);
  });

  it('uses the non-randomUUID Search Box session path and maps sparse provider place records', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    vi.stubGlobal('crypto', {});

    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (url.pathname.endsWith('/suggest')) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            suggestions: [
              {
                mapbox_id: 'poi.eldorado',
                name: 'Eldorado Canyon',
                place_formatted: 'Colorado, United States',
                maki: 'park',
                distance: 2500,
              },
              {
                name: 'Missing provider id',
                place_formatted: 'Nowhere',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              geometry: { coordinates: [-105.292, 39.93] },
              properties: {
                address: '9 Kneale Road',
                feature_type: 'poi',
                mapbox_id: 'poi.eldorado',
                maki: 'park',
                image: {
                  nested: {
                    thumbnail: 'javascript:alert(1)',
                  },
                  url: 'https://images.example.com/eldorado.jpg',
                },
                context: {
                  locality: { name: 'Eldorado Springs' },
                  country: { name: 'United States', short_code: 'us' },
                },
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchPlaces } = await import('@/services/mapService');
    const response = await searchPlaces('Eldorado Canyon', {
      sortByDistance: false,
      limit: 4,
    });

    const suggestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(suggestUrl.searchParams.get('session_token')).toMatch(/^scope-/);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/retrieve/poi.eldorado?'));
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/retrieve/undefined'))).toBe(false);
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'poi.eldorado',
        placeName: 'Eldorado Canyon',
        formattedAddress: 'Colorado, United States',
        address: '9 Kneale Road',
        city: 'Eldorado Springs',
        countryCode: 'us',
        category: 'park',
        photoUrl: 'https://images.example.com/eldorado.jpg',
        distanceKm: 2.5,
      }),
    ]);

    dateNowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('normalizes custom nearby categories, fallback addresses, and invalid viewport bounds', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.199, 32.701] },
              properties: {
                name_preferred: 'Route Charge Plaza',
                address: '10 Charger Way',
                place_formatted: 'North Richland Hills, Texas',
                mapbox_id: 'ev.1',
                feature_type: 'poi',
                context: {
                  city: { name: 'North Richland Hills' },
                  country: { name: 'United States' },
                },
                photo: [
                  { uri: 'ftp://bad.example.com/photo.jpg' },
                  { href: 'https://images.example.com/charger.jpg' },
                ],
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.4, 32.4] },
              properties: {
                name: 'Far Away Charger',
                mapbox_id: 'ev.outside',
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchNearbyPlaces } = await import('@/services/mapService');
    const response = await searchNearbyPlaces({
      center: { latitude: 32.7, longitude: -97.2 },
      bounds: {
        west: -97.3,
        south: 32.6,
        east: -97.1,
        north: 32.8,
      },
      categories: ['ev-charging!', 'evcharging', ''],
      limit: 99,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toContain('/category/evcharging');
    expect(requestUrl.searchParams.get('limit')).toBe('25');
    expect(requestUrl.searchParams.get('bbox')).toBe('-97.300000,32.600000,-97.100000,32.800000');
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'ev.1',
        placeName: 'Route Charge Plaza',
        formattedAddress: '10 Charger Way, North Richland Hills, Texas',
        category: 'Evcharging',
        categoryId: 'evcharging',
        categoryLabel: 'Evcharging',
        city: 'North Richland Hills',
        photoUrl: 'https://images.example.com/charger.jpg',
      }),
    ]);
  });

  it('returns empty or coordinate-only map envelopes when every live provider is unavailable', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('VITE_ENABLE_MAP_MOCK_FALLBACK', 'false');
    apiMock.get.mockRejectedValue(new Error('provider offline'));

    const {
      geocode,
      geocodeMapTarget,
      reverseGeocode,
      searchLocations,
      searchNearbyPlaces,
      searchPlaces,
    } = await import('@/services/mapService');

    await expect(geocode('Missing trailhead', 3)).resolves.toEqual({ data: [] });
    await expect(geocodeMapTarget('   ', 3)).resolves.toEqual({ data: [] });
    await expect(geocodeMapTarget('Missing trailhead', 3)).resolves.toEqual({ data: [] });
    await expect(searchPlaces('Missing cafe', { limit: 3 })).resolves.toEqual({ data: [] });
    await expect(searchLocations('   ', { limit: 3 })).resolves.toEqual({ data: [] });
    await expect(searchLocations('Missing city', { limit: 3, preferPoi: false })).resolves.toEqual({ data: [] });
    await expect(searchNearbyPlaces({
      center: { latitude: Number.NaN, longitude: -97.2 },
      categories: ['coffee'],
      limit: 3,
    })).resolves.toEqual({ data: [] });
    await expect(searchNearbyPlaces({
      center: { latitude: 32.7, longitude: -97.2 },
      categories: ['coffee'],
      limit: 3,
    })).resolves.toEqual({ data: [] });

    const reverseFallback = await reverseGeocode(32.7, -97.2);
    expect(reverseFallback).toMatchObject({
      latitude: 32.7,
      longitude: -97.2,
      precision: 'coordinate',
    });

    const reverseFallbackFromCache = await reverseGeocode(32.7, -97.2);
    expect(reverseFallbackFromCache).toEqual(reverseFallback);
  });
});
