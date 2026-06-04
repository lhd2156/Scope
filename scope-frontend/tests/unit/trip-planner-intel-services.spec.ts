const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

describe('trip planner intel service contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_DEMO_FUEL_PRICES', 'false');
    vi.stubEnv('VITE_ENABLE_DEMO_WEATHER', 'false');
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'false');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', '');
    apiMock.get.mockReset();
    apiMock.post.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sanitizes route-nearby suggestions before the planner renders them', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          configured: 1,
          coverage: '  Google Places corridor coverage  ',
          source: '  Scope Intel  ',
          category: 'fuel',
          radiusKm: '18.5',
          suggestions: [
            {
              id: '',
              placeId: '  google-place-1  ',
              title: '  Trailhead Travel Stop  ',
              subtitle: '',
              address: '  100 Route Rd  ',
              latitude: '32.755',
              longitude: '-97.331',
              category: '  fuel  ',
              source: 'scope',
              sourceLabel: '  Scope  ',
              distanceKm: '4.2',
              rating: '4.6',
              reviewCount: '180',
              priceLevel: '  $$  ',
              priceLabel: '  moderate  ',
              priceValue: '22.5',
              fuelType: '  diesel  ',
              isOpen: true,
              websiteUrl: ' https://fuel.example.com ',
              photoUrl: ' https://images.example.com/fuel.jpg ',
              photoAttribution: '  Google  ',
              photoAttributionUrl: ' https://maps.example.com/contrib ',
              reason: '  Best fuel before the long leg  ',
              anchorId: '  route-1  ',
              anchorLabel: '  Fort Worth  ',
            },
            {
              title: 'Missing coordinates',
              latitude: 'not-a-number',
              longitude: -97.33,
            },
          ],
        },
      },
    });

    const service = await import('@/services/travelNearbyService');
    const response = await service.getTravelNearbySuggestions({
      anchors: [{ id: 'start', placeLabel: 'Fort Worth', latitude: 32.755, longitude: -97.331 }],
      category: 'fuel',
      limit: 6,
      radiusKm: 18.5,
      fuelType: 'diesel',
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/travel/nearby', {
      anchors: [{ id: 'start', placeLabel: 'Fort Worth', latitude: 32.755, longitude: -97.331 }],
      category: 'fuel',
      limit: 6,
      radiusKm: 18.5,
      fuelType: 'diesel',
    });
    expect(response).toMatchObject({
      configured: true,
      coverage: 'Google Places corridor coverage',
      source: 'Scope Intel',
      category: 'fuel',
      radiusKm: 18.5,
    });
    expect(response.suggestions).toHaveLength(1);
    expect(response.suggestions[0]).toMatchObject({
      id: 'scope-Trailhead Travel Stop-32.755--97.331',
      placeId: 'google-place-1',
      title: 'Trailhead Travel Stop',
      subtitle: 'Nearby travel suggestion',
      address: '100 Route Rd',
      latitude: 32.755,
      longitude: -97.331,
      category: 'fuel',
      source: 'scope',
      distanceKm: 4.2,
      rating: 4.6,
      reviewCount: 180,
      priceValue: 22.5,
      isOpen: true,
      reason: 'Best fuel before the long leg',
      anchorLabel: 'Fort Worth',
    });
  });

  it.each(['shopping', 'outdoors', 'nightlife'] as const)('keeps %s travel-nearby category responses first-class', async (category) => {
    apiMock.post.mockResolvedValue({
      data: {
        configured: true,
        coverage: 'Provider category coverage',
        source: 'Scope Intel',
        category,
        radiusKm: 12,
        suggestions: [
          {
            id: `${category}-1`,
            title: 'Category Fit',
            subtitle: 'Provider match',
            latitude: 32.75,
            longitude: -97.33,
            category,
            source: 'google',
          },
        ],
      },
    });

    const service = await import('@/services/travelNearbyService');
    const response = await service.getTravelNearbySuggestions({
      anchors: [{ id: 'start', placeLabel: 'Fort Worth', latitude: 32.755, longitude: -97.331 }],
      category,
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/travel/nearby', {
      anchors: [{ id: 'start', placeLabel: 'Fort Worth', latitude: 32.755, longitude: -97.331 }],
      category,
    });
    expect(response.category).toBe(category);
    expect(response.suggestions[0]?.category).toBe(category);
  });

  it('falls back invalid travel-nearby payload fields without leaking unsafe media', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        configured: false,
        coverage: '',
        source: '',
        category: 'unknown',
        radiusKm: 'not-a-number',
        suggestions: [
          {
            id: '  ',
            title: '  Coffee Stop\nNear Route  ',
            subtitle: '',
            latitude: '32.75',
            longitude: '-97.33',
            category: '',
            source: 'not-scope',
            isOpen: 'yes',
            photoUrl: 'javascript:alert(1)',
          },
          {
            title: '',
            latitude: 32.75,
            longitude: -97.33,
          },
        ],
      },
    });

    const service = await import('@/services/travelNearbyService');
    const response = await service.getTravelNearbySuggestions({
      anchors: [{ id: 'start', placeLabel: 'Fort Worth', latitude: 32.755, longitude: -97.331 }],
      category: 'recommended',
    });

    expect(response).toMatchObject({
      configured: false,
      coverage: '',
      source: 'Scope + Google Places',
      category: 'recommended',
      radiusKm: 16.09,
    });
    expect(response.suggestions).toEqual([
      expect.objectContaining({
        id: 'google-Coffee Stop Near Route-32.750--97.330',
        title: 'Coffee Stop Near Route',
        subtitle: 'Nearby travel suggestion',
        category: 'other',
        source: 'google',
        isOpen: null,
        photoUrl: undefined,
      }),
    ]);
  });

  it('normalizes fuel lookup responses and reuses fresh cache entries', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          configured: true,
          coverage: '  Live Google fuel coverage  ',
          source: '  Google Places  ',
          license: 2026,
          radiusKm: '12',
          sortBy: 'best_price',
          stations: [
            {
              id: '',
              name: '  Routeway Market Fuel  ',
              address: '  200 Fuel Loop  ',
              fuelType: '',
              currency: '',
              pricePerUnit: '3.49',
              distanceKm: '2.25',
            },
          ],
        },
      },
    });

    const service = await import('@/services/fuelPriceService');
    const first = await service.getNearbyFuelStations({
      latitude: 32.7555,
      longitude: -97.3308,
      radiusKm: 12,
      fuelType: 'regular',
      limit: 3,
      sortBy: 'best_price',
    });
    const second = await service.getNearbyFuelStations({
      latitude: 32.7555,
      longitude: -97.3308,
      radiusKm: 12,
      fuelType: 'regular',
      limit: 3,
      sortBy: 'best_price',
    });

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/fuel/stations', {
      params: {
        lat: 32.7555,
        lng: -97.3308,
        radiusKm: 12,
        fuelType: 'regular',
        limit: 3,
        sortBy: 'best_price',
      },
    });
    expect(second).toBe(first);
    expect(first).toMatchObject({
      configured: true,
      coverage: 'Live Google fuel coverage',
      source: 'Google Places',
      license: '2026',
      radiusKm: 12,
      sortBy: 'best_price',
      stations: [
        {
          id: 'Routeway Market Fuel',
          name: 'Routeway Market Fuel',
          address: '200 Fuel Loop',
          fuelType: 'all',
          currency: 'USD',
          pricePerUnit: 3.49,
          distanceKm: 2.25,
        },
      ],
    });
  });

  it('normalizes malformed fuel stations while preserving safe lookup metadata', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        configured: true,
        coverage: null,
        source: '',
        radiusKm: 'bad',
        sortBy: 'closest',
        stations: [
          {
            id: undefined,
            name: '',
            address: '  ',
            fuelType: '',
            currency: '',
            pricePerUnit: 'not-a-price',
            distanceKm: 'far',
          },
        ],
      },
    });

    const service = await import('@/services/fuelPriceService');
    const response = await service.getNearbyFuelStations({
      latitude: 33.01,
      longitude: -97.02,
      radiusKm: 11,
      fuelType: 'diesel',
      limit: 1,
      sortBy: 'closest',
    });

    expect(response).toMatchObject({
      configured: true,
      coverage: '',
      source: 'Google Places',
      sortBy: 'closest',
      stations: [
        {
          id: 'Fuel station',
          name: 'Fuel station',
          address: '',
          fuelType: 'all',
          currency: 'USD',
          pricePerUnit: null,
          distanceKm: undefined,
        },
      ],
    });
    expect(response.radiusKm).toBeUndefined();
  });

  it('uses the local development Google fuel proxy before falling back to demo data', async () => {
    vi.stubEnv('MODE', 'development');
    apiMock.get.mockRejectedValue(new Error('fuel endpoint unavailable'));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          configured: true,
          coverage: '  Local Google Places proxy  ',
          source: '  Google Places Dev Proxy  ',
          radiusKm: '7',
          sortBy: 'best_price',
          stations: [
            {
              id: 'dev-fuel-1',
              name: '  Dev Proxy Fuel  ',
              address: '  10 Test Route  ',
              fuelType: 'diesel',
              currency: 'USD',
              pricePerUnit: 3.79,
              distanceKm: 1.2,
            },
          ],
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/fuelPriceService');
    const response = await service.getNearbyFuelStations({
      latitude: 31.99,
      longitude: -97.01,
      radiusKm: 7,
      fuelType: 'diesel',
      limit: 2,
      sortBy: 'best_price',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe('/__scope-dev/fuel/stations');
    expect(requestUrl.searchParams.get('fuelType')).toBe('diesel');
    expect(response).toMatchObject({
      configured: true,
      coverage: 'Local Google Places proxy',
      source: 'Google Places Dev Proxy',
      radiusKm: 7,
      sortBy: 'best_price',
      stations: [
        {
          id: 'dev-fuel-1',
          name: 'Dev Proxy Fuel',
          address: '10 Test Route',
          fuelType: 'diesel',
          pricePerUnit: 3.79,
          distanceKm: 1.2,
        },
      ],
    });
  });

  it('uses deterministic demo fuel prices only when the explicit demo flag is enabled', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_ENABLE_DEMO_FUEL_PRICES', 'true');
    apiMock.get.mockRejectedValue(new Error('fuel endpoint unavailable'));

    const service = await import('@/services/fuelPriceService');
    const response = await service.getNearbyFuelStations({
      latitude: 35.468,
      longitude: -97.516,
      radiusKm: 9,
      fuelType: 'premium',
      limit: 2,
      sortBy: 'closest',
    });

    expect(response).toMatchObject({
      configured: true,
      coverage: expect.stringContaining('Demo fuel preview'),
      source: 'Scope demo fuel preview',
      license: 'Local demo fixture',
      radiusKm: 9,
      sortBy: 'closest',
    });
    expect(response.stations).toHaveLength(2);
    expect(response.stations[0]).toMatchObject({
      id: 'demo-fuel-35.468--97.516-0',
      name: 'Routeway Market Fuel',
      brand: 'Scope Demo',
      fuelType: 'premium',
      currency: 'USD',
      isOpen: true,
    });
    expect(response.stations[0]?.pricePerUnit).toBeGreaterThan(3.5);
  });

  it('rejects malformed backend weather when client fallback is disabled', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          label: 'Dallas',
          temperatureF: null,
          condition: '',
          windMph: 8,
        },
      },
    });

    const service = await import('@/services/openWeatherMapService');

    await expect(service.getOpenWeatherMapSnapshot({
      label: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
    })).rejects.toThrow('Weather is unavailable right now.');
  });

  it('normalizes backend weather for coordinate-only route points', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          label: 'Backend Route Point',
          latitude: 35.221,
          longitude: -101.831,
          temperatureF: 62,
          condition: 'windy',
          windMph: 21,
          provider: 'openmeteo',
          freshnessSeconds: null,
          isStale: true,
          conditionCode: null,
          iconCode: '',
        },
      },
    });

    const service = await import('@/services/openWeatherMapService');
    const snapshot = await service.getOpenWeatherMapSnapshot({
      label: '   ',
      latitude: 35.221,
      longitude: -101.831,
    });

    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/weather/current', {
      params: {
        lat: 35.221,
        lng: -101.831,
      },
    });
    expect(snapshot).toMatchObject({
      id: 'Backend Route Point:35.221:-101.831',
      label: 'Backend Route Point',
      condition: 'Windy',
      provider: 'openmeteo',
      providerLabel: 'Scope weather',
      isStale: true,
    });
    expect(snapshot.freshnessSeconds).toBeUndefined();
    expect(snapshot.conditionCode).toBeUndefined();
  });

  it('reports client weather support from fetch availability', async () => {
    vi.stubGlobal('fetch', undefined);

    const service = await import('@/services/openWeatherMapService');

    expect(service.canLoadOpenWeatherMapWeather()).toBe(false);
  });

  it('maps OpenWeatherMap air quality labels and daytime from provider metadata', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn();
    [2, 3, 4, 5, 9].forEach((aqi) => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            name: 'Wichita Mountains',
            coord: { lat: 34.745, lon: -98.532 },
            main: { temp: 71 },
            weather: [{ id: 801, main: 'Clouds', icon: '02x' }],
            wind: { speed: 13 },
            dt: 1_762_000_000,
            sys: {
              sunrise: 1_761_980_000,
              sunset: 1_762_040_000,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ list: [{ main: { aqi } }] }),
        });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');
    const snapshots = [];
    for (const aqi of [2, 3, 4, 5, 9]) {
      snapshots.push(await service.getOpenWeatherMapSnapshot({
        label: `Wichita Mountains ${aqi}`,
        latitude: 34.745,
        longitude: -98.532,
      }));
    }

    expect(snapshots.map((snapshot) => snapshot.airQuality?.label)).toEqual([
      'Fair',
      'Moderate',
      'Poor',
      'Very Poor',
      undefined,
    ]);
    expect(snapshots.every((snapshot) => snapshot.isDaytime === true)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it('falls back from blocked OpenWeatherMap keys to Open-Meteo route weather', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ message: 'rate limited' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            time: '2026-05-19 14:30',
            temperature_2m: 58,
            weather_code: 95,
            wind_speed_10m: 18,
            is_day: '0',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 315 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');
    const snapshot = await service.getOpenWeatherMapSnapshot({
      label: 'Storm Stop',
      latitude: 34.745,
      longitude: -98.532,
    });

    expect(snapshot).toMatchObject({
      label: 'Storm Stop',
      provider: 'openmeteo',
      condition: 'Thunderstorms',
      temperatureF: 58,
      windMph: 18,
      conditionCode: 95,
      isDaytime: false,
      airQuality: {
        index: 315,
        label: 'Hazardous',
        scale: 'us',
      },
    });
    expect(snapshot.observedAtIso).toBe('2026-05-19T19:30:00.000Z');
  });

  it('continues across failed OpenWeatherMap labels and keeps provider air quality optional', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: 'provider hiccup' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'Austin',
          coord: { lat: 30.2672, lon: -97.7431 },
          main: { temp: 72 },
          weather: [{ id: 501, description: 'light rain', icon: '10n' }],
          wind: { speed: 6 },
          dt: 1_779_231_600,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ list: [{ main: { aqi: 1 } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');
    const snapshot = await service.getOpenWeatherMapSnapshot({
      label: 'Dinner stop, Austin, Texas',
      searchLabels: ['Dinner stop, Austin, Texas', 'Austin, Texas'],
    });

    const weatherUrls = fetchMock.mock.calls.slice(0, 2).map(([url]) => new URL(String(url)));
    expect(weatherUrls[0]?.searchParams.get('q')).toBe('Dinner stop, Austin, Texas');
    expect(weatherUrls[1]?.searchParams.get('q')).toBe('Austin, Texas');
    expect(snapshot).toMatchObject({
      label: 'Dinner stop, Austin, Texas',
      provider: 'openweather',
      condition: 'Light Rain',
      conditionCode: 501,
      iconCode: '10n',
      isDaytime: false,
    });
    expect(snapshot.airQuality).toBeUndefined();
  });

  it('throws when Open-Meteo fallback responses are missing current weather values', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');

    await expect(service.getOpenWeatherMapSnapshot({
      label: 'Forecast Gap',
      latitude: 34.745,
      longitude: -98.532,
    })).rejects.toThrow('Weather is unavailable right now.');
  });

  it('geocodes label-only Open-Meteo weather requests through alternate route labels', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          results: [{
            name: 'Austin',
            admin1: 'Texas',
            country: 'United States',
            latitude: 30.2672,
            longitude: -97.7431,
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            time: 1_779_231_600,
            temperature_2m: 82,
            weather_code: 61,
            wind_speed_10m: 9,
            is_day: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 128 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');
    const snapshot = await service.getOpenWeatherMapSnapshot({
      label: 'Dinner stop, Austin, Texas',
      searchLabels: ['Austin, TX', 'Austin'],
    });

    const geocodeUrls = fetchMock.mock.calls.slice(0, 2).map(([url]) => new URL(String(url)));
    expect(geocodeUrls[0]?.searchParams.get('name')).toBe('Dinner stop, Austin, Texas');
    expect(geocodeUrls[1]?.searchParams.get('name')).toBe('Austin, TX');
    expect(snapshot).toMatchObject({
      label: 'Dinner stop, Austin, Texas',
      provider: 'openmeteo',
      condition: 'Rain',
      airQuality: {
        index: 128,
        label: 'Sensitive',
        scale: 'us',
      },
    });
    expect(snapshot.observedAtIso).toBe('2026-05-19T23:00:00.000Z');
  });

  it('labels additional Open-Meteo weather and US air quality bands used on route cards', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('backend weather unavailable'));
    const fetchMock = vi.fn();
    [
      { code: 0, aqi: 85, condition: 'Clear', air: 'Moderate' },
      { code: 45, aqi: 180, condition: 'Fog', air: 'Unhealthy' },
      { code: 71, aqi: 260, condition: 'Snow', air: 'Very Unhealthy' },
      { code: 999, aqi: -1, condition: 'Current Conditions', air: undefined },
    ].forEach(({ code, aqi }) => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            current: {
              time: 1_779_231_600,
              temperature_2m: 65,
              weather_code: code,
              wind_speed_10m: 7,
              is_day: 1,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            current: { us_aqi: aqi },
          }),
        });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('@/services/openWeatherMapService');
    const scenarios = [
      { code: 0, aqi: 85, condition: 'Clear', air: 'Moderate' },
      { code: 45, aqi: 180, condition: 'Fog', air: 'Unhealthy' },
      { code: 71, aqi: 260, condition: 'Snow', air: 'Very Unhealthy' },
      { code: 999, aqi: -1, condition: 'Current Conditions', air: undefined },
    ];
    const snapshots = [];
    for (const { code } of scenarios) {
      snapshots.push(await service.getOpenWeatherMapSnapshot({
        label: `Route weather ${code}`,
        latitude: 32.7 + (code / 1000),
        longitude: -97.3,
      }));
    }

    expect(snapshots.map((snapshot) => snapshot.condition)).toEqual([
      'Clear',
      'Fog',
      'Snow',
      'Current Conditions',
    ]);
    expect(snapshots.map((snapshot) => snapshot.airQuality?.label)).toEqual([
      'Moderate',
      'Unhealthy',
      'Very Unhealthy',
      undefined,
    ]);
  });

  it('returns explicit backend weather metadata and unavailable fuel fallbacks', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: {
            label: 'Backend Dallas',
            latitude: 32.7767,
            longitude: -96.797,
            temperatureF: 74,
            condition: 'clear sky',
            windMph: 11,
            provider: 'nws',
            providerLabel: 'National Weather Service',
            observedAtIso: '2026-05-20T12:00:00.000Z',
            checkedAtIso: '2026-05-20T12:02:00.000Z',
            freshnessSeconds: 120,
            isStale: false,
            weatherCode: 800,
            iconCode: '01d',
            isDaytime: true,
          },
        },
      })
      .mockRejectedValueOnce(new Error('fuel endpoint unavailable'));

    const weatherService = await import('@/services/openWeatherMapService');
    await expect(weatherService.getOpenWeatherMapSnapshot({
      label: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
    })).resolves.toMatchObject({
      id: 'Dallas:32.7767:-96.797',
      label: 'Dallas',
      provider: 'nws',
      providerLabel: 'National Weather Service',
      condition: 'Clear Sky',
      temperatureF: 74,
      windMph: 11,
      observedAtIso: '2026-05-20T12:00:00.000Z',
      checkedAtIso: '2026-05-20T12:02:00.000Z',
      freshnessSeconds: 120,
      isStale: false,
      conditionCode: 800,
      iconCode: '01d',
      isDaytime: true,
    });

    const fuelService = await import('@/services/fuelPriceService');
    await expect(fuelService.getNearbyFuelStations({
      latitude: 31.5,
      longitude: -97.1,
      radiusKm: 8,
      fuelType: 'diesel',
      limit: 4,
      sortBy: 'closest',
    })).resolves.toMatchObject({
      configured: false,
      coverage: 'Google Places fuel lookup is unavailable right now.',
      source: 'Google Places',
      license: 'Google Maps Platform',
      radiusKm: 8,
      sortBy: 'closest',
      stations: [],
    });
  });
});
