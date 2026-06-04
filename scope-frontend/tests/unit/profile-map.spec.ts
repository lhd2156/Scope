import { mount } from '@vue/test-utils';
import ProfileMap from '@/components/profile/ProfileMap.vue';
import type { SpotSummary } from '@/types';

const spots: SpotSummary[] = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'food',
    city: 'Fort Worth',
    country: 'US',
    rating: 4.8,
    photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    createdAt: '2026-03-26T20:00:00Z',
  },
  {
    id: 'spot-2',
    title: 'Modern Art Garden',
    latitude: 30.2672,
    longitude: -97.7431,
    category: 'culture',
    city: 'Austin',
    country: 'US',
    rating: 4.6,
    photoUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    createdAt: '2026-03-20T16:05:00Z',
  },
];

const pinnedSpots: SpotSummary[] = [
  {
    id: 'spot-3',
    title: 'Deep Ellum Listening Room',
    latitude: 32.784,
    longitude: -96.7842,
    category: 'nightlife',
    city: 'Dallas',
    country: 'US',
    rating: 4.9,
    createdAt: '2026-03-28T02:00:00Z',
  },
];

function mountProfileMap(props: Record<string, unknown> = {}) {
  return mount(ProfileMap, {
    props,
    global: {
      stubs: {
        MapView: {
          props: ['spots', 'showMapStyleToggle'],
          emits: ['spot-select'],
          template: '<section data-test="map-view" :data-style-toggle="String(showMapStyleToggle)">{{ spots.length }} map spots<button v-if="spots[0]" data-test="map-select-first" @click="$emit(\'spot-select\', spots[0])">Select first</button></section>',
        },
        RouterLink: { template: '<a><slot /></a>' },
        ScopeIcon: { template: '<span class="icon-stub" />' },
        LazyImage: { props: ['alt'], template: '<img :alt="alt" />' },
      },
    },
  });
}

describe('ProfileMap', () => {
  it('renders the live map workspace and updates the spotlight when a place is selected', async () => {
    const wrapper = mountProfileMap({
      visitedSpots: spots,
      pinnedSpots,
      wishlistSpots: [],
      ownerName: 'Alex Morgan',
      title: "Alex Morgan's Scope Map",
    });

    expect(wrapper.text()).toContain("Alex Morgan's Scope Map");
    expect(wrapper.find('[data-test="map-view"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.findAll('.map-mode-button')).toHaveLength(4);
    expect(wrapper.find('.map-mode-button.is-active').text()).toContain('Visited');
    expect(wrapper.find('[data-test="map-view"]').attributes('data-style-toggle')).toBe('true');
    expect(wrapper.findAll('.profile-map__place')).toHaveLength(2);

    await wrapper.findAll('button.profile-map__place')[1].trigger('click');

    expect(wrapper.text()).toContain('Modern Art Garden');
    expect(wrapper.findAll('.profile-map__place')[1].classes()).toContain('is-active');

    await wrapper.get('[data-test="map-select-first"]').trigger('click');

    expect(wrapper.findAll('.profile-map__place')[0].classes()).toContain('is-active');
  });

  it('switches between all, visited, pinned, and wishlist map layers without remounting the map', async () => {
    const wrapper = mountProfileMap({
      visitedSpots: spots,
      pinnedSpots,
      wishlistSpots: [],
      ownerName: 'Alex Morgan',
    });

    const mapView = wrapper.find('[data-test="map-view"]').element;
    const modeButtons = wrapper.findAll('button.map-mode-button');
    const allButton = modeButtons.find((button) => button.text().includes('All'));
    const pinnedButton = modeButtons.find((button) => button.text().includes('Pinned'));

    if (!allButton || !pinnedButton) {
      throw new Error('Expected all and pinned map layer buttons to render');
    }

    await allButton.trigger('click');

    expect(wrapper.find('[data-test="map-view"]').text()).toContain('3 map spots');
    expect(wrapper.find('[data-test="map-view"]').element).toBe(mapView);

    await pinnedButton.trigger('click');

    expect(wrapper.text()).toContain('Deep Ellum Listening Room');
    expect(wrapper.find('[data-test="map-view"]').text()).toContain('1 map spots');
    expect(wrapper.find('[data-test="map-view"]').element).toBe(mapView);
  });

  it('opens the first populated map layer instead of an empty visited layer', () => {
    const wrapper = mountProfileMap({
      visitedSpots: [],
      pinnedSpots,
      wishlistSpots: [],
      ownerName: 'Alex Morgan',
    });

    expect(wrapper.find('[data-test="map-view"]').exists()).toBe(true);
    expect(wrapper.find('.map-mode-button.is-active').text()).toContain('All');
    expect(wrapper.text()).toContain('Deep Ellum Listening Room');
    expect(wrapper.find('[data-test="map-view"]').text()).toContain('1 map spots');
  });

  it('shows a plain centered empty state when there are no mapped visits yet', () => {
    const wrapper = mountProfileMap({
      visitedSpots: [],
      pinnedSpots: [],
      wishlistSpots: [],
    });

    expect(wrapper.find('[data-test="profile-map-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No mapped visits yet');
  });
});
