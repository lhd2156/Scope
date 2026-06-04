import { mount } from '@vue/test-utils';
import FriendList from '@/components/social/FriendList.vue';

describe('FriendList', () => {
  it('renders premium friend cards and emits profile navigation from the CTA', async () => {
    const friends = [
      {
        id: 'friend-1',
        displayName: 'Maya Chen',
        username: 'maya',
        homeBase: 'Dallas, TX',
        presence: 'online',
        mutualFriends: 18,
        sharedTrips: 3,
        nextAdventure: 'Dallas culture sprint',
      },
      {
        id: 'friend-2',
        displayName: 'Elijah Brooks',
        username: 'elijah',
        homeBase: 'Austin, TX',
        presence: 'planning',
        mutualFriends: 12,
        sharedTrips: 2,
        nextAdventure: 'Austin sunrise loop',
      },
    ];

    const wrapper = mount(FriendList, {
      props: {
        friends,
      },
    });

    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('@maya');
    expect(wrapper.text()).toContain('18 mutual friends');
    expect(wrapper.text()).toContain('3 shared trips');

    await wrapper.findAll('.friend-card__button')[0]?.trigger('click');
    expect(wrapper.emitted('view-profile')?.[0]).toEqual(['friend-1']);
  });

  it('renders a reusable empty state when no friends are connected yet', () => {
    const wrapper = mount(FriendList, {
      props: {
        friends: [],
      },
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.find('[data-test="friend-list-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Your Scope circle is still forming');
  });

  it('normalizes friend connection records and uses friendly fallback copy', () => {
    const wrapper = mount(FriendList, {
      props: {
        title: 'Crew',
        description: 'People ready for the route.',
        friends: [
          {
            user: {
              id: 'friend-connection-1',
              displayName: 'Ari Lane',
              email: 'ari@example.com',
              username: '',
              interests: [],
            },
            presence: undefined,
            sharedTrips: 1,
            mutualFriends: 1,
          },
        ] as never,
      },
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.text()).toContain('Crew');
    expect(wrapper.text()).toContain('People ready for the route.');
    expect(wrapper.text()).toContain('@scopetraveler');
    expect(wrapper.text()).toContain('Scope traveler');
    expect(wrapper.text()).toContain('Offline');
    expect(wrapper.text()).toContain('1 mutual friend');
    expect(wrapper.text()).toContain('1 shared trip');
    expect(wrapper.text()).toContain('Ready for the next Scope route.');
  });
});
