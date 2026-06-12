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

const focusSpotByIdMock = vi.fn();

function mountProfileMap(props: Record<string, unknown> = {}) {
  return mount(ProfileMap, {
    props,
    global: {
      stubs: {
        MapView: {
          props: ['spots', 'showMapStyleToggle'],
          emits: ['spot-select'],
          methods: {
            focusSpotById: focusSpotByIdMock,
          },
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
  beforeEach(() => {
    focusSpotByIdMock.mockClear();
  });

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
    expect(wrapper.text()).toContain('Fort Worth, TX, United States');
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

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    expect(coverage.activeSpots.value).toEqual([]);
    expect(coverage.selectedSpot.value).toBeNull();
    expect(coverage.selectedSpotLocation.value).toBe('Scope map pin');
    expect(coverage.selectedSpotImageUrl.value).toBe(coverage.selectedSpotImageFallback.value);
    expect(coverage.countryCount.value).toBe(0);
    expect(coverage.activeMetrics.value).toEqual([
      { label: 'spots', value: '0' },
      { label: 'cities', value: '0' },
      { label: 'countries', value: '0' },
    ]);
    expect(coverage.inferProfileMapCountryFromRegion(undefined)).toBe('');
  });

  it('covers profile map normalization, location labels, and viewport branches', async () => {
    const invalidSpot = {
      ...spots[0],
      id: 'invalid-coordinates',
      latitude: 95,
      longitude: -197,
    };
    const duplicateSpot = {
      ...spots[0],
      id: 'duplicate-rooftop',
      createdAt: '2026-03-29T20:00:00Z',
    };
    const unknownCountrySpot: SpotSummary = {
      ...spots[1],
      id: 'unknown-country',
      title: 'Harbor Lookout',
      city: 'Cape Town',
      country: 'ZA',
      latitude: -33.9249,
      longitude: 18.4241,
      category: 'scenic',
      createdAt: '2026-03-30T10:00:00Z',
    };

    const wrapper = mountProfileMap({
      spots: [spots[0], duplicateSpot, invalidSpot, unknownCountrySpot],
      visitedSpots: [],
      pinnedSpots: [],
      wishlistSpots: [pinnedSpots[0]],
      showWishlist: false,
      description: '  ',
      ownerName: 'Riley Scout',
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(coverage.availableCollections.value.map((collection: { id: string }) => collection.id)).toEqual([
      'all',
      'visited',
      'pinned',
    ]);
    expect(coverage.activeCollection.value.id).toBe('visited');
    expect(coverage.fallbackSpots.value.map((spot: SpotSummary) => spot.id)).toEqual([
      'unknown-country',
      'spot-1',
    ]);
    expect(coverage.hasValidCoordinates(spots[0])).toBe(true);
    expect(coverage.hasValidCoordinates(invalidSpot)).toBe(false);
    expect(coverage.hasValidCoordinates({ ...spots[0], latitude: Number.NaN })).toBe(false);
    expect(coverage.normalizeSpots([spots[0], duplicateSpot, invalidSpot])).toHaveLength(1);

    expect(coverage.effectiveDescription.value).toContain("Riley Scout's trip stops");
    expect(coverage.formatCategory('nightlife')).toBe('Nightlife');
    expect(coverage.formatProfileMapCountry(' usa ')).toBe('United States');
    expect(coverage.formatProfileMapCountry('Atlantis')).toBe('Atlantis');
    expect(coverage.formatProfileMapCountry('   ')).toBe('');
    expect(coverage.inferProfileMapCountryFromRegion(' tx ')).toBe('US');
    expect(coverage.inferProfileMapCountryFromRegion('Barcelona')).toBe('');
    expect(coverage.resolveDisplayRegion('US', 'us')).toBe('');
    expect(coverage.resolveDisplayRegion('Catalonia', 'Spain')).toBe('Catalonia');
    expect(coverage.dedupeLocationParts([' Austin ', 'Texas', 'austin', '', 'United States'])).toEqual([
      'Austin',
      'Texas',
      'United States',
    ]);
    expect(coverage.formatSpotLocation({
      ...spots[0],
      city: 'Austin',
      country: 'US',
      region: 'TX',
    })).toBe('Austin, TX, United States');
    expect(coverage.formatSpotLocation({
      ...spots[0],
      city: '',
      country: '',
      region: '',
    })).toBe('Location syncing');
    expect(coverage.formatSpotLocation(unknownCountrySpot)).toBe('Cape Town, Western Cape, South Africa');

    expect(coverage.countryCount.value).toBe(1);
    expect(coverage.cityCount.value).toBe(2);
    expect(coverage.activeMetrics.value).toEqual([
      { label: 'spots', value: '2' },
      { label: 'cities', value: '2' },
      { label: 'country', value: '1' },
    ]);
    expect(coverage.mapPoints.value.map((point: { id: string }) => point.id)).toEqual([
      'unknown-country',
      'spot-1',
    ]);
    expect(coverage.resolveSpotImageUrl(spots[0], 320)).toContain('images.unsplash.com');

    expect(coverage.resolveViewportZoom(1, 0)).toBe(11.5);
    expect(coverage.resolveViewportZoom(2, 120)).toBe(2.35);
    expect(coverage.resolveViewportZoom(2, 40)).toBe(3.1);
    expect(coverage.resolveViewportZoom(2, 14)).toBe(4.6);
    expect(coverage.resolveViewportZoom(2, 5)).toBe(6.2);
    expect(coverage.resolveViewportZoom(2, 2)).toBe(8.1);
    expect(coverage.resolveViewportZoom(2, 0.5)).toBe(10.2);
    expect(coverage.buildViewportForSpots([]).center).toEqual([-98.5795, 39.8283]);
    expect(coverage.buildViewportForSpots([spots[0]]).zoom).toBe(11.5);
    expect(coverage.buildViewportForSpots([spots[0], unknownCountrySpot]).zoom).toBe(2.35);

    coverage.selectMode('pinned');
    expect(coverage.activeMode.value).toBe('pinned');
    expect(coverage.hasUserSelectedMode.value).toBe(true);
    coverage.handleSpotSelect({ id: 'spot-3' });
    expect(coverage.selectedSpotId.value).toBe('spot-3');
    coverage.selectSpot('spot-3');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(focusSpotByIdMock).toHaveBeenCalledWith('spot-3');

    await wrapper.setProps({ showWishlist: true });
    await wrapper.vm.$nextTick();
    coverage.selectMode('wishlist');
    expect(coverage.activeMetrics.value[0]).toEqual({ label: 'saves', value: '1' });
    expect(coverage.selectedSpotLocation.value).toContain('Dallas');

    wrapper.unmount();
  });
});
