import { flushPromises, mount } from '@vue/test-utils';

const { feedStoreMock, spotsStoreMock } = vi.hoisted(() => ({
  feedStoreMock: {
    items: [
      {
        id: 'feed-1',
        type: 'spot',
        title: 'Louis pinned Sunset Rooftop Tacos',
      },
    ],
    loading: false,
    fetchFeed: vi.fn().mockResolvedValue(undefined),
  },
  spotsStoreMock: {
    featuredSpots: [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
      },
      {
        id: 'spot-2',
        title: 'Botanic River Walk',
      },
    ],
    fetchTrending: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => feedStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

import HomePage from '@/views/HomePage.vue';

describe('HomePage', () => {
  beforeEach(() => {
    feedStoreMock.fetchFeed.mockClear();
    spotsStoreMock.fetchTrending.mockClear();
  });

  it('loads featured spots and network activity into the landing page', async () => {
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotCard: {
            props: ['spot'],
            template: '<div class="spot-card-stub">{{ spot.title }}</div>',
          },
          FeedItem: {
            props: ['item'],
            template: '<div class="feed-item-stub">{{ item.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchTrending).toHaveBeenCalledTimes(1);
    expect(feedStoreMock.fetchFeed).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Atlas turns every outing into a mapped story worth sharing.');
    expect(wrapper.findAll('.spot-card-stub')).toHaveLength(2);
    expect(wrapper.findAll('.feed-item-stub')).toHaveLength(1);
  });
});
