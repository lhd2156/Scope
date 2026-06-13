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
  const mountProfileHeader = (props: InstanceType<typeof ProfileHeader>['$props']) => mount(ProfileHeader, {
    props,
    global: {
      stubs: {
        LazyImage: {
          props: ['src', 'alt'],
          template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
        },
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : \'/mock\'"><slot /></a>',
        },
      },
    },
  });

  it('renders the centered identity layout, travel interests, and action links', () => {
    const wrapper = mountProfileHeader({
      user,
      isCurrentUser: true,
      primaryActionLabel: 'Edit preferences',
      primaryActionTo: '/settings',
      secondaryActionLabel: 'View friends',
      secondaryActionTo: '/friends',
    });

    expect(wrapper.text()).toContain('Your scope');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('@louisdo');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('Edit preferences');
    expect(wrapper.text()).toContain('View friends');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.find('.avatar-ring').exists()).toBe(true);
  });

  it('renders fallback identity copy, avatar media, and presence states for other travelers', async () => {
    const wrapper = mountProfileHeader({
      user: {
        id: 'user-2',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        bio: '  ',
        homeBase: '',
        avatarUrl: '  https://images.example.com/maya.jpg  ',
        interests: ['adventure', 'unknown-interest'],
        stats: { spots: 0, trips: 0, friends: 0 },
      },
      presence: 'planning',
      primaryActionLabel: 'Add friend',
      primaryActionTo: { name: 'profile', params: { id: 'user-2' } },
    });

    expect(wrapper.text()).not.toContain('Your scope');
    expect(wrapper.text()).toContain('No location');
    expect(wrapper.text()).toContain('Building a Scope footprint one memorable pin at a time.');
    expect(wrapper.text()).toContain('Planning now');
    expect(wrapper.find('.avatar-presence--planning').exists()).toBe(true);
    expect(wrapper.find('.lazy-image-stub').attributes('src')).toBe('https://images.example.com/maya.jpg');
    expect(wrapper.find('.badge-adventure').exists()).toBe(true);
    expect(wrapper.find('.badge-other').exists()).toBe(true);

    await wrapper.setProps({ presence: 'hidden' });
    expect(wrapper.text()).toContain('Activity hidden');
    expect(wrapper.find('.presence-chip--hidden').exists()).toBe(true);

    await wrapper.setProps({ presence: 'idle' });
    expect(wrapper.text()).toContain('Idle');
    expect(wrapper.find('.avatar-presence--idle').exists()).toBe(true);

    await wrapper.setProps({ presence: 'offline' });
    expect(wrapper.text()).toContain('Offline');
    expect(wrapper.find('.avatar-presence--offline').exists()).toBe(true);

    await wrapper.setProps({ presence: undefined });
    expect(wrapper.find('.presence-chip').exists()).toBe(false);
  });

  it('turns safe bio URLs into external links without breaking long copy layout', () => {
    const wrapper = mountProfileHeader({
      user: {
        ...user,
        bio: 'Routes at https://example.com/scope-trips and www.scopetrips.com/profile.',
      },
      primaryActionLabel: 'Edit preferences',
      primaryActionTo: '/settings',
    });

    const links = wrapper.findAll('.bio-copy__link');

    expect(links).toHaveLength(2);
    expect(links[0].text()).toBe('https://example.com/scope-trips');
    expect(links[0].attributes('href')).toBe('https://example.com/scope-trips');
    expect(links[0].attributes('target')).toBe('_blank');
    expect(links[0].attributes('rel')).toBe('noopener noreferrer');
    expect(links[1].text()).toBe('www.scopetrips.com/profile');
    expect(links[1].attributes('href')).toBe('https://www.scopetrips.com/profile');
    expect(wrapper.text()).toContain('profile.');
  });

  it('keeps unsafe or punctuation-trimmed bio URLs as stable text/link segments', () => {
    const wrapper = mountProfileHeader({
      user: {
        ...user,
        bio: 'Saved list: https://example.com/trips). Broken link: http://,',
      },
      primaryActionLabel: 'Edit preferences',
      primaryActionTo: '/settings',
    });

    const links = wrapper.findAll('.bio-copy__link');

    expect(links).toHaveLength(1);
    expect(links[0].text()).toBe('https://example.com/trips');
    expect(links[0].attributes('href')).toBe('https://example.com/trips');
    expect(wrapper.text()).toContain(').');
    expect(wrapper.text()).toContain('http://,');
  });
});
