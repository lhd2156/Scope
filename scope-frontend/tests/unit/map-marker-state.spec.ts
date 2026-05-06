import {
  getPinCountRepresentedByViewportMarkers,
  getSpotIdsRepresentedByViewportMarkers,
  getSpotIdsRepresentedByVisibleViewportMarkers,
  getViewportMarkerSignature,
  planViewportMarkerReconciliation,
  type MarkerRenderContext,
  type ViewportMarkerModel,
} from '@/components/map/mapMarkerState';
import type { MapPoint } from '@/types';

function createSpot(id: string, latitude: number, longitude: number): MapPoint {
  return {
    id,
    title: `Spot ${id}`,
    latitude,
    longitude,
    category: 'food',
    city: 'Fort Worth',
    rating: 4.7,
    photoUrl: `https://example.com/${id}.jpg`,
  };
}

function createExistingMarkers(
  markers: ViewportMarkerModel[],
  context: MarkerRenderContext,
) {
  return new Map(
    markers.map((marker) => [marker.id, {
      kind: marker.kind,
      signature: getViewportMarkerSignature(marker, context),
    }] as const),
  );
}

describe('mapMarkerState', () => {
  it('updates only the markers whose selected state changed', () => {
    const markers: ViewportMarkerModel[] = [
      {
        kind: 'spot',
        id: 'spot-1',
        spot: createSpot('spot-1', 32.7555, -97.3308),
        distanceLabel: '0.6 mi away',
      },
      {
        kind: 'spot',
        id: 'spot-2',
        spot: createSpot('spot-2', 32.7426, -97.3637),
        distanceLabel: '1.1 mi away',
      },
      {
        kind: 'spot',
        id: 'spot-3',
        spot: createSpot('spot-3', 32.7831, -96.7822),
        distanceLabel: '3.4 mi away',
      },
    ];
    const previousContext: MarkerRenderContext = {
      markerVariant: 'default',
      routeOrderLookup: new Map(),
      selectedSpotId: 'spot-1',
    };
    const nextContext: MarkerRenderContext = {
      ...previousContext,
      selectedSpotId: 'spot-2',
    };

    const plan = planViewportMarkerReconciliation(
      createExistingMarkers(markers, previousContext),
      markers,
      nextContext,
    );

    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.update.map((marker) => marker.id)).toEqual(['spot-1', 'spot-2']);
  });

  it('recreates a marker when its runtime kind changes for the same id', () => {
    const previousMarkers: ViewportMarkerModel[] = [
      {
        kind: 'spot',
        id: 'shared-id',
        spot: createSpot('shared-id', 32.7555, -97.3308),
        distanceLabel: null,
      },
    ];
    const nextMarkers: ViewportMarkerModel[] = [
      {
        kind: 'cluster',
        id: 'shared-id',
        latitude: 32.75,
        longitude: -97.33,
        pointCount: 4,
        pointIds: ['spot-1', 'spot-2', 'spot-3', 'spot-4'],
      },
    ];
    const context: MarkerRenderContext = {
      markerVariant: 'default',
      routeOrderLookup: new Map(),
      selectedSpotId: null,
    };

    const plan = planViewportMarkerReconciliation(
      createExistingMarkers(previousMarkers, context),
      nextMarkers,
      context,
    );

    expect(plan.remove).toEqual(['shared-id']);
    expect(plan.create).toEqual(nextMarkers);
    expect(plan.update).toEqual([]);
  });

  it('counts only spot ids represented by marker groups visible on the canvas', () => {
    const visibleMarkers: ViewportMarkerModel[] = [
      {
        kind: 'spot',
        id: 'spot-visible',
        spot: createSpot('spot-visible', 32.7555, -97.3308),
        distanceLabel: null,
      },
      {
        kind: 'cluster',
        id: 'cluster-visible',
        latitude: 32.75,
        longitude: -97.33,
        pointCount: 2,
        pointIds: ['cluster-spot-1', 'cluster-spot-2'],
      },
      {
        kind: 'spot',
        id: 'spot-offscreen',
        spot: createSpot('spot-offscreen', 32.7426, -97.3637),
        distanceLabel: null,
      },
    ];
    const projectedMarkers = new Map([
      ['spot-visible', { x: 48, y: 60 }],
      ['cluster-visible', { x: 88, y: 24 }],
      ['spot-offscreen', { x: 220, y: 60 }],
    ]);

    expect(getSpotIdsRepresentedByVisibleViewportMarkers(
      visibleMarkers,
      { width: 100, height: 100 },
      (marker) => projectedMarkers.get(marker.id) ?? { x: 0, y: 0 },
    )).toEqual(['spot-visible', 'cluster-spot-1', 'cluster-spot-2']);
  });

  it('keeps edge-grazing markers visible when a viewport buffer is supplied', () => {
    const markers: ViewportMarkerModel[] = [
      {
        kind: 'spot',
        id: 'spot-edge',
        spot: createSpot('spot-edge', 32.7555, -97.3308),
        distanceLabel: null,
      },
    ];

    expect(getSpotIdsRepresentedByVisibleViewportMarkers(
      markers,
      { width: 100, height: 100 },
      () => ({ x: 112, y: 48 }),
    )).toEqual([]);

    expect(getSpotIdsRepresentedByVisibleViewportMarkers(
      markers,
      { width: 100, height: 100 },
      () => ({ x: 112, y: 48 }),
      24,
    )).toEqual(['spot-edge']);
  });

  it('deduplicates every spot represented by rendered markers for visibility fallbacks', () => {
    const markers: ViewportMarkerModel[] = [
      {
        kind: 'spot',
        id: 'spot-a',
        spot: createSpot('spot-a', 32.7555, -97.3308),
        distanceLabel: null,
      },
      {
        kind: 'cluster',
        id: 'cluster-a',
        latitude: 32.75,
        longitude: -97.33,
        pointCount: 3,
        pointIds: ['spot-b', 'spot-c', 'spot-a'],
      },
    ];

    expect(getSpotIdsRepresentedByViewportMarkers(markers)).toEqual(['spot-a', 'spot-b', 'spot-c']);
  });

  it('counts rendered cluster pins even when a runtime omits cluster member ids', () => {
    const markers: ViewportMarkerModel[] = [
      {
        kind: 'cluster',
        id: 'cluster-a',
        latitude: 32.75,
        longitude: -97.33,
        pointCount: 3,
        pointIds: [],
      },
      {
        kind: 'cluster',
        id: 'cluster-b',
        latitude: 32.78,
        longitude: -96.8,
        pointCount: 2,
        pointIds: [],
      },
    ];

    expect(getPinCountRepresentedByViewportMarkers(markers)).toBe(5);
  });

  it('uses the cluster point count when only part of the member id list is available', () => {
    const markers: ViewportMarkerModel[] = [
      {
        kind: 'cluster',
        id: 'cluster-a',
        latitude: 32.75,
        longitude: -97.33,
        pointCount: 3,
        pointIds: ['spot-a'],
      },
    ];

    expect(getPinCountRepresentedByViewportMarkers(markers)).toBe(3);
  });
});
