import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import MapView from '@/components/map/MapView.vue';
import { useMapStore } from '@/stores/map';
import type { MapPoint } from '@/types';

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

describe('MapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

    expect(wrapper.text()).toContain('Mapbox token required');
    expect(wrapper.text()).toContain('2 pins in view');
    expect(wrapper.find('.map-canvas').classes()).toContain('is-fallback');
    expect(wrapper.find('[data-test="map-fallback-stage"]').exists()).toBe(true);
    expect(wrapper.findAll('g[data-test^="map-fallback-marker-"]')).toHaveLength(2);
    expect(mapStore.visibleSpotIds).toEqual(['spot-1', 'spot-2']);
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
});
