import { mount } from '@vue/test-utils';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import type { UserProfile } from '@/types';

const user: UserProfile = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
  bio: 'Collecting skyline dinners, scenic loops, and culture-first routes.',
  homeBase: 'Fort Worth, TX',
  interests: ['food', 'culture', 'scenic'],
  stats: { spots: 42, trips: 8, friends: 126 },
};

describe('ProfileHeader', () => {
  it('renders profile identity, interests, and action links', () => {
    const wrapper = mount(ProfileHeader, {
      props: {
        user,
        isCurrentUser: true,
        primaryActionLabel: 'Edit preferences',
        primaryActionTo: '/settings',
        secondaryActionLabel: 'View friends',
        secondaryActionTo: '/friends',
      },
    });

    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('@louisdo');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('Edit preferences');
    expect(wrapper.text()).toContain('View friends');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).toContain('42');
    expect(wrapper.text()).toContain('126');
  });
});
