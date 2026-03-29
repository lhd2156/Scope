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
    error: '',
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
    loading: false,
    error: '',
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
    feedStoreMock.items = [
      {
        id: 'feed-1',
        type: 'spot',
        title: 'Louis pinned Sunset Rooftop Tacos',
      },
    ];
    feedStoreMock.error = '';
    spotsStoreMock.featuredSpots = [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
      },
      {
        id: 'spot-2',
        title: 'Botanic River Walk',
      },
    ];
    spotsStoreMock.error = '';
    feedStoreMock.fetchFeed.mockReset().mockResolvedValue(undefined);
    spotsStoreMock.fetchTrending.mockReset().mockResolvedValue(undefined);
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

  it('shows reusable skeleton loaders while the home workspace is hydrating', () => {
    feedStoreMock.items = [];
    spotsStoreMock.featuredSpots = [];
    feedStoreMock.fetchFeed.mockImplementation(() => new Promise(() => {}));
    spotsStoreMock.fetchTrending.mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.findAll('[data-test="spot-card-skeleton"]')).toHaveLength(4);
    expect(wrapper.findAll('[data-test="feed-item-skeleton"]')).toHaveLength(3);
  });

  it('shows an inline error panel when a home feed request fails', async () => {
    spotsStoreMock.error = 'Atlas could not load trending spots right now.';
    spotsStoreMock.fetchTrending.mockRejectedValue(new Error('Trending failed'));

    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotCard: { template: '<div />' },
          FeedItem: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Part of the Atlas home feed could not be loaded');
    expect(wrapper.text()).toContain('Atlas could not load trending spots right now.');
  });
});
