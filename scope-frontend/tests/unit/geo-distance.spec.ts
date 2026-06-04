import { describe, expect, it } from 'vitest';

import { calculateHaversineDistanceKm, calculateHaversineDistanceMeters, degreesToRadians } from '@/utils/geoDistance';

describe('geoDistance', () => {
  it('converts degrees to radians', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
  });

  it('calculates kilometer distances with the frontend default earth radius', () => {
    const chicago = { latitude: 41.8781, longitude: -87.6298 };
    const newYork = { latitude: 40.7128, longitude: -74.006 };

    expect(calculateHaversineDistanceKm(chicago, newYork)).toBeCloseTo(1144.29, 1);
  });

  it('calculates meter distances with the route-service radius', () => {
    const start = { latitude: 0, longitude: 0 };
    const end = { latitude: 0, longitude: 1 };

    expect(calculateHaversineDistanceMeters(start, end)).toBeCloseTo(111195, 0);
  });
});
