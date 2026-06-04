import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const {
  authStoreSeed,
  authStoreController,
  routeMock,
  userStoreMock,
  listFriendsMock,
  listPublicTripsMock,
  listSavedSpotsMock,
  listUserSpotsMock,
} = vi.hoisted(() => ({
  authStoreSeed: {
    currentUser: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    },
  },
  authStoreController: {
    current: null as null | {
      currentUser: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        interests: string[];
      } | null;
    },
  },
  routeMock: {
    params: {
      id: 'user-1',
    },
  },
  userStoreMock: {
    fetchCurrentProfile: vi.fn(),
    fetchProfile: vi.fn(),
  },
  listFriendsMock: vi.fn(),
  listPublicTripsMock: vi.fn(),
  listSavedSpotsMock: vi.fn(),
  listUserSpotsMock: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  const routeState = reactive(routeMock);

  return {
    ...actual,
    useRoute: () => routeState,
  };
});

vi.mock('@/stores/auth', async () => {
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  const authStore = reactive(authStoreSeed);
  authStoreController.current = authStore;

  return {
    useAuthStore: () => authStore,
  };
});

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

vi.mock('@/services/friendService', () => ({
  listFriends: listFriendsMock,
}));

vi.mock('@/services/spotService', () => ({
  listSavedSpots: listSavedSpotsMock,
  listUserSpots: listUserSpotsMock,
}));

vi.mock('@/services/tripService', () => ({
  listPublicTrips: listPublicTripsMock,
}));

import ProfilePage from '@/views/ProfilePage.vue';

describe('ProfilePage current-user sync', () => {
  beforeEach(() => {
    const currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    };
    authStoreSeed.currentUser = currentUser;
    if (authStoreController.current) {
      authStoreController.current.currentUser = currentUser;
    }
    userStoreMock.fetchCurrentProfile.mockReset();
    userStoreMock.fetchCurrentProfile.mockResolvedValue({
      ...currentUser,
      homeBase: 'Fort Worth, TX',
    });
    userStoreMock.fetchProfile.mockReset();
    listFriendsMock.mockResolvedValue({ data: [] });
    listPublicTripsMock.mockResolvedValue({ data: [] });
    listSavedSpotsMock.mockResolvedValue({ data: [] });
    listUserSpotsMock.mockResolvedValue({ data: [] });
  });

  it('keeps the displayed own profile synchronized with current auth user changes', async () => {
    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ProfileAdventureCard: { template: '<article />' },
          ProfileHeader: {
            props: ['user'],
            template: '<section data-test="profile-header">{{ user.displayName }} {{ user.interests.join(",") }}</section>',
          },
          ProfileMap: { template: '<section data-test="profile-map" />' },
          ProfileStats: { template: '<section />' },
          ProfileWorkspaceSkeleton: { template: '<section />' },
          RouterLink: { template: '<a><slot /></a>' },
          ScopeIcon: { template: '<span />' },
          SpotCard: { template: '<article />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Louis Do');

    authStoreController.current!.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Updated',
      interests: ['scenic'],
    };
    await nextTick();

    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Louis Updated');
    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('scenic');
  });
});
