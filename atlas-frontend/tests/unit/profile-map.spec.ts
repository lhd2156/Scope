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
    createdAt: '2026-03-26T20:00:00Z',
  },
  {
    id: 'spot-2',
    title: 'Modern Art Garden',
    latitude: 30.2672,
    longitude: -97.7431,
    category: 'culture',
    city: 'Austin',
    rating: 4.6,
    createdAt: '2026-03-20T16:05:00Z',
  },
];

describe('ProfileMap', () => {
  it('renders the adventure map shell and selectable spot list', async () => {
    const wrapper = mount(ProfileMap, {
      props: {
        spots,
      },
      global: {
        stubs: {
          MapView: {
            props: ['spots', 'selectedSpotId'],
            template: '<div data-test="map-view-stub">{{ selectedSpotId }} · {{ spots.length }}</div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Mapped public highlights');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Modern Art Garden');
    expect(wrapper.get('[data-test="map-view-stub"]').text()).toContain('spot-1 · 2');

    await wrapper.findAll('button.spot-row')[1].trigger('click');

    expect(wrapper.get('[data-test="map-view-stub"]').text()).toContain('spot-2 · 2');
  });
});
