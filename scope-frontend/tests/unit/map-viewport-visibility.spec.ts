import {
  getMapPointsInsideViewport,
  isProjectedPointInsideViewport,
} from '@/components/map/mapViewportVisibility';
import type { MapPoint } from '@/types';

function createPoint(id: string): MapPoint {
  return {
    id,
    title: `Spot ${id}`,
    latitude: 32,
    longitude: -97,
    category: 'food',
    city: 'Fort Worth',
    rating: 4.7,
  };
}

describe('mapViewportVisibility', () => {
  it('keeps the strict viewport count separate from buffered marker rendering', () => {
    const viewport = { width: 100, height: 100 };

    expect(isProjectedPointInsideViewport({ x: 50, y: 50 }, viewport)).toBe(true);
    expect(isProjectedPointInsideViewport({ x: -12, y: 50 }, viewport)).toBe(false);
    expect(isProjectedPointInsideViewport({ x: -12, y: 50 }, viewport, 16)).toBe(true);
  });

  it('returns only points whose projected coordinate is actually inside the canvas', () => {
    const points = [createPoint('inside'), createPoint('left-buffer'), createPoint('below')];
    const projected = new Map([
      ['inside', { x: 40, y: 60 }],
      ['left-buffer', { x: -20, y: 60 }],
      ['below', { x: 40, y: 140 }],
    ]);

    const strictPoints = getMapPointsInsideViewport(
      points,
      { width: 100, height: 100 },
      (point) => projected.get(point.id) ?? { x: 0, y: 0 },
    );
    const bufferedPoints = getMapPointsInsideViewport(
      points,
      { width: 100, height: 100 },
      (point) => projected.get(point.id) ?? { x: 0, y: 0 },
      48,
    );

    expect(strictPoints.map((point) => point.id)).toEqual(['inside']);
    expect(bufferedPoints.map((point) => point.id)).toEqual(['inside', 'left-buffer', 'below']);
  });
});
