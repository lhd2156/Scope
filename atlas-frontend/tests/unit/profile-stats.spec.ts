import { mount } from '@vue/test-utils';
import ProfileStats from '@/components/profile/ProfileStats.vue';
import type { UserProfile } from '@/types';

const user: UserProfile = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
  interests: ['food', 'nightlife'],
};

describe('ProfileStats', () => {
  it('renders summary cards and the favorite category chip', () => {
    const wrapper = mount(ProfileStats, {
      props: {
        user,
        publicSpotCount: 12,
        cityCount: 4,
        averageRating: 4.7,
        routeCount: 5,
        favoriteCategory: 'food',
      },
    });

    expect(wrapper.text()).toContain('Louis Do at a glance');
    expect(wrapper.text()).toContain('12 public pins');
    expect(wrapper.text()).toContain('4.7');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.find('.signature-chip').classes()).toContain('badge-food');
  });
});
