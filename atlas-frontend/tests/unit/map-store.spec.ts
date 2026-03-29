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
});
