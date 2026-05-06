import type { MapPoint } from '@/types';

export interface ViewportPixelSize {
  width: number;
  height: number;
}

export interface ProjectedViewportPoint {
  x: number;
  y: number;
}

export function isProjectedPointInsideViewport(
  point: ProjectedViewportPoint,
  viewport: ViewportPixelSize,
  bufferPx = 0,
): boolean {
  if (
    viewport.width <= 0
    || viewport.height <= 0
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
  ) {
    return false;
  }

  const buffer = Math.max(bufferPx, 0);
  return (
    point.x >= -buffer
    && point.x <= viewport.width + buffer
    && point.y >= -buffer
    && point.y <= viewport.height + buffer
  );
}

export function getMapPointsInsideViewport(
  points: MapPoint[],
  viewport: ViewportPixelSize,
  projectPoint: (point: MapPoint) => ProjectedViewportPoint,
  bufferPx = 0,
): MapPoint[] {
  return points.filter((point) => isProjectedPointInsideViewport(projectPoint(point), viewport, bufferPx));
}
