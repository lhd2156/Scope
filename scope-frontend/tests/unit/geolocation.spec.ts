import {
  GEOLOCATION_OPTIONS,
  getCurrentLocation,
  isGeolocationSupported,
  mapGeolocationPosition,
  startLocationWatch,
  stopLocationWatch,
} from '@/utils/geolocation';

describe('geolocation utility', () => {
  const getCurrentPosition = vi.fn();
  const watchPosition = vi.fn();
  const clearWatch = vi.fn();

  beforeEach(() => {
    getCurrentPosition.mockReset();
    watchPosition.mockReset();
    clearWatch.mockReset();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition,
        watchPosition,
        clearWatch,
      },
    });
  });

  function buildPosition(latitude = 32.7555, longitude = -97.3308): GeolocationPosition {
    return {
      coords: {
        latitude,
        longitude,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1711500000,
      toJSON: () => ({}),
    } as GeolocationPosition;
  }

  it('starts a watch and maps coordinates into the app model', () => {
    let successHandler: PositionCallback | undefined;
    watchPosition.mockImplementation((success: PositionCallback) => {
      successHandler = success;
      return 42;
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const watchId = startLocationWatch(onSuccess, onError);

    successHandler?.(buildPosition());

    expect(isGeolocationSupported()).toBe(true);
    expect(watchId).toBe(42);
    expect(watchPosition).toHaveBeenCalledWith(expect.any(Function), onError, GEOLOCATION_OPTIONS);
    expect(onSuccess).toHaveBeenCalledWith({
      latitude: 32.7555,
      longitude: -97.3308,
      accuracy: 8,
      heading: null,
      speed: null,
      timestamp: 1711500000,
    });
  });

  it('clears an active watch id', () => {
    stopLocationWatch(42);
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('reads the current browser position without hardcoded coordinates', async () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success(buildPosition(51.5074, -0.1278));
    });

    await expect(getCurrentLocation()).resolves.toMatchObject({
      latitude: 51.5074,
      longitude: -0.1278,
      accuracy: 8,
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), GEOLOCATION_OPTIONS);
  });

  it('rejects if the browser never resolves the location prompt', async () => {
    vi.useFakeTimers();
    getCurrentPosition.mockImplementation(() => undefined);

    try {
      const locationPromise = getCurrentLocation();
      const timeoutExpectation = expect(locationPromise).rejects.toMatchObject({
        code: 3,
        message: 'Location request timed out.',
      });
      await vi.advanceTimersByTimeAsync((GEOLOCATION_OPTIONS.timeout ?? 12_000) + 1_000);

      await timeoutExpectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles unsupported geolocation without registering or clearing watches', async () => {
    delete (navigator as Navigator & { geolocation?: Geolocation }).geolocation;

    expect(isGeolocationSupported()).toBe(false);
    expect(startLocationWatch(vi.fn(), vi.fn())).toBeNull();
    await expect(getCurrentLocation()).rejects.toThrow('Geolocation is not supported');
    expect(() => stopLocationWatch(null)).not.toThrow();
    expect(() => stopLocationWatch(42)).not.toThrow();
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('maps optional heading and speed values directly from browser fixes', () => {
    const location = mapGeolocationPosition({
      ...buildPosition(40.7128, -74.006),
      coords: {
        ...buildPosition().coords,
        latitude: 40.7128,
        longitude: -74.006,
        heading: 180,
        speed: 12.5,
      },
    } as GeolocationPosition);

    expect(location).toMatchObject({
      latitude: 40.7128,
      longitude: -74.006,
      heading: 180,
      speed: 12.5,
    });
  });
});
