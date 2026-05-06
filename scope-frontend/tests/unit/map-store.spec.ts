import { createPinia, setActivePinia } from 'pinia';
import { useMapStore } from '@/stores/map';

describe('map store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('clamps zoom levels and preserves the final active category', () => {
    const mapStore = useMapStore();

    mapStore.setZoom(40);
    expect(mapStore.viewport.zoom).toBe(18);

    mapStore.setZoom(1);
    expect(mapStore.viewport.zoom).toBe(2);

    mapStore.activeCategories = ['food'];
    mapStore.toggleCategory('food');
    expect(mapStore.activeCategories).toEqual(['food']);
  });

  it('tracks when visible pin ids have been measured so zero is meaningful', () => {
    const mapStore = useMapStore();

    expect(mapStore.visibleSpotIdsMeasured).toBe(false);

    mapStore.setVisibleSpotIds([]);

    expect(mapStore.visibleSpotIds).toEqual([]);
    expect(mapStore.visibleSpotIdsMeasured).toBe(true);
  });

  it('sets a shared category subset and falls back to all categories for empty selections', () => {
    const mapStore = useMapStore();

    mapStore.setActiveCategories(['culture', 'food', 'culture']);

    expect(mapStore.activeCategories).toEqual(['food', 'culture']);

    mapStore.setActiveCategories([]);

    expect(mapStore.activeCategories).toEqual([
      'food',
      'nature',
      'nightlife',
      'culture',
      'adventure',
      'shopping',
      'scenic',
      'other',
    ]);
  });

  it('can reset visible pin ids before a fresh map measurement', () => {
    const mapStore = useMapStore();

    mapStore.setVisibleSpotIds(['spot-1', 'spot-2']);
    mapStore.resetVisibleSpotIds();

    expect(mapStore.visibleSpotIds).toEqual([]);
    expect(mapStore.visibleSpotIdsMeasured).toBe(false);
  });

  it('can reset the viewport after map navigation', () => {
    const mapStore = useMapStore();

    mapStore.setCenter([-80, 40]);
    mapStore.setZoom(14);
    mapStore.resetViewport();

    expect(mapStore.viewport.center).toEqual([-98.5795, 39.8283]);
    expect(mapStore.viewport.zoom).toBe(3.25);
  });
});
