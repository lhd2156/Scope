import type { MapPoint } from '@/types';
import {
  isProjectedPointInsideViewport,
  type ProjectedViewportPoint,
  type ViewportPixelSize,
} from '@/components/map/mapViewportVisibility';

export interface SpotMarkerModel {
  kind: 'spot';
  id: string;
  spot: MapPoint;
  distanceLabel: string | null;
}

export interface ClusterMarkerModel {
  kind: 'cluster';
  id: string;
  latitude: number;
  longitude: number;
  pointCount: number;
  pointIds: string[];
}

export type ViewportMarkerModel = SpotMarkerModel | ClusterMarkerModel;

export interface MarkerRenderContext {
  markerVariant: 'default' | 'sequence';
  routeOrderLookup: ReadonlyMap<string, string | number>;
  selectedSpotId?: string | null;
}

export interface MarkerDescriptor {
  kind: ViewportMarkerModel['kind'];
  signature: string;
}

export interface MarkerReconciliationPlan {
  create: ViewportMarkerModel[];
  update: ViewportMarkerModel[];
  remove: string[];
}

export function buildMapPointRenderKey(point: MapPoint): string {
  return [
    point.id,
    point.title,
    point.category,
    point.latitude.toFixed(6),
    point.longitude.toFixed(6),
    point.city ?? '',
    point.country ?? '',
    point.adminArea ?? '',
    point.province ?? '',
    point.region ?? '',
    point.state ?? '',
    point.stateCode ?? '',
    point.vibe ?? '',
    point.rating?.toFixed(2) ?? '',
    point.photoUrl ?? '',
    point.routeRole ?? '',
    point.routeLabel ?? '',
  ].join('|');
}

export function getViewportMarkerCoordinates(marker: ViewportMarkerModel): [number, number] {
  if (marker.kind === 'spot') {
    return [marker.spot.longitude, marker.spot.latitude];
  }

  return [marker.longitude, marker.latitude];
}

export function getViewportMarkerSpotIds(marker: ViewportMarkerModel): string[] {
  return marker.kind === 'spot' ? [marker.id] : marker.pointIds;
}

export function getSpotIdsRepresentedByViewportMarkers(markers: ViewportMarkerModel[]): string[] {
  return [...new Set(markers.flatMap(getViewportMarkerSpotIds))];
}

export function getPinCountRepresentedByViewportMarkers(markers: ViewportMarkerModel[]): number {
  const explicitSpotIds = new Set<string>();
  let countedAnonymousClusterPins = 0;

  markers.forEach((marker) => {
    if (marker.kind === 'spot') {
      explicitSpotIds.add(marker.id);
      return;
    }

    const uniqueClusterPointIds = [...new Set(marker.pointIds)];
    if (uniqueClusterPointIds.length) {
      uniqueClusterPointIds.forEach((spotId) => explicitSpotIds.add(spotId));
      countedAnonymousClusterPins += Math.max(marker.pointCount - uniqueClusterPointIds.length, 0);
      return;
    }

    countedAnonymousClusterPins += Math.max(marker.pointCount, 0);
  });

  return explicitSpotIds.size + countedAnonymousClusterPins;
}

export function getSpotIdsRepresentedByVisibleViewportMarkers(
  markers: ViewportMarkerModel[],
  viewport: ViewportPixelSize,
  projectMarker: (marker: ViewportMarkerModel) => ProjectedViewportPoint,
  bufferPx = 0,
): string[] {
  const visibleSpotIds: string[] = [];

  markers.forEach((marker) => {
    if (!isProjectedPointInsideViewport(projectMarker(marker), viewport, bufferPx)) {
      return;
    }

    visibleSpotIds.push(...getViewportMarkerSpotIds(marker));
  });

  return [...new Set(visibleSpotIds)];
}

export function getViewportMarkerSignature(
  marker: ViewportMarkerModel,
  context: MarkerRenderContext,
): string {
  if (marker.kind === 'cluster') {
    return [
      marker.kind,
      marker.id,
      marker.latitude.toFixed(6),
      marker.longitude.toFixed(6),
      marker.pointCount,
      marker.pointIds.join(','),
    ].join('|');
  }

  return [
    marker.kind,
    buildMapPointRenderKey(marker.spot),
    marker.distanceLabel ?? '',
    context.markerVariant,
    context.routeOrderLookup.get(marker.id) ?? '',
    context.selectedSpotId === marker.id ? 'active' : 'inactive',
  ].join('|');
}

export function getViewportMarkerZIndex(
  marker: ViewportMarkerModel,
  context: MarkerRenderContext,
): string {
  if (marker.kind === 'cluster') {
    return String(220 + Math.min(marker.pointCount, 99));
  }

  if (context.selectedSpotId === marker.id) {
    return '420';
  }

  if (context.routeOrderLookup.get(marker.id) !== undefined) {
    return '340';
  }

  return '260';
}

export function planViewportMarkerReconciliation(
  existingMarkers: ReadonlyMap<string, MarkerDescriptor>,
  nextMarkers: ViewportMarkerModel[],
  context: MarkerRenderContext,
): MarkerReconciliationPlan {
  const remove = new Set<string>();
  const create: ViewportMarkerModel[] = [];
  const update: ViewportMarkerModel[] = [];
  const nextIds = new Set(nextMarkers.map((marker) => marker.id));

  existingMarkers.forEach((_, markerId) => {
    if (!nextIds.has(markerId)) {
      remove.add(markerId);
    }
  });

  nextMarkers.forEach((marker) => {
    const existingMarker = existingMarkers.get(marker.id);
    if (!existingMarker) {
      create.push(marker);
      return;
    }

    if (existingMarker.kind !== marker.kind) {
      remove.add(marker.id);
      create.push(marker);
      return;
    }

    if (existingMarker.signature !== getViewportMarkerSignature(marker, context)) {
      update.push(marker);
    }
  });

  return {
    create,
    update,
    remove: [...remove],
  };
}
