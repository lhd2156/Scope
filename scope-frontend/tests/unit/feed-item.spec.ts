import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedItem from '@/components/social/FeedItem.vue';
import type { FeedItem as FeedItemModel } from '@/types';

const item: FeedItemModel = {
  id: 'feed-1',
  type: 'trip',
  actor: {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    homeBase: 'Fort Worth, TX',
    bio: 'Scope planner',
    interests: ['food', 'culture'],
    stats: { spots: 42, trips: 8, friends: 126 },
  },
  title: 'Louis planned North Texas Night + Food Loop',
  excerpt: 'A two-day itinerary built around food, culture, and nightlife.',
  createdAt: '2026-03-26T18:05:00Z',
  imageUrl: 'https://images.example.com/trip.jpg',
  targetId: 'trip-1',
};

describe('FeedItem', () => {
  beforeEach(() => {
    // FeedItem now touches the auth and toast pinia stores (for gated
    // engagement state). Without an active pinia the component throws
    // on setup, so give the test its own scratch store instance.
    setActivePinia(createPinia());
  });

  it('renders a premium social feed card with travel media and engagement actions', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item,
      },
      global: {
        stubs: {
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Planned a route');
    expect(wrapper.text()).toContain('Louis Do planned North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Route snapshot');
    expect(wrapper.text()).toContain('A two-day itinerary built around food, culture, and nightlife.');
    expect(wrapper.text()).toContain('Trip update');
    expect(wrapper.text()).toContain('Open trip');
    expect(wrapper.findAll('.action-button')).toHaveLength(3);
    expect(wrapper.find('.feed-media .lazy-image-stub').attributes('alt')).toBe('Louis planned North Texas Night + Food Loop');
    expect(wrapper.find('.meta-divider').exists()).toBe(false);
  });

  it('keeps a readable actor name when the activity title already contains a partial name', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          actor: {
            ...item.actor,
            username: 'maya',
            displayName: 'Maya Chen',
          },
          title: 'Maya pinned Botanic River Walk',
        },
      },
      global: {
        stubs: {
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Maya Chen pinned Botanic River Walk');
  });
});
