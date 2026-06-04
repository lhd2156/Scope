import { mount } from '@vue/test-utils';
import RouteLayer from '@/components/map/RouteLayer.vue';
import type { MapPoint } from '@/types';

function createMapMock(initialStyleLoaded = true, initialLayers: string[] = []) {
  let hasSource = false;
  let styleLoaded = initialStyleLoaded;
  const layers = new Set<string>(initialLayers);
  const handlers = new Map<string, Array<() => void>>();
  const source = {
    setData: vi.fn(),
  };
  const emit = (eventName: string) => {
    handlers.get(eventName)?.forEach((handler) => handler());
  };

  return {
    emit,
    setStyleLoaded(nextStyleLoaded: boolean) {
      styleLoaded = nextStyleLoaded;
    },
    source,
    map: {
      isStyleLoaded: vi.fn(() => styleLoaded),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id);
      }),
      moveLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      removeLayer: vi.fn((id: string) => {
        layers.delete(id);
      }),
      getSource: vi.fn((id: string) => (id === 'scope-route-source' && hasSource ? source : undefined)),
      addSource: vi.fn((_id: string, payload: unknown) => {
        hasSource = true;
        return payload;
      }),
      removeSource: vi.fn(() => {
        hasSource = false;
      }),
      on: vi.fn((eventName: string, handler: () => void) => {
        handlers.set(eventName, [...(handlers.get(eventName) ?? []), handler]);
      }),
      off: vi.fn((eventName: string, handler: () => void) => {
        handlers.set(eventName, (handlers.get(eventName) ?? []).filter((registered) => registered !== handler));
      }),
    },
  };
}

const routePoints: MapPoint[] = [
  { id: 'spot-1', title: 'Start', latitude: 32.7555, longitude: -97.3308, category: 'food' },
  { id: 'spot-2', title: 'End', latitude: 32.749, longitude: -97.363, category: 'nature' },
];

describe('RouteLayer', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.setProperty('--bg-primary', '#0f0f1a');
    document.documentElement.style.setProperty('--accent-gold', '#f59e0b');
    document.documentElement.style.setProperty('--map-route-outline-light', '#061018');
    document.documentElement.style.setProperty('--map-route-outline-dark', '#ecfeff');
    document.documentElement.style.setProperty('--map-route-planner-light', '#08715f');
    document.documentElement.style.setProperty('--map-route-default-light', '#b45309');
    document.documentElement.style.setProperty('--map-route-planner-dark', '#2fffd6');
    document.documentElement.style.setProperty('--map-route-default-dark', '#fbbf24');
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
    expect(map.moveLayer).toHaveBeenCalledWith('scope-route-outline');
    expect(map.moveLayer).toHaveBeenCalledWith('scope-route-line');
  });

  it('prefers road geometry coordinates when the route resolver provides them', () => {
    const { map } = createMapMock();
    const roadGeometry: [number, number][] = [
      [-97.3308, 32.7555],
      [-97.342, 32.752],
      [-97.363, 32.749],
    ];

    mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
        coordinates: roadGeometry,
      },
    });

    expect(map.addSource).toHaveBeenCalledWith('scope-route-source', expect.objectContaining({
      data: expect.objectContaining({
        features: [
          expect.objectContaining({
            geometry: expect.objectContaining({
              coordinates: roadGeometry,
            }),
          }),
        ],
      }),
    }));
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

    expect(map.removeLayer).toHaveBeenCalledWith('scope-route-line');
    expect(map.removeLayer).toHaveBeenCalledWith('scope-route-outline');
    expect(map.removeSource).toHaveBeenCalledWith('scope-route-source');
  });

  it('removes stale route layers even while the Mapbox style is pending', async () => {
    const { map, setStyleLoaded } = createMapMock();

    const wrapper = mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
      },
    });

    setStyleLoaded(false);
    await wrapper.setProps({ points: [] });

    expect(map.removeLayer).toHaveBeenCalledWith('scope-route-line');
    expect(map.removeLayer).toHaveBeenCalledWith('scope-route-outline');
    expect(map.removeSource).toHaveBeenCalledWith('scope-route-source');
  });

  it('reattaches the route when Mapbox finishes loading a pending style', () => {
    const { emit, map, setStyleLoaded } = createMapMock(false);

    const wrapper = mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
        variant: 'planner',
      },
    });

    expect(map.addSource).not.toHaveBeenCalled();

    setStyleLoaded(true);
    emit('style.load');

    expect(map.addSource).toHaveBeenCalledWith('scope-route-source', expect.objectContaining({
      data: expect.objectContaining({
        features: expect.arrayContaining([
          expect.objectContaining({
            geometry: expect.objectContaining({
              type: 'LineString',
            }),
          }),
        ]),
      }),
    }));
    expect(map.addLayer).toHaveBeenCalledTimes(2);
    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-line', 'line-width', 6.2);
    expect(map.moveLayer).toHaveBeenLastCalledWith('scope-route-line');

    wrapper.unmount();
  });

  it('uses high-contrast route paint for dark and bright map surfaces', async () => {
    const { map } = createMapMock();
    const wrapper = mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
        variant: 'planner',
      },
    });

    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-outline', 'line-color', '#ecfeff');
    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-line', 'line-color', '#fbbf24');

    await wrapper.setProps({ presentation: 'native' });

    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-outline', 'line-color', '#061018');
    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-line', 'line-color', '#b45309');

    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-outline', 'line-color', '#061018');
    expect(map.setPaintProperty).toHaveBeenCalledWith('scope-route-line', 'line-color', '#b45309');

    wrapper.unmount();
  });

  it('keeps the route below the traffic overlay when traffic layers are present', () => {
    const { map } = createMapMock(true, ['scope-traffic-flow-casing', 'scope-traffic-flow']);

    mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
      },
    });

    expect(map.moveLayer).toHaveBeenCalledWith('scope-route-outline', 'scope-traffic-flow-casing');
    expect(map.moveLayer).toHaveBeenCalledWith('scope-route-line', 'scope-traffic-flow-casing');
  });

  it('ignores stale Mapbox style state while unmounting', () => {
    const { map } = createMapMock();

    const wrapper = mount(RouteLayer, {
      props: {
        mapInstance: map as any,
        points: routePoints,
      },
    });

    map.getLayer.mockImplementation(() => {
      throw new TypeError('Cannot read properties of undefined (reading getOwnLayer)');
    });
    map.getSource.mockImplementation(() => {
      throw new TypeError('Cannot read properties of undefined (reading getOwnSource)');
    });

    expect(() => wrapper.unmount()).not.toThrow();
    expect(map.off).toHaveBeenCalledWith('style.load', expect.any(Function));
  });
});
