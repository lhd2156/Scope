import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import MapView from '@/components/map/MapView.vue';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { useMapStore } from '@/stores/map';
import type { MapPoint } from '@/types';

vi.mock('@/services/roadRouteService', () => ({
  resolveRoadRoute: vi.fn(async (points: MapPoint[]) => ({
    geometry: points.map((point) => [point.longitude, point.latitude]),
    orderedPoints: points,
    distanceMeters: 1200,
    durationSeconds: 420,
    provider: 'local-estimate',
    profile: 'local',
  })),
}));

vi.mock('mapbox-gl', () => ({
  default: {
    Marker: class {
      setLngLat() {
        return this;
      }

      addTo() {
        return this;
      }

      remove() {}
    },
    Map: class {},
    LngLatBounds: class {
      extend() {
        return this;
      }
    },
  },
}));

const spots: MapPoint[] = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'food',
    city: 'Fort Worth',
    rating: 4.8,
  },
  {
    id: 'spot-2',
    title: 'Trinity Trails Outlook',
    latitude: 32.7443,
    longitude: -97.3521,
    category: 'scenic',
    city: 'Fort Worth',
    rating: 4.9,
  },
];

function countRoutePathSegments(path: string | undefined): number {
  return path?.match(/\sL\s/g)?.length ?? 0;
}

