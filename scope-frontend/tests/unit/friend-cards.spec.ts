import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FriendCard from '@/components/friends/FriendCard.vue';
import RequestCard from '@/components/friends/RequestCard.vue';
import SuggestionCard from '@/components/friends/SuggestionCard.vue';

const stubs = {
  Avatar: {
    props: ['name'],
    template: '<span class="avatar-stub">{{ name }}</span>',
  },
  LazyImage: {
    props: ['src', 'alt'],
    template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
  },
  ScopeIcon: {
    props: ['name'],
    template: '<span class="scope-icon-stub" :data-icon="name" />',
  },
};

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Routes',
    homeBase: 'Fort Worth, TX',
    interests: ['food'],
    ...overrides,
  };
}

describe('friend social cards', () => {
  it('opens friend profiles from pointer and keyboard interactions with presence copy', async () => {
    const wrapper = mount(FriendCard, {
      props: {
        connection: {
          id: 'connection-1',
          user: user(),
          presence: 'planning',
          nextAdventure: '',
          sharedTrips: 2,
          mutualFriends: 4,
          favoriteCategories: ['food'],
        },
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Planning a trip');
    expect(wrapper.text()).toContain('Ready for the next itinerary.');

    await wrapper.get('[data-test="friend-card"]').trigger('keydown.enter');
    await wrapper.get('[data-test="view-profile-user-1"]').trigger('click');

    expect(wrapper.emitted('open')).toEqual([['user-1'], ['user-1']]);
  });

  it('uses friend offline and hidden fallback labels', () => {
    const lastActive = mount(FriendCard, {
      props: {
        connection: {
          id: 'connection-last-active',
          user: user({ id: 'user-last', username: 'last', displayName: 'Last Active', homeBase: '' }),
          presence: 'offline',
          lastActiveAt: '2026-05-02T12:00:00Z',
          sharedTrips: 0,
          mutualFriends: 0,
          favoriteCategories: [],
        },
      },
      global: { stubs },
    });
    const hidden = mount(FriendCard, {
      props: {
        connection: {
          id: 'connection-hidden',
          user: user({ id: 'user-hidden', username: 'hidden', displayName: 'Hidden Friend', homeBase: '' }),
          presence: 'hidden',
          sharedTrips: 0,
          mutualFriends: 0,
          favoriteCategories: [],
        },
      },
      global: { stubs },
    });

    expect(lastActive.text()).toContain('Active May 2');
    expect(lastActive.text()).toContain('Scope traveler');
    expect(hidden.text()).toContain('Activity hidden');
  });

  it('emits request card open, accept, and decline actions while formatting fallbacks', async () => {
    const wrapper = mount(RequestCard, {
      props: {
        request: {
          id: 'request-1',
          user: user({ id: 'request-user', username: 'request', displayName: 'Request User', homeBase: '' }),
          direction: 'incoming',
          createdAt: '2026-05-02T12:00:00Z',
          mutualFriends: 1,
        },
        categories: ['food', 'culture', 'nature'],
        coverPhoto: 'https://images.example.com/request.jpg',
        saving: false,
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Scope traveler');
    expect(wrapper.text()).toContain('Ready to plan a route together.');
    expect(wrapper.text()).toContain('1 mutual friend');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).toContain('Culture');
    expect(wrapper.text()).not.toContain('Nature');

    await wrapper.get('[data-test="request-card"]').trigger('keydown.space');
    await wrapper.get('[data-test="accept-request-request-1"]').trigger('click');
    await wrapper.get('[data-test="decline-request-request-1"]').trigger('click');

    expect(wrapper.emitted('open')).toEqual([['request-user']]);
    expect(wrapper.emitted('accept')).toEqual([['request-1']]);
    expect(wrapper.emitted('decline')).toEqual([['request-1']]);
  });

  it('emits suggestion card open/send actions and renders discover fallback metadata', async () => {
    const suggestedUser = user({ id: 'suggested-user', username: 'suggested', displayName: 'Suggested User', homeBase: '' });
    const wrapper = mount(SuggestionCard, {
      props: {
        user: suggestedUser,
        reason: 'Shared saved routes',
        categories: ['scenic'],
        mutualFriends: 0,
        sharedInterests: [],
        actionLabel: 'Add friend',
        viewTestId: 'view-suggested-user',
        sendTestId: 'send-suggested-user',
        variant: 'discover',
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('0 mutual friends');
    expect(wrapper.text()).toContain('Fresh vibe match');
    expect(wrapper.text()).toContain('Scope traveler');
    expect(wrapper.text()).toContain('Scenic');

    await wrapper.get('[data-test="suggestion-card"]').trigger('keydown.enter');
    await wrapper.get('[data-test="view-suggested-user"]').trigger('click');
    await wrapper.get('[data-test="send-suggested-user"]').trigger('click');

    expect(wrapper.emitted('open')).toEqual([['suggested-user'], ['suggested-user']]);
    expect(wrapper.emitted('send')).toEqual([[suggestedUser]]);
  });
});
