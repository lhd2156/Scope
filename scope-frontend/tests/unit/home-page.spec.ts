import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock, feedStoreMock, spotsStoreMock, onboardingStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
  },
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
    fetchHomeActivityFeed: vi.fn().mockResolvedValue(undefined),
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
  onboardingStoreMock: {
    hasCompleted: false,
    start: vi.fn(),
    startIfPending: vi.fn(),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => feedStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

import HomePage from '@/views/HomePage.vue';

function mountHomePage(overrides: Record<string, unknown> = {}) {
  return mount(HomePage, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        LazyImage: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
        ForYouSection: { template: '<section data-test="for-you-section-stub" />' },
        NearbySpots: { template: '<section data-test="nearby-spots-stub" />' },
        ...overrides,
      },
    },
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    authStoreMock.isAuthenticated = true;
    feedStoreMock.items = [
      {
        id: 'feed-1',
        type: 'spot',
        title: 'Louis pinned Sunset Rooftop Tacos',
      },
    ];
    feedStoreMock.error = '';
    feedStoreMock.loading = false;
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
    spotsStoreMock.loading = false;
    onboardingStoreMock.hasCompleted = false;
    feedStoreMock.fetchFeed.mockReset().mockResolvedValue(undefined);
    feedStoreMock.fetchHomeActivityFeed.mockReset().mockResolvedValue(undefined);
    spotsStoreMock.fetchTrending.mockReset().mockResolvedValue(undefined);
    onboardingStoreMock.start.mockReset();
    onboardingStoreMock.startIfPending.mockReset();
  });

  it('loads the premium hero, featured spots, and network activity into the landing page', async () => {
    const wrapper = mountHomePage({
      SpotCard: {
        props: ['spot'],
        template: '<div class="spot-card-stub">{{ spot.title }}</div>',
      },
      FeedItem: {
        props: ['item'],
        template: '<div class="feed-item-stub">{{ item.title }}</div>',
      },
    });

    await flushPromises();

    expect(onboardingStoreMock.startIfPending).toHaveBeenCalledTimes(1);
    expect(spotsStoreMock.fetchTrending).toHaveBeenCalledTimes(1);
    expect(feedStoreMock.fetchHomeActivityFeed).toHaveBeenCalledTimes(1);
    expect(feedStoreMock.fetchFeed).not.toHaveBeenCalled();
    expect(wrapper.find('.hero-band').exists()).toBe(true);
    expect(wrapper.find('.hero-band__image').exists()).toBe(true);
    expect(wrapper.find('.hero-heading').text()).toContain('Find a place worth going.');
    expect(wrapper.text()).toContain('Save the spots you trust, see what people are sharing, and build the route from there.');
    expect(wrapper.text()).toContain('Explore spots');
    expect(wrapper.text()).toContain('See activity');
    expect(wrapper.text()).toContain('Start tour');
    expect(wrapper.text()).toContain('Trending Destinations');
    expect(wrapper.text()).toContain('Activity Feed');
    expect(wrapper.text()).toContain('Connect with travelers and keep the journey alive between trips.');
    expect(wrapper.text()).toContain('Open Friends hub');
    expect(wrapper.get('[data-test="social-hub"]').attributes('data-onboarding-target')).toBe('social-hub');
    expect(wrapper.findAll('.spot-card-stub')).toHaveLength(2);
    expect(wrapper.findAll('.feed-item-stub')).toHaveLength(1);
  });

  it('switches the onboarding call-to-action copy to replay mode after completion', async () => {
    onboardingStoreMock.hasCompleted = true;

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Replay tour');
  });

  it('keeps the social onboarding callout hidden for signed-out visitors', async () => {
    authStoreMock.isAuthenticated = false;

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="social-hub"]').exists()).toBe(false);
  });

  it('shows reusable skeleton loaders while the home workspace is hydrating', () => {
    feedStoreMock.items = [];
    spotsStoreMock.featuredSpots = [];
    feedStoreMock.fetchHomeActivityFeed.mockImplementation(() => new Promise(() => {}));
    spotsStoreMock.fetchTrending.mockImplementation(() => new Promise(() => {}));

    const wrapper = mountHomePage();

    expect(wrapper.findAll('[data-test="spot-card-skeleton"]')).toHaveLength(4);
    expect(wrapper.findAll('[data-test="feed-item-skeleton"]')).toHaveLength(6);
  });

  it('caps network activity at the six curated homepage highlights', async () => {
    feedStoreMock.items = Array.from({ length: 8 }, (_, index) => ({
      id: `feed-${index + 1}`,
      type: 'review',
      title: `Traveler reviewed spot ${index + 1}`,
    }));

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: {
        props: ['item'],
        template: '<div class="feed-item-stub">{{ item.title }}</div>',
      },
    });

    await flushPromises();

    expect(feedStoreMock.fetchHomeActivityFeed).toHaveBeenCalledWith(false, 1, 6);
    expect(wrapper.findAll('.feed-item-stub')).toHaveLength(6);
    expect(wrapper.text()).toContain('Traveler reviewed spot 6');
    expect(wrapper.text()).not.toContain('Traveler reviewed spot 7');
  });

  it('shows empty discovery and activity states after both home rails resolve without content', async () => {
    feedStoreMock.items = [];
    spotsStoreMock.featuredSpots = [];

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Featured spots are waiting on the first pin drop');
    expect(wrapper.text()).toContain('Once travelers start surfacing standout places, Scope will spotlight them here first.');
    expect(wrapper.text()).toContain('No activity yet');
    expect(wrapper.text()).toContain('Once your network starts pinning spots and planning trips, the Scope feed will fill in here.');
    expect(wrapper.findAll('[data-test="spot-card-skeleton"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="feed-item-skeleton"]')).toHaveLength(0);
  });

  it('scrolls to the activity feed from the hero using motion-safe behavior', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === 'See activity')?.trigger('click');

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('starts the onboarding tour from the hero control', async () => {
    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();
    await wrapper.get('.hero-tour-link').trigger('click');

    expect(onboardingStoreMock.start).toHaveBeenCalledTimes(1);
  });

  it('does not start duplicate home rail requests while stores are already loading', async () => {
    feedStoreMock.loading = true;
    spotsStoreMock.loading = true;

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchTrending).not.toHaveBeenCalled();
    expect(feedStoreMock.fetchHomeActivityFeed).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Trending Destinations');
    expect(wrapper.text()).toContain('Activity Feed');
  });

  it('keeps release rails mounted without surfacing raw home feed failures', async () => {
    spotsStoreMock.error = 'Scope could not load trending spots right now.';
    spotsStoreMock.fetchTrending.mockRejectedValue(new Error('Trending failed'));
    feedStoreMock.items = [];
    spotsStoreMock.featuredSpots = [];

    const wrapper = mountHomePage({
      SpotCard: { template: '<div />' },
      FeedItem: { template: '<div />' },
    });

    await flushPromises();

    expect(wrapper.text()).not.toContain('Part of the Scope home feed could not be loaded');
    expect(wrapper.text()).not.toContain('Scope could not load trending spots right now.');
    expect(wrapper.text()).toContain('Featured spots are waiting on the first pin drop');
    expect(wrapper.text()).toContain('No activity yet');
  });
});