describe('MapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(resolveRoadRoute).mockClear();
  });

  it('renders the fallback experience and syncs visible spot ids when no token is configured', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await nextTick();

    const mapStore = useMapStore();

    expect(wrapper.text()).toContain('Interactive map offline');
    expect(wrapper.text()).toContain('2 pins in view');
    expect(wrapper.text()).toContain('8 filters active');
    expect(wrapper.text()).not.toContain('trip stops');
    expect(wrapper.find('[data-test="map-summary-pins"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="map-summary-filters"]').exists()).toBe(true);
    expect(wrapper.find('.map-canvas').classes()).toContain('is-fallback');
    expect(wrapper.find('[data-test="map-fallback-stage"]').exists()).toBe(true);
    expect(wrapper.findAll('g[data-test^="map-fallback-marker-"]')).toHaveLength(2);
    expect(mapStore.visibleSpotIds).toEqual(['spot-1', 'spot-2']);
    expect(mapStore.visibleSpotIdsMeasured).toBe(true);
  });

  it('numbers planner route markers from the full route sequence instead of stale labels', async () => {
    const routePoints: MapPoint[] = [
      {
        id: 'route-start',
        title: 'Tarzan, Texas',
        latitude: 32.3065,
        longitude: -101.9754,
        category: 'scenic',
        routeRole: 'start',
        routeLabel: 'S',
      },
      {
        id: 'route-stop-fort-worth',
        title: 'Fort Worth stop',
        latitude: 32.7555,
        longitude: -97.3308,
        category: 'food',
        routeRole: 'stop',
        routeLabel: '3',
      },
      {
        id: 'route-stop-austin',
        title: 'Austin stop',
        latitude: 30.2672,
        longitude: -97.7431,
        category: 'culture',
        routeRole: 'stop',
        routeLabel: '4',
      },
      {
        id: 'route-end',
        title: 'Garden City, Texas',
        latitude: 31.8646,
        longitude: -101.4812,
        category: 'other',
        routeRole: 'end',
        routeLabel: 'E',
      },
    ];

    const wrapper = mount(MapView, {
      props: {
        spots: routePoints,
        routePoints,
        markerVariant: 'sequence',
        showControls: false,
        showSummary: false,
      },
    });

    await nextTick();

    expect(wrapper.get('[data-test="map-fallback-marker-route-start"] .map-fallback__sequence text').text()).toBe('S');
    expect(wrapper.get('[data-test="map-fallback-marker-route-stop-fort-worth"] .map-fallback__sequence text').text()).toBe('2');
    expect(wrapper.get('[data-test="map-fallback-marker-route-stop-austin"] .map-fallback__sequence text').text()).toBe('3');
    expect(wrapper.get('[data-test="map-fallback-marker-route-end"] .map-fallback__sequence text').text()).toBe('E');
  });

  it('resolves fixed-order road geometry when a route has stops but no supplied geometry', async () => {
    vi.mocked(resolveRoadRoute).mockResolvedValueOnce({
      geometry: [
        [-97.3308, 32.7555],
        [-97.3412, 32.751],
        [-97.3521, 32.7443],
      ],
      orderedPoints: spots,
      distanceMeters: 2600,
      durationSeconds: 540,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving',
    });

    mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await flushPromises();

    expect(resolveRoadRoute).toHaveBeenCalledWith(spots, { optimizeOrder: false });
  });

  it('can opt into optimized road geometry for planner routes', async () => {
    mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        optimizeRouteOrder: true,
      },
    });

    await flushPromises();

    expect(resolveRoadRoute).toHaveBeenCalledWith(spots, { optimizeOrder: true });
  });

  it('drops stale auto route geometry while a changed route is recalculating', async () => {
    vi.mocked(resolveRoadRoute).mockResolvedValueOnce({
      geometry: [
        [-97.3308, 32.7555],
        [-97.3412, 32.751],
        [-97.3521, 32.7443],
      ],
      orderedPoints: spots,
      distanceMeters: 2600,
      durationSeconds: 540,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving',
    });

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await flushPromises();

    expect(countRoutePathSegments(wrapper.find('.map-fallback__route path').attributes('d'))).toBe(2);

    let resolveNextRoute: (summary: RoadRouteSummary) => void = () => undefined;
    vi.mocked(resolveRoadRoute).mockImplementationOnce(() => new Promise<RoadRouteSummary>((resolve) => {
      resolveNextRoute = resolve;
    }));

    const changedRoute: MapPoint[] = [
      {
        ...spots[0],
        id: 'spot-3',
        title: 'Changed start',
        latitude: 35.4676,
        longitude: -97.5164,
      },
      {
        ...spots[1],
        id: 'spot-4',
        title: 'Changed end',
        latitude: 36.154,
        longitude: -95.9928,
      },
    ];

    await wrapper.setProps({
      spots: changedRoute,
      routePoints: changedRoute,
    });
    await nextTick();

    expect(countRoutePathSegments(wrapper.find('.map-fallback__route path').attributes('d'))).toBe(1);

    resolveNextRoute({
      geometry: changedRoute.map((point) => [point.longitude, point.latitude]),
      orderedPoints: changedRoute,
      distanceMeters: 1800,
      durationSeconds: 480,
      provider: 'local-estimate',
      profile: 'local',
    });
  });

  it('selects a fallback marker and emits the chosen spot when the static map is used', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
      },
    });

    await nextTick();

    const mapStore = useMapStore();
    const secondMarkerHitArea = wrapper.get('[data-test="map-fallback-marker-hit-spot-2"]');

    await secondMarkerHitArea.trigger('click');
    await nextTick();

    expect(mapStore.selectedSpotId).toBe('spot-2');
    expect(wrapper.emitted('spot-select')).toEqual([[spots[1]]]);
    expect(wrapper.get('[data-test="map-fallback-marker-spot-2"]').classes()).toContain('is-active');
  });

  it('turns fallback marker clicks into map picks while pick mode is active', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        clickToSelect: true,
      },
    });

    await nextTick();

    await wrapper.get('[data-test="map-fallback-marker-hit-spot-2"]').trigger('click');
    await nextTick();

    expect(wrapper.emitted('spot-select')).toBeUndefined();
    expect(wrapper.emitted('interaction')).toEqual([[{ type: 'map_click' }]]);
    expect(wrapper.emitted('map-click')).toEqual([[
      {
        latitude: spots[1]?.latitude,
        longitude: spots[1]?.longitude,
      },
    ]]);
  });

  it('resets filters, selection, and viewport from the map controls', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    const mapStore = useMapStore();
    mapStore.setCenter([-80, 40]);
    mapStore.setZoom(14);
    mapStore.setActiveCategories(['food']);
    mapStore.setVisibleSpotIds(['spot-1']);
    mapStore.setSelectedSpotId('spot-2');

    await wrapper.get('button[aria-label="Reset map"]').trigger('click');
    await nextTick();

    expect(mapStore.viewport.center).toEqual([-98.5795, 39.8283]);
    expect(mapStore.viewport.zoom).toBe(3.25);
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
    expect(mapStore.selectedSpotId).toBe('spot-1');
    expect(wrapper.emitted('interaction')).toEqual([[{ type: 'reset_map' }]]);
  });
});
