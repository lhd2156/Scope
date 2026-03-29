import { mount } from '@vue/test-utils';
import FriendList from '@/components/social/FriendList.vue';

describe('FriendList', () => {
  it('renders a virtualized friend connection list and emits profile navigation', async () => {
    const friends = Array.from({ length: 15 }, (_, index) => ({
      id: `friend-${index}`,
      displayName: `Friend ${index}`,
      homeBase: 'Fort Worth, TX',
      presence: index === 0 ? 'online' : 'offline',
    }));

    const wrapper = mount(FriendList, {
      props: {
        friends,
        viewportHeight: 160,
      },
    });

    expect(wrapper.text()).toContain('Friend 0');
    expect(wrapper.text()).not.toContain('Friend 12');

    await wrapper.findAll('.friend-row')[0]?.trigger('click');
    expect(wrapper.emitted('view-profile')?.[0]).toEqual(['friend-0']);
  });
});
