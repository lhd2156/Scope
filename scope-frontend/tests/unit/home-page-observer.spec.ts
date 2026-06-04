import { flushPromises, mount } from '@vue/test-utils';

type FakeObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
};

const { authStoreMock, feedStoreMock, spotsStoreMock, onboardingStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
  },
  feedStoreMock: {
    items: [],
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

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => false,
}));

vi.mock('@/utils/scheduleNonCriticalTask', () => ({
  isUiTestEnvironment: () => false,
}));

import HomePage from '@/views/HomePage.vue';

const observers: FakeObserverRecord[] = [];
const originalIntersectionObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');

class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  disconnect = vi.fn();
  observe = vi.fn();
  options?: IntersectionObserverInit;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }
}

function mountHomePage() {
  return mount(HomePage, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        SpotCard: {
          props: ['spot'],
          template: '<div class="spot-card-stub">{{ spot.title }}</div>',
        },
        FeedItem: {
          props: ['item'],
          template: '<div class="feed-item-stub">{{ item.title }}</div>',
        },
        ForYouSection: { template: '<section data-test="for-you-section-stub" />' },
        NearbySpots: { template: '<section data-test="nearby-spots-stub" />' },
      },
    },
  });
}

describe('HomePage deferred feed loading', () => {
  beforeEach(() => {
    observers.length = 0;
    feedStoreMock.items = [];
    feedStoreMock.loading = false;
    feedStoreMock.error = '';
    feedStoreMock.fetchFeed.mockReset().mockResolvedValue(undefined);
    spotsStoreMock.featuredSpots = [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
      },
    ];
    spotsStoreMock.loading = false;
    spotsStoreMock.error = '';
    spotsStoreMock.fetchTrending.mockReset().mockResolvedValue(undefined);
    onboardingStoreMock.startIfPending.mockReset();
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: FakeIntersectionObserver,
    });
  });

  afterEach(() => {
    if (originalIntersectionObserverDescriptor) {
      Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserverDescriptor);
    } else {
      Reflect.deleteProperty(window, 'IntersectionObserver');
    }
  });

  it('waits for the activity rail to enter view before loading feed items and disconnects on cleanup', async () => {
    const wrapper = mountHomePage();

    await flushPromises();

    expect(onboardingStoreMock.startIfPending).toHaveBeenCalledTimes(1);
    expect(spotsStoreMock.fetchTrending).toHaveBeenCalledTimes(1);
    expect(feedStoreMock.fetchFeed).not.toHaveBeenCalled();
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(1);
    expect(observers[0].options).toMatchObject({
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.14,
    });

    observers[0].callback(
      [{ isIntersecting: true, intersectionRatio: 0.1 } as IntersectionObserverEntry],
      observers[0] as unknown as IntersectionObserver,
    );
    expect(feedStoreMock.fetchFeed).not.toHaveBeenCalled();

    observers[0].callback(
      [{ isIntersecting: true, intersectionRatio: 0.14 } as IntersectionObserverEntry],
      observers[0] as unknown as IntersectionObserver,
    );
    await flushPromises();

    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(feedStoreMock.fetchFeed).toHaveBeenCalledTimes(1);

    wrapper.unmount();

    expect(observers[0].disconnect).toHaveBeenCalledTimes(2);
  });
});
