import { mount } from '@vue/test-utils';
import RouteLayer from '@/components/map/RouteLayer.vue';
import type { MapPoint } from '@/types';

function createMapMock() {
  let hasSource = false;
  const layers = new Set<string>();
  const source = {
    setData: vi.fn(),
  };

  return {
    source,
    map: {
      isStyleLoaded: vi.fn(() => true),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id);
      }),
      removeLayer: vi.fn((id: string) => {
        layers.delete(id);
      }),
      getSource: vi.fn((id: string) => (id === 'atlas-route-source' && hasSource ? source : undefined)),
      addSource: vi.fn((_id: string, payload: unknown) => {
        hasSource = true;
        return payload;
      }),
      removeSource: vi.fn(() => {
        hasSource = false;
      }),
      on: vi.fn(),
      off: vi.fn(),
    },
  };
}

const routePoints: MapPoint[] = [
  { id: 'spot-1', title: 'Start', latitude: 32.7555, longitude: -97.3308, category: 'food' },
  { id: 'spot-2', title: 'End', latitude: 32.749, longitude: -97.363, category: 'nature' },
];

describe('RouteLayer', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--bg-primary', '#0f0f1a');
    document.documentElement.style.setProperty('--accent-gold', '#f59e0b');
  });

  it('adds the route source and layers for multi-point itineraries', () => {
    const { map } = createMapMock();

    mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
      },
    });

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(2);
    expect(map.on).toHaveBeenCalledWith('style.load', expect.any(Function));
  });

  it('removes the route when the itinerary no longer has at least two points', async () => {
    const { map } = createMapMock();

    const wrapper = mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
      },
    });

    await wrapper.setProps({ points: routePoints.slice(0, 1) });

    expect(map.removeLayer).toHaveBeenCalledWith('atlas-route-line');
    expect(map.removeLayer).toHaveBeenCalledWith('atlas-route-outline');
    expect(map.removeSource).toHaveBeenCalledWith('atlas-route-source');
  });
});
