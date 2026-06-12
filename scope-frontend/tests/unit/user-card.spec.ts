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

  it('renders fallback identity copy, filtered tags, and compact cards without actions', () => {
    const wrapper = mount(UserCard, {
      props: {
        user: {
          ...user,
          homeBase: undefined,
          bio: undefined,
          stats: undefined,
        },
        compact: true,
        showStats: false,
        tags: ['planner', '', 'food'],
      },
    });

    expect(wrapper.classes()).toContain('compact');
    expect(wrapper.text()).toContain('@louisdo');
    expect(wrapper.text()).toContain('Building a stronger Scope adventure graph.');
    expect(wrapper.text()).toContain('planner');
    expect(wrapper.text()).toContain('food');
    expect(wrapper.find('.stat-list').exists()).toBe(false);
    expect(wrapper.find('.actions').exists()).toBe(false);
    expect(wrapper.find('.presence-pill').exists()).toBe(false);
  });

  it.each([
    ['online', 'Online'],
    ['offline', 'Offline'],
  ] as const)('labels %s presence states', (presence, label) => {
    const wrapper = mount(UserCard, {
      props: {
        user,
        presence,
      },
    });

    expect(wrapper.text()).toContain(label);
  });

  it('uses stat fallbacks, unknown presence fallback, and single-action layouts', async () => {
    const wrapper = mount(UserCard, {
      props: {
        user: {
          ...user,
          stats: {},
        },
        presence: 'mystery' as never,
        primaryActionLabel: 'Follow',
      },
    });

    expect(wrapper.find('.presence-pill').text()).toBe('');
    expect(wrapper.text()).toContain('0');
    expect(wrapper.find('.eyebrow').exists()).toBe(false);
    expect(wrapper.findAll('button')).toHaveLength(1);

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('primary-action')?.[0]).toEqual(['user-1']);
  });
});
