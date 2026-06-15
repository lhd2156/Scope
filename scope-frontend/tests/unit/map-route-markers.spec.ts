import {
  buildRouteOrderLookup,
  getRouteMarkerSequence,
} from '@/components/map/mapRouteMarkers';
import type { MapPoint } from '@/types';

function mapPoint(id: string, routeRole?: MapPoint['routeRole'], routeLabel?: string): MapPoint {
  return {
    id,
    title: id,
    latitude: 32,
    longitude: -97,
    category: 'scenic',
    routeRole,
    routeLabel,
  };
}

describe('mapRouteMarkers', () => {
  it('resolves route marker labels without trusting stale stop labels', () => {
    expect(getRouteMarkerSequence(mapPoint('start', 'start', 'old'), 1)).toBe('S');
    expect(getRouteMarkerSequence(mapPoint('stop', 'stop', '9'), 2)).toBe(2);
    expect(getRouteMarkerSequence(mapPoint('end', 'end', 'old'), 3)).toBe('E');
    expect(getRouteMarkerSequence(mapPoint('pin', undefined, 'A'), 4)).toBe('A');
    expect(getRouteMarkerSequence(mapPoint('plain'), 5)).toBe(5);
  });

  it('builds a lookup from full route order', () => {
    const lookup = buildRouteOrderLookup([
      mapPoint('start', 'start'),
      mapPoint('middle', 'stop', '99'),
      mapPoint('end', 'end'),
    ]);

    expect(Object.fromEntries(lookup)).toEqual({
      start: 'S',
      middle: 2,
      end: 'E',
    });
  });
});
