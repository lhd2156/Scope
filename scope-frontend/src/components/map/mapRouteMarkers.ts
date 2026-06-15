import type { MapPoint } from '@/types';

export function getRouteMarkerSequence(point: MapPoint, routePosition: number): string | number {
  if (point.routeRole === 'start') {
    return 'S';
  }

  if (point.routeRole === 'end') {
    return 'E';
  }

  const customLabel = point.routeLabel?.trim();
  return point.routeRole ? routePosition : customLabel || routePosition;
}

export function buildRouteOrderLookup(routePoints: MapPoint[]): Map<string, string | number> {
  return new Map(
    routePoints.map((point, index) => [
      point.id,
      getRouteMarkerSequence(point, index + 1),
    ]),
  );
}
