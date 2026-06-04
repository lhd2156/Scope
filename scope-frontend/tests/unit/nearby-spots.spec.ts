import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NearbySpots from '@/components/spots/NearbySpots.vue';

const searchNearbyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/searchService', () => ({
  searchNearby: searchNearbyMock,
}));

describe('NearbySpots', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    searchNearbyMock.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and renders nearby spots from explicit coordinates', async () => {
    searchNearbyMock.mockResolvedValueOnce({
      results: [
        {
          id: 'spot-1',
          name: 'River Tacos',
          type: 'spot',
          _distance_km: 1.248,
          avg_rating: 4.6,
        },
        {
          id: 'spot-2',
          name: 'Skyline Trail',
          type: 'spot',
          _distance_km: 3,
        },
      ],
    });

    const wrapper = mount(NearbySpots, {
      props: {
        lat: 32.7555,
        lon: -97.3308,
        radiusKm: 12,
        limit: 2,
      },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          StarRatingDisplay: { props: ['rating'], template: '<span data-test="rating">{{ rating }}</span>' },
        },
      },
    });

    await flushPromises();

    expect(searchNearbyMock).toHaveBeenCalledWith(32.7555, -97.3308, 12, 2);
    expect(wrapper.text()).toContain('Spots within 12km');
    expect(wrapper.text()).toContain('2 found');
    expect(wrapper.text()).toContain('River Tacos');
    expect(wrapper.text()).toContain('1.2km away');
    expect(wrapper.text()).toContain('4.6');
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual(['/spots/spot-1', '/spots/spot-2']);
  });

  it('uses geolocation when coordinates are not passed', async () => {
    searchNearbyMock.mockResolvedValueOnce({
      results: [
        {
          id: 'spot-geo',
          name: 'Current Position Cafe',
          type: 'spot',
          _distance_km: 0.5,
          avg_rating: 5,
        },
      ],
    });
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 30.2672,
          longitude: -97.7431,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition },
    });

    const wrapper = mount(NearbySpots, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          StarRatingDisplay: true,
        },
      },
    });

    await flushPromises();

    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      maximumAge: 300_000,
      timeout: 6_000,
    });
    expect(searchNearbyMock).toHaveBeenCalledWith(30.2672, -97.7431, 10, 8);
    expect(wrapper.text()).toContain('Current Position Cafe');
  });

  it('stays hidden when geolocation or nearby search cannot produce results', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => {
      failure({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition },
    });

    const wrapper = mount(NearbySpots, {
      global: {
        stubs: {
          RouterLink: true,
          StarRatingDisplay: true,
        },
      },
    });

    await flushPromises();

    expect(searchNearbyMock).not.toHaveBeenCalled();
    expect(wrapper.find('.nearby-panel').exists()).toBe(false);

    searchNearbyMock.mockRejectedValueOnce(new Error('search offline'));
    await wrapper.setProps({ lat: 32.7, lon: -97.2 });
    await flushPromises();

    expect(wrapper.find('.nearby-panel').exists()).toBe(false);
  });
});
