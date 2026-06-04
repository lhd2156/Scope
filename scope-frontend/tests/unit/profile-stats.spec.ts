import { mount } from '@vue/test-utils';
import ProfileStats from '@/components/profile/ProfileStats.vue';

describe('ProfileStats', () => {
  it('renders the four horizontal travel counters and support pills', () => {
    const wrapper = mount(ProfileStats, {
      props: {
        user: {
          id: 'user-1',
          username: 'louisdo',
          email: 'louis@example.com',
          displayName: 'Louis Do',
          interests: ['food', 'culture'],
        },
        countryCount: 2,
        cityCount: 4,
        tripCount: 5,
        travelDays: 17,
        publicSpotCount: 12,
        averageRating: 4.8,
        favoriteCategory: 'culture',
      },
    });

    expect(wrapper.attributes('aria-label')).toContain('Louis Do');
    expect(wrapper.text()).toContain('Countries');
    expect(wrapper.text()).toContain('Cities');
    expect(wrapper.text()).toContain('Trips');
    expect(wrapper.text()).toContain('Days');
    expect(wrapper.text()).toContain('17');
    expect(wrapper.text()).toContain('12 public pins');
    expect(wrapper.text()).toContain('4.8 avg rating');
    expect(wrapper.text()).toContain('Culture focus');
    expect(wrapper.findAll('.stat-card')).toHaveLength(4);
  });

  it('uses launch-state copy when ratings and favorite category are not available yet', () => {
    const wrapper = mount(ProfileStats, {
      props: {
        countryCount: 0,
        cityCount: 0,
        tripCount: 0,
        travelDays: 0,
        publicSpotCount: 1,
        averageRating: 0,
        favoriteCategory: null,
      },
      global: {
        stubs: {
          StarRatingDisplay: { template: '<span data-test="rating-stub" />' },
        },
      },
    });

    expect(wrapper.attributes('aria-label')).toBe('Traveler footprint stats');
    expect(wrapper.text()).toContain('1 public pin');
    expect(wrapper.text()).toContain('Freshly launched profile');
    expect(wrapper.find('[data-test="rating-stub"]').exists()).toBe(false);
    expect(wrapper.find('.support-pill--accent').exists()).toBe(false);
  });
});
