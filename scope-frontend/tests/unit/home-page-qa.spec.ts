import { flushPromises, mount } from '@vue/test-utils';

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
    featuredSpots: [],
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
  isScopeQaMode: () => true,
}));

import HomePage from '@/views/HomePage.vue';

function mountHomePage() {
  return mount(HomePage, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        ForYouSection: { template: '<section data-test="for-you-section-stub" />' },
        NearbySpots: { template: '<section data-test="nearby-spots-stub" />' },
      },
    },
  });
}

describe('HomePage QA preview', () => {
  beforeEach(() => {
    feedStoreMock.fetchFeed.mockClear();
    spotsStoreMock.fetchTrending.mockClear();
    onboardingStoreMock.start.mockClear();
    onboardingStoreMock.startIfPending.mockClear();
  });

  it('renders the lightweight QA preview and skips expensive home rail loading', async () => {
    const wrapper = mountHomePage();

    await flushPromises();

    expect(wrapper.text()).toContain('Scope preview');
    expect(wrapper.text()).toContain('Discovery rails, social proof, and live feed detail load after the first meaningful interaction.');
    expect(wrapper.text()).toContain('Scope keeps the homepage focused on the hero entry point');
    expect(wrapper.findAll('a[href="/explore"]').map((link) => link.text())).toContain('Browse discovery');
    expect(wrapper.get('a[href="/login"]').text()).toBe('Open travel circle');
    expect(wrapper.text()).not.toContain('Trending Destinations');
    expect(wrapper.text()).not.toContain('Activity Feed');
    expect(onboardingStoreMock.startIfPending).not.toHaveBeenCalled();
    expect(spotsStoreMock.fetchTrending).not.toHaveBeenCalled();
    expect(feedStoreMock.fetchFeed).not.toHaveBeenCalled();
  });
});
