import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const {
  authStoreMock,
  routeMock,
  routerPushMock,
  searchLocationsMock,
  userStoreMock,
} = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      homeBase: 'Fort Worth, TX',
      interests: ['food'],
    } as any,
    updateCurrentUser: vi.fn(),
  },
  routeMock: {
    query: {} as Record<string, unknown>,
  },
  routerPushMock: vi.fn().mockResolvedValue(undefined),
  searchLocationsMock: vi.fn(),
  userStoreMock: {
    saveProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

vi.mock('@/services/mapService', () => ({
  searchLocations: searchLocationsMock,
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => routeMock,
    useRouter: () => ({ push: routerPushMock }),
  };
});

import OnboardingPreferencesPage from '@/views/OnboardingPreferencesPage.vue';

function mountOnboardingPreferencesPage() {
  return mount(OnboardingPreferencesPage, {
    global: {
      stubs: {
        Avatar: { props: ['name', 'src'], template: '<div class="avatar-stub">{{ name }} {{ src }}</div>' },
        Button: { template: '<button><slot /></button>' },
        ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
        Transition: false,
      },
    },
  });
}

describe('OnboardingPreferencesPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    authStoreMock.currentUser = {
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      homeBase: 'Fort Worth, TX',
      interests: ['food'],
    };
    authStoreMock.updateCurrentUser.mockClear();
    routeMock.query = {};
    routerPushMock.mockClear();
    routerPushMock.mockResolvedValue(undefined);
    searchLocationsMock.mockReset();
    userStoreMock.saveProfile.mockClear();
    userStoreMock.saveProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('selects home-base suggestions and persists signed-in onboarding preferences', async () => {
    const wrapper = mountOnboardingPreferencesPage();
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          id: '',
          providerPlaceId: 'provider-austin',
          placeName: 'Austin',
          formattedAddress: 'Austin, TX, USA',
          city: 'Austin',
          country: 'US',
          precision: 'city',
          latitude: 30.2672,
          longitude: -97.7431,
        },
        {
          id: 'duplicate',
          providerPlaceId: 'provider-austin',
          placeName: 'Austin duplicate',
          formattedAddress: 'Austin, TX, USA',
          city: 'Austin',
          country: 'US',
          precision: 'locality',
          latitude: 30.2672,
          longitude: -97.7431,
        },
        {
          id: 'zip',
          placeName: '',
          address: '78701',
          formattedAddress: '',
          city: 'Austin',
          country: 'US',
          precision: 'postcode',
          latitude: 30.27,
          longitude: -97.74,
        },
        {
          id: 'blank',
          placeName: '',
          formattedAddress: '',
          address: '',
          latitude: 0,
          longitude: 0,
        },
      ],
    });

    coverage.homeBase.value = 'Austin';
    await nextTick();
    coverage.clearHomeBaseSearchTimer();
    coverage.handleHomeBaseFocus();
    await coverage.loadHomeBaseSuggestions('Austin');
    await nextTick();

    expect(searchLocationsMock).toHaveBeenCalledWith('Austin', expect.objectContaining({
      limit: 6,
      preferPoi: false,
      sortByDistance: false,
    }));
    expect(read(coverage.homeBaseSearchState)).toBe('ready');
    expect(read<Array<unknown>>(coverage.homeBaseSuggestions)).toHaveLength(2);
    expect(read(coverage.homeBaseStatusCopy)).toBe('2 matches');
    expect(read(coverage.showHomeBaseSuggestions)).toBe(true);
    expect(coverage.getHomeBaseSuggestionName({})).toBe('Location match');
    expect(coverage.getHomeBaseSuggestionMeta({
      placeName: 'Austin',
      formattedAddress: 'Austin',
      city: 'Austin',
      country: 'US',
    })).toBe('Austin, US');
    expect(coverage.getHomeBaseSuggestionMeta({ placeName: 'Austin', formattedAddress: 'Austin' })).toBe('Verified location');
    expect(coverage.getHomeBaseSuggestionType({ precision: 'street' })).toBe('Address');
    expect(coverage.getHomeBaseSuggestionType({ precision: 'neighborhood' })).toBe('Area');
    expect(coverage.getHomeBaseSuggestionType({ precision: 'postcode' })).toBe('ZIP');
    expect(coverage.getHomeBaseSuggestionType({ precision: 'place' })).toBe('City');
    expect(coverage.getHomeBaseSuggestionType({ precision: 'unknown' })).toBe('Place');
    expect(read(coverage.activeHomeBaseOptionId)).toBe('home-base-suggestions-option-0');

    const preventDefault = vi.fn();
    coverage.handleHomeBaseKeydown({ key: 'ArrowDown', preventDefault } as unknown as KeyboardEvent);
    expect(read(coverage.activeHomeBaseIndex)).toBe(1);
    coverage.handleHomeBaseKeydown({ key: 'ArrowUp', preventDefault } as unknown as KeyboardEvent);
    expect(read(coverage.activeHomeBaseIndex)).toBe(0);
    coverage.handleHomeBaseKeydown({ key: 'Enter', preventDefault } as unknown as KeyboardEvent);
    expect(read(coverage.homeBase)).toBe('Austin, TX');
    expect(read(coverage.selectedHomeBaseLabel)).toBe('Austin, TX');
    expect(read(coverage.homeBaseSearchState)).toBe('selected');

    coverage.homeBase.value = 'Manual place';
    coverage.handleHomeBaseKeydown({ key: 'Escape', preventDefault } as unknown as KeyboardEvent);
    expect(read(coverage.homeBaseSearchState)).toBe('typing');
    expect(read(coverage.showHomeBaseSuggestions)).toBe(false);
    coverage.clearHomeBase();
    expect(read(coverage.homeBase)).toBe('');
    expect(read(coverage.homeBaseHelperCopy)).toBe('Start typing to find the best match.');

    expect(read(coverage.selectionHelperCopy)).toBe('Optional. 1 vibe selected.');
    coverage.toggleInterest('food');
    expect(read(coverage.selectionHelperCopy)).toBe('Optional. Smart defaults if skipped.');
    coverage.toggleInterest('culture');
    coverage.toggleInterest('scenic');
    expect(read(coverage.selectionHelperCopy)).toBe('Optional. 2 vibes selected.');

    coverage.homeBase.value = 'Dallas, TX';
    await coverage.persistPreferenceUpdate();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['culture', 'scenic'],
      homeBase: 'Dallas, TX',
      avatarUrl: undefined,
    });
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      interests: ['culture', 'scenic'],
      homeBase: 'Dallas, TX',
      avatarUrl: undefined,
    }, 'user-1');
  });

  it('validates profile photos, falls back on unsafe redirects, and reports save failures', async () => {
    routeMock.query = { redirect: 'https://evil.example/path' };
    userStoreMock.saveProfile.mockRejectedValueOnce(new Error('profile offline'));
    const createObjectURL = vi.fn(() => 'blob:profile-photo');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    const wrapper = mountOnboardingPreferencesPage();
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(coverage.resolveRedirectTarget()).toBe('/');
    expect(coverage.validateProfilePhotoFile(new File(['x'], 'avatar.txt', { type: 'text/plain' }))).toBe(
      'Choose a JPG, PNG, WebP, or GIF profile photo.',
    );
    expect(coverage.validateProfilePhotoFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }))).toBe(
      'Profile photo must be 5 MB or smaller.',
    );

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['photo'], 'avatar.jpg', { type: 'image/jpeg' })],
    });
    coverage.handleProfilePhotoSelection({ target: input } as unknown as Event);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(read(coverage.profilePhotoPreview)).toBe('blob:profile-photo');

    coverage.clearProfilePhoto();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile-photo');
    expect(read(coverage.profilePhotoPreview)).toBe('');

    await coverage.submit();
    await flushPromises();
    expect(read(coverage.formError)).toBe('Scope could not save your preferences. Try once more in a moment.');
    expect(routerPushMock).not.toHaveBeenCalled();
    expect(read(coverage.isSubmitting)).toBe(false);
  });

  it('keeps guest preference persistence local and lets skips preserve current choices', async () => {
    authStoreMock.currentUser = null;
    routeMock.query = { redirect: '/map?spotId=spot-1' };

    const wrapper = mountOnboardingPreferencesPage();
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    coverage.homeBase.value = 'Fort Worth, TX';
    coverage.selectedInterests.value = ['food', 'nightlife'];
    await coverage.skip();
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['food', 'nightlife'],
      homeBase: 'Fort Worth, TX',
      avatarUrl: undefined,
    });
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
    expect(routerPushMock).toHaveBeenCalledWith('/map?spotId=spot-1');
    expect(read(coverage.isSubmitting)).toBe(false);
  });
});
