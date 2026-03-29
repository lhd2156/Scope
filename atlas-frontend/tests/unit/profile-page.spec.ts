import { flushPromises, mount } from '@vue/test-utils';

const { fixtures, authStoreMock, userStoreMock, listUserSpotsMock, listPublicTripsMock } = vi.hoisted(() => ({
  fixtures: {
    profile: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture'],
    },
    spots: [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
        category: 'food',
        city: 'Fort Worth',
        latitude: 32.7555,
        longitude: -97.3308,
        rating: 4.8,
        createdAt: '2026-03-29T03:00:00Z',
      },
      {
        id: 'spot-2',
        title: 'Design District Gallery Row',
        category: 'culture',
        city: 'Dallas',
        latitude: 32.7821,
        longitude: -96.8123,
        rating: 4.7,
        createdAt: '2026-03-28T03:00:00Z',
      },
    ],
    trips: [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        destination: 'Fort Worth, TX',
        startDate: '2026-03-29',
        endDate: '2026-03-30',
        isPublic: true,
        members: [{ id: 'user-1' }, { id: 'user-2' }],
        spots: [],
      },
    ],
  },
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    },
  },
  userStoreMock: {
    fetchCurrentProfile: vi.fn(),
    fetchProfile: vi.fn(),
  },
  listUserSpotsMock: vi.fn(),
  listPublicTripsMock: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');

  return {
    ...actual,
    useRoute: () => ({
      params: {
        id: 'user-1',
      },
    }),
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  listUserSpots: listUserSpotsMock,
}));

vi.mock('@/services/tripService', () => ({
  listPublicTrips: listPublicTripsMock,
}));

import ProfilePage from '@/views/ProfilePage.vue';

describe('ProfilePage', () => {
  beforeEach(() => {
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    };
    userStoreMock.fetchCurrentProfile.mockReset().mockResolvedValue(fixtures.profile);
    userStoreMock.fetchProfile.mockReset().mockResolvedValue(fixtures.profile);
    listUserSpotsMock.mockReset().mockResolvedValue({
      data: fixtures.spots,
    });
    listPublicTripsMock.mockReset().mockResolvedValue({
      data: fixtures.trips,
    });
  });

  it('renders the profile workspace with fetched highlights and trips', async () => {
    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
          ProfileHeader: { props: ['user'], template: '<div data-test="profile-header">{{ user.displayName }}</div>' },
          ProfileMap: { props: ['description'], template: '<div data-test="profile-map">{{ description }}</div>' },
          ProfileStats: { template: '<div data-test="profile-stats">Stats</div>' },
          SpotCard: { props: ['spot'], template: '<div class="spot-card-stub">{{ spot.title }}</div>' },
          TripCard: { props: ['trip'], template: '<div class="trip-card-stub">{{ trip.title }}</div>' },
        },
      },
    });

    await flushPromises();

    expect(userStoreMock.fetchCurrentProfile).toHaveBeenCalledTimes(1);
    expect(listUserSpotsMock).toHaveBeenCalledWith('user-1', 1, 12);
    expect(listPublicTripsMock).toHaveBeenCalledWith(1, 24);
    expect(wrapper.text()).toContain('Adventure map and public highlights');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Design District Gallery Row');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.find('[data-test="profile-map"]').text()).toContain('Louis Do has 2 visible pins across 2 mapped cities.');
  });

  it('shows an error state when the profile contract cannot be loaded', async () => {
    authStoreMock.currentUser = {
      id: 'user-9',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      interests: ['scenic'],
    };
    userStoreMock.fetchProfile.mockRejectedValueOnce(new Error('Profile offline'));

    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Atlas could not open this profile workspace');
    expect(wrapper.text()).toContain('Profile offline');
  });
});
