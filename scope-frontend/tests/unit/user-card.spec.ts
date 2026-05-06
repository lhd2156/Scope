import { mount } from '@vue/test-utils';
import UserCard from '@/components/social/UserCard.vue';
import type { UserProfile } from '@/types';

const user: UserProfile = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
  homeBase: 'Fort Worth, TX',
  bio: 'Chasing skyline tacos and river walks.',
  interests: ['food', 'nightlife'],
  stats: {
    spots: 18,
    trips: 6,
    friends: 24,
  },
};

describe('UserCard', () => {
  it('renders presence, stats, and emits primary plus secondary actions', async () => {
    const wrapper = mount(UserCard, {
      props: {
        user,
        presence: 'planning',
        primaryActionLabel: 'Add friend',
        secondaryActionLabel: 'Message',
      },
    });

    expect(wrapper.text()).toContain('Planning');
    expect(wrapper.text()).toContain('18');
    expect(wrapper.text()).toContain('24');

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('secondary-action')?.[0]).toEqual(['user-1']);
    expect(wrapper.emitted('primary-action')?.[0]).toEqual(['user-1']);
  });
});
