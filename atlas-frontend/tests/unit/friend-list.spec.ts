import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FriendList from '@/components/social/FriendList.vue';
import type { FriendConnection } from '@/types';

const friends: FriendConnection[] = [
  {
    id: 'friend-1',
    presence: 'online',
    sharedTrips: 2,
    mutualFriends: 14,
    favoriteCategories: ['culture', 'shopping'],
    nextAdventure: 'Dallas design district sprint',
    lastActiveAt: '2026-03-29T03:28:00Z',
    user: {
      id: 'user-1',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      bio: 'Weekend explorer chasing scenic and cultural spots.',
      homeBase: 'Dallas, TX',
      interests: ['culture', 'shopping'],
      stats: { spots: 28, trips: 6, friends: 84 },
    },
  },
  {
    id: 'friend-2',
    presence: 'planning',
    sharedTrips: 4,
    mutualFriends: 9,
    favoriteCategories: ['adventure', 'food'],
    nextAdventure: 'Austin sunrise route',
    lastActiveAt: '2026-03-29T02:54:00Z',
    user: {
      id: 'user-2',
      username: 'elijah',
      email: 'elijah@example.com',
      displayName: 'Elijah Brooks',
      bio: 'Adventure-first trip planner with a thing for great coffee.',
      homeBase: 'Austin, TX',
      interests: ['adventure', 'food'],
      stats: { spots: 36, trips: 11, friends: 64 },
    },
  },
];

describe('FriendList', () => {
  it('filters by query and emits social actions', async () => {
    const wrapper = mount(FriendList, {
      props: {
        friends,
      },
    });

    expect(wrapper.text()).toContain('2 total');
    expect(wrapper.text()).toContain('1 online');

    await wrapper.find('input[type="search"]').setValue('Austin');
    await nextTick();

    expect(wrapper.text()).toContain('Elijah Brooks');
    expect(wrapper.text()).not.toContain('Maya Chen');

    await wrapper.get('button.primary-button').trigger('click');

    expect(wrapper.emitted('view-profile')).toBeTruthy();
  });
});
