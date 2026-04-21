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

describe('ProfileMap', () => {
  it('renders the global footprint shell and updates the spotlight when a city chip is selected', async () => {
    const wrapper = mount(ProfileMap, {
      props: {
        spots,
      },
    });

    expect(wrapper.text()).toContain('Global Footprint');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.findAll('.city-pill')).toHaveLength(2);
    expect(wrapper.findAll('.footprint-point')).toHaveLength(2);

    await wrapper.findAll('button.city-pill')[1].trigger('click');

    expect(wrapper.text()).toContain('Modern Art Garden');
    expect(wrapper.findAll('.city-pill')[1].classes()).toContain('is-active');
  });

  it('shows a premium empty-state panel when there are no public pins yet', () => {
    const wrapper = mount(ProfileMap, {
      props: {
        spots: [],
      },
      global: {
        stubs: {
          AtlasIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No public pins yet');
  });
});
