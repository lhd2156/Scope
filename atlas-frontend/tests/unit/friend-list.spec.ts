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
          AtlasIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Your Atlas circle is still forming');
  });
});
