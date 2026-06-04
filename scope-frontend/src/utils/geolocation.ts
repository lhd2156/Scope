import type { UserLocation } from '@/types';

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 12_000,
};

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
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(mapGeolocationPosition(position)),
      reject,
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
