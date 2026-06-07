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

  it('uses active-state copy when ratings are not available but the profile has a footprint', () => {
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
    expect(wrapper.text()).toContain('Profile in motion');
    expect(wrapper.find('[data-test="rating-stub"]').exists()).toBe(false);
    expect(wrapper.find('.support-pill--accent').exists()).toBe(false);
  });

  it('keeps launch-state copy for a truly empty profile and supports broad focus labels', () => {
    const wrapper = mount(ProfileStats, {
      props: {
        countryCount: 0,
        cityCount: 0,
        tripCount: 0,
        travelDays: 0,
        publicSpotCount: 0,
        averageRating: 0,
        favoriteCategory: null,
        focusLabel: 'All-around focus',
      },
    });

    expect(wrapper.text()).toContain('Freshly launched profile');
    expect(wrapper.text()).toContain('All-around focus');
  });
});
