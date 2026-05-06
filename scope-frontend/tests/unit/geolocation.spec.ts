import { GEOLOCATION_OPTIONS, isGeolocationSupported, startLocationWatch, stopLocationWatch } from '@/utils/geolocation';

describe('geolocation utility', () => {
  const watchPosition = vi.fn();
  const clearWatch = vi.fn();

  beforeEach(() => {
    watchPosition.mockReset();
    clearWatch.mockReset();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition,
        clearWatch,
      },
    });
  });

  it('starts a watch and maps coordinates into the app model', () => {
    let successHandler: PositionCallback | undefined;
    watchPosition.mockImplementation((success: PositionCallback) => {
      successHandler = success;
      return 42;
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const watchId = startLocationWatch(onSuccess, onError);

    const position = {
      coords: {
        latitude: 32.7555,
        longitude: -97.3308,
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

    successHandler?.(position);

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
});
