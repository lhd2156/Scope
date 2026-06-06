import type { UserLocation } from '@/types';

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 12_000,
};

const GEOLOCATION_TIMEOUT_BUFFER_MS = 1_000;

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function mapGeolocationPosition(position: GeolocationPosition): UserLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
  };
}

export function startLocationWatch(
  onSuccess: (location: UserLocation) => void,
  onError: PositionErrorCallback,
  options: PositionOptions = GEOLOCATION_OPTIONS,
): number | null {
  if (!isGeolocationSupported()) {
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => onSuccess(mapGeolocationPosition(position)),
    onError,
    options,
  );
}

export function getCurrentLocation(options: PositionOptions = GEOLOCATION_OPTIONS): Promise<UserLocation> {
  if (!isGeolocationSupported()) {
    return Promise.reject(new Error('Geolocation is not supported by this browser.'));
  }

  return new Promise((resolve, reject) => {
    let isSettled = false;
    const timeoutMs = typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout + GEOLOCATION_TIMEOUT_BUFFER_MS
      : GEOLOCATION_OPTIONS.timeout + GEOLOCATION_TIMEOUT_BUFFER_MS;
    const fallbackTimer = setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      reject(Object.assign(new Error('Location request timed out.'), { code: 3 }));
    }, timeoutMs);
    const settle = <T>(handler: (value: T) => void, value: T) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(fallbackTimer);
      handler(value);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => settle(resolve, mapGeolocationPosition(position)),
      (error) => settle(reject, error),
      options,
    );
  });
}

export function stopLocationWatch(watchId: number | null): void {
  if (watchId === null || !isGeolocationSupported()) {
    return;
  }

  navigator.geolocation.clearWatch(watchId);
}
