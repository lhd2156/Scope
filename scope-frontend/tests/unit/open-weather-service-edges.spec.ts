const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
  getAccessToken: vi.fn().mockReturnValue(''),
}));

vi.mock('@/services/demoMode', () => ({
  DEMO_MODE_ENABLED: false,
  localFallbackEnabled: vi.fn().mockReturnValue(false),
}));

describe('OpenWeather service edge contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    apiMock.get.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes sparse backend and local snapshots with stable labels', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;

    expect(coverage.normalizeBackendWeatherSnapshot(
      { label: '', latitude: 32.75, longitude: -97.33 },
      {
        label: '',
        temperatureF: 72,
        windMph: 8,
        condition: '',
      },
    )).toEqual(expect.objectContaining({
      id: 'Route point:32.75:-97.33',
      label: 'Route point',
      condition: 'Current conditions',
      provider: 'openmeteo',
      providerLabel: 'Scope weather',
    }));

    expect(coverage.normalizeBackendWeatherSnapshot(
      { label: '' },
      {
        label: ' Backend point ',
        latitude: 30.2,
        longitude: -97.7,
        temperatureF: 80,
        windMph: 4,
        condition: 'clear sky',
        provider: 'nws',
        isStale: false,
        airQuality: { index: 42, label: 'Good', scale: 'us' },
      },
    )).toEqual(expect.objectContaining({
      label: 'Backend point',
      provider: 'nws',
      isStale: false,
      airQuality: { index: 42, label: 'Good', scale: 'us' },
    }));
    expect(coverage.normalizeBackendWeatherSnapshot(
      { label: '' },
      {
        temperatureF: 68,
        windMph: 3,
        condition: 'clear',
      },
    ).id).toBe('Route point::');

    expect(coverage.buildLocalWeatherSnapshot({
      label: '',
    })).toEqual(expect.objectContaining({
      label: 'Map preview',
      provider: 'local',
      isDaytime: true,
    }));
  });

  it('maps weather, air-quality, icon, daytime, and timestamp variants', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;

    expect([1, 2, 3, 4, 5, 6].map(coverage.getOpenWeatherAirQualityLabel)).toEqual([
      'Good',
      'Fair',
      'Moderate',
      'Poor',
      'Very Poor',
      'Unknown',
    ]);
    expect([25, 75, 125, 175, 250, 350].map(coverage.getUsAirQualityLabel)).toEqual([
      'Good',
      'Moderate',
      'Sensitive',
      'Unhealthy',
      'Very Unhealthy',
      'Hazardous',
    ]);
    expect(coverage.normalizeOpenWeatherAirQuality('bad')).toBeNull();
    expect(coverage.normalizeOpenWeatherAirQuality(6)).toBeNull();
    expect(coverage.normalizeOpenWeatherAirQuality(2.4)).toEqual({
      index: 2,
      label: 'Fair',
      scale: 'openweather',
    });
    expect(coverage.normalizeUsAirQuality(-1)).toBeNull();
    expect(coverage.normalizeUsAirQuality(42.4)).toEqual({
      index: 42,
      label: 'Good',
      scale: 'us',
    });

    expect([0, 2, 45, 61, 71, 95, 999].map(coverage.getOpenMeteoCondition)).toEqual([
      'Clear',
      'Partly Cloudy',
      'Fog',
      'Rain',
      'Snow',
      'Thunderstorms',
      'Current Conditions',
    ]);
    expect(coverage.normalizeIconCode(' 01D ')).toBe('01d');
    expect(coverage.normalizeIconCode(' ')).toBeNull();
    expect([
      true,
      false,
      1,
      '1',
      0,
      '0',
      'bad',
    ].map(coverage.normalizeIsDaytime)).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
      null,
    ]);

    expect(coverage.normalizeIsoDateTime('2026-06-01 12:00:00')).toBe(
      new Date('2026-06-01T12:00:00').toISOString(),
    );
    expect(coverage.normalizeIsoDateTime('2026-06-01T12:00:00Z')).toBe('2026-06-01T12:00:00.000Z');
    expect(coverage.normalizeIsoDateTime('not-a-date')).toBeNull();
    expect(coverage.normalizeIsoDateTime('')).toBeNull();
    expect(coverage.normalizeUnixTimestampIso('bad')).toBeNull();
    expect(coverage.normalizeUnixTimestampIso(1e308)).toBeNull();

    expect(coverage.resolveOpenWeatherIsDaytime({
      weather: [{ icon: '01d' }],
    })).toBe(true);
    expect(coverage.resolveOpenWeatherIsDaytime({
      weather: [{ icon: '01n' }],
    })).toBe(false);
    expect(coverage.resolveOpenWeatherIsDaytime({
      dt: 150,
      sys: { sunrise: 100, sunset: 200 },
    })).toBe(true);
    expect(coverage.resolveOpenWeatherIsDaytime({
      dt: 250,
      sys: { sunrise: 100, sunset: 200 },
    })).toBe(false);
    expect(coverage.resolveOpenWeatherIsDaytime({})).toBeNull();
  });

  it('deduplicates search labels and builds coordinate or query provider URLs', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;

    expect(coverage.uniqueLabels([' Austin ', 'austin', '', 'Texas'])).toEqual(['Austin', 'Texas']);
    expect(coverage.buildDerivedSearchLabels('Austin')).toEqual([]);
    expect(coverage.buildDerivedSearchLabels('Dinner stop, Austin, Texas')).toEqual([
      'Austin, Texas',
      'Texas',
      'Dinner stop',
    ]);
    expect(coverage.buildSearchLabels({
      label: 'Dinner stop, Austin, Texas',
      searchLabels: ['Austin', 'austin'],
    })).toEqual([
      'Dinner stop, Austin, Texas',
      'Austin',
      'Austin, Texas',
      'Texas',
      'Dinner stop',
    ]);

    const coordinateUrl = coverage.buildWeatherUrl({
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    }, 'key', 'ignored');
    expect(coordinateUrl.searchParams.get('lat')).toBe('30.2672');
    expect(coordinateUrl.searchParams.get('q')).toBeNull();

    const queryUrl = coverage.buildWeatherUrl({
      label: 'Austin',
    }, 'key', 'Austin, Texas');
    expect(queryUrl.searchParams.get('q')).toBe('Austin, Texas');
  });

  it('returns null or throws cleanly when provider JSON is malformed', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;
    const rejectedJsonResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rejectedJsonResponse));

    await expect(coverage.getOpenWeatherAirQualitySnapshot({
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    }, 'key')).resolves.toBeNull();
    await expect(coverage.getOpenMeteoAirQualitySnapshot({
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    })).resolves.toBeNull();
    await expect(coverage.resolveOpenMeteoPoint({
      label: 'Unknown place',
    })).rejects.toThrow('Weather is unavailable right now.');
    await expect(coverage.getOpenMeteoSnapshot({
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    })).rejects.toThrow('Weather is unavailable right now.');
  });

  it('keeps route weather usable when geocoder names or air-quality calls fail', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [{
            name: '',
            admin1: '',
            country: '',
            latitude: 30.2672,
            longitude: -97.7431,
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          current: {
            time: 1_780_000_000,
            temperature_2m: 74,
            wind_speed_10m: 7,
            weather_code: 0,
            is_day: 1,
          },
        }),
      })
      .mockRejectedValueOnce(new Error('air quality offline'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(coverage.resolveOpenMeteoPoint({
      label: 'Original route label',
    })).resolves.toEqual({
      label: 'Original route label',
      latitude: 30.2672,
      longitude: -97.7431,
    });

    const snapshot = await coverage.getOpenMeteoSnapshot({
      label: '',
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(snapshot).toMatchObject({
      label: 'Route point',
      provider: 'openmeteo',
    });
    expect(snapshot).not.toHaveProperty('airQuality');
  });

  it('rejects missing Open-Meteo locations and unusable air-quality coordinates', async () => {
    const { __openWeatherMapServiceCoverage } = await import('@/services/openWeatherMapService');
    const coverage = __openWeatherMapServiceCoverage!;

    await expect(coverage.getBackendCurrentWeatherSnapshot({ label: '' })).rejects.toThrow(
      'Weather location is missing.',
    );
    await expect(coverage.resolveOpenMeteoPoint({ label: '' })).rejects.toThrow('Weather location is missing.');
    await expect(coverage.getOpenWeatherAirQualitySnapshot({
      label: 'Missing coordinates',
    }, 'key')).resolves.toBeNull();
    expect(coverage.hasCoordinatePair(91, -97)).toBe(false);
    expect(coverage.hasCoordinatePair(30, -181)).toBe(false);
  });
});
