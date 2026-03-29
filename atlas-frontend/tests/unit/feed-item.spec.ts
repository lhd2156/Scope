import { mount } from '@vue/test-utils';
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
    bio: 'Atlas planner',
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
  it('renders a premium social card for feed activity', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item,
      },
    });

    expect(wrapper.text()).toContain('Louis planned North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Trip plan');
    expect(wrapper.text()).toContain('View trip');
    expect(wrapper.text()).toContain('42 spots');
  });
});
