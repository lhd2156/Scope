import type { RouteCoordinate } from '@/services/roadRouteService';
import type { MapPoint, MapViewport } from '@/types';

export interface FallbackProjection {
  x: number;
  y: number;
}

export interface FallbackProjectionBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

export const FALLBACK_VIEWPORT = {
  width: 1200,
  height: 900,
};

export const FALLBACK_COORDINATE_PADDING_RATIO = 0.16;
export const FALLBACK_MIN_COORDINATE_RANGE = 0.18;

const FALLBACK_MARKER_CLEARANCE = 88;
const FALLBACK_MARKER_PADDING = 26;
const FALLBACK_HORIZONTAL_PADDING = 120;
const FALLBACK_VERTICAL_PADDING = 112;
const FALLBACK_MARKER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 56, y: -24 },
  { x: -56, y: -24 },
  { x: 0, y: 56 },
  { x: 72, y: 24 },
  { x: -72, y: 24 },
  { x: 32, y: -72 },
  { x: -32, y: -72 },
  { x: 88, y: 0 },
  { x: -88, y: 0 },
  { x: 0, y: -96 },
  { x: 0, y: 96 },
] as const;
const FALLBACK_DYNAMIC_OFFSET_START_RADIUS = 128;
const FALLBACK_DYNAMIC_OFFSET_RING_GAP = 48;

function clampFallbackNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function buildFallbackViewportBounds(
  viewport: MapViewport,
  minZoom: number,
  maxZoom: number,
): FallbackProjectionBounds {
  const [centerLongitude, centerLatitude] = viewport.center;
  const zoom = clampFallbackNumber(viewport.zoom, minZoom, maxZoom);
  const longitudeSpan = clampFallbackNumber(38 / 2 ** (zoom - 3), 0.08, 150);
  const latitudeSpan = clampFallbackNumber(longitudeSpan * 0.62, 0.06, 72);

  return {
    minLongitude: centerLongitude - longitudeSpan / 2,
    maxLongitude: centerLongitude + longitudeSpan / 2,
    minLatitude: centerLatitude - latitudeSpan / 2,
    maxLatitude: centerLatitude + latitudeSpan / 2,
  };
}

export function projectFallbackPoint(point: MapPoint, projectionBounds: FallbackProjectionBounds): FallbackProjection {
  return projectFallbackCoordinate([point.longitude, point.latitude], projectionBounds);
}

export function projectFallbackCoordinate(coordinate: RouteCoordinate, projectionBounds: FallbackProjectionBounds): FallbackProjection {
  const longitudeRange = Math.max(projectionBounds.maxLongitude - projectionBounds.minLongitude, FALLBACK_MIN_COORDINATE_RANGE);
  const latitudeRange = Math.max(projectionBounds.maxLatitude - projectionBounds.minLatitude, FALLBACK_MIN_COORDINATE_RANGE);
  const usableWidth = FALLBACK_VIEWPORT.width - FALLBACK_HORIZONTAL_PADDING * 2;
  const usableHeight = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING * 2;
  const [longitude, latitude] = coordinate;
  const x = FALLBACK_HORIZONTAL_PADDING + (((longitude - projectionBounds.minLongitude) / longitudeRange) * usableWidth);
  const y = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING - (((latitude - projectionBounds.minLatitude) / latitudeRange) * usableHeight);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

export function unprojectFallbackCoordinate(point: FallbackProjection, projectionBounds: FallbackProjectionBounds): RouteCoordinate {
  const longitudeRange = Math.max(projectionBounds.maxLongitude - projectionBounds.minLongitude, FALLBACK_MIN_COORDINATE_RANGE);
  const latitudeRange = Math.max(projectionBounds.maxLatitude - projectionBounds.minLatitude, FALLBACK_MIN_COORDINATE_RANGE);
  const usableWidth = FALLBACK_VIEWPORT.width - FALLBACK_HORIZONTAL_PADDING * 2;
  const usableHeight = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING * 2;
  const normalizedX = clampFallbackNumber((point.x - FALLBACK_HORIZONTAL_PADDING) / usableWidth, 0, 1);
  const normalizedY = clampFallbackNumber((FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING - point.y) / usableHeight, 0, 1);
  const longitude = projectionBounds.minLongitude + normalizedX * longitudeRange;
  const latitude = projectionBounds.minLatitude + normalizedY * latitudeRange;

  return [longitude, latitude];
}

export function distanceBetweenFallbackPoints(firstPoint: FallbackProjection, secondPoint: FallbackProjection): number {
  return Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
}

export function resolveFallbackProjection(baseProjection: FallbackProjection, placedProjections: FallbackProjection[]): FallbackProjection {
  for (const offset of getFallbackMarkerOffsetCandidates(placedProjections.length)) {
    const candidateProjection = {
      x: clampFallbackNumber(baseProjection.x + offset.x, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.width - FALLBACK_MARKER_PADDING),
      y: clampFallbackNumber(baseProjection.y + offset.y, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.height - FALLBACK_MARKER_PADDING),
    };

    if (placedProjections.every((placedProjection) => distanceBetweenFallbackPoints(candidateProjection, placedProjection) >= FALLBACK_MARKER_CLEARANCE)) {
      return candidateProjection;
    }
  }

  return {
    x: clampFallbackNumber(baseProjection.x, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.width - FALLBACK_MARKER_PADDING),
    y: clampFallbackNumber(baseProjection.y, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.height - FALLBACK_MARKER_PADDING),
  };
}

export function getFallbackMarkerOffsetCandidates(placedCount: number): Array<{ x: number; y: number }> {
  const dynamicOffsets: Array<{ x: number; y: number }> = [];
  const ringCount = Math.ceil(Math.max(placedCount - FALLBACK_MARKER_OFFSETS.length, 0) / 8) + 3;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const radius = FALLBACK_DYNAMIC_OFFSET_START_RADIUS + ring * FALLBACK_DYNAMIC_OFFSET_RING_GAP;
    const steps = 8 + ring * 4;
    const phase = ring % 2 === 0 ? Math.PI / 8 : 0;

    for (let step = 0; step < steps; step += 1) {
      const angle = phase + (step / steps) * Math.PI * 2;
      dynamicOffsets.push({
        x: Number((Math.cos(angle) * radius).toFixed(2)),
        y: Number((Math.sin(angle) * radius).toFixed(2)),
      });
    }
  }

  return [...FALLBACK_MARKER_OFFSETS, ...dynamicOffsets];
}
