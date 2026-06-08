import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, searchLocationsMock, userStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-42',
      username: 'scopedemo',
      email: 'demo@scope.travel',
      displayName: 'Local preview user',
      homeBase: '',
      avatarUrl: '',
      interests: [] as string[],
    },
    updateCurrentUser: vi.fn(),
  },
  searchLocationsMock: vi.fn(),
  userStoreMock: {
    saveProfile: vi.fn(),
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

import OnboardingPreferencesPage from '@/views/OnboardingPreferencesPage.vue';

describe('onboarding preferences page', () => {
  beforeEach(() => {
    authStoreMock.updateCurrentUser.mockClear();
    authStoreMock.currentUser.interests = [];
    authStoreMock.currentUser.homeBase = '';
    authStoreMock.currentUser.avatarUrl = '';
    searchLocationsMock.mockReset();
    searchLocationsMock.mockResolvedValue({ data: [] });
    userStoreMock.saveProfile.mockReset();
    userStoreMock.saveProfile.mockResolvedValue({ id: 'user-42' });
  });

  async function mountPage(fullPath = '/onboarding/preferences') {
    const destination = { template: '<div>Destination</div>' };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/onboarding/preferences',
          name: 'onboarding-preferences',
          component: OnboardingPreferencesPage,
        },
        { path: '/', component: destination },
        { path: '/profile/:id', component: destination },
      ],
    });

    await router.push(fullPath);
    await router.isReady();

    const wrapper = mount(OnboardingPreferencesPage, {
      global: {
        plugins: [router],
      },
    });

    return { wrapper, router };
  }

  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });

    return { promise, resolve, reject };
  }

  it('allows continue with smart defaults when no interests are selected', async () => {
    const { wrapper, router } = await mountPage();
    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton?.attributes('disabled')).toBeUndefined();

    await continueButton!.trigger('click');
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: [],
      homeBase: undefined,
      avatarUrl: undefined,
    });
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      interests: [],
      homeBase: undefined,
      avatarUrl: undefined,
    }, 'user-42');
    expect(router.currentRoute.value.fullPath).toBe('/');
  });

  it('allows selecting every vibe without enforcing a cap', async () => {
    const { wrapper } = await mountPage();
    const chips = wrapper.findAll('.preference-chip');

    for (const chip of chips) {
      await chip.trigger('click');
    }

    expect(wrapper.findAll('.preference-chip--active')).toHaveLength(chips.length);

    await chips[0].trigger('click');

    expect(wrapper.findAll('.preference-chip--active')).toHaveLength(chips.length - 1);
    expect(wrapper.text()).toContain(`Optional. ${chips.length - 1} vibes selected.`);
  });

  it('shows typing, empty, and failed preferred-location states without blocking manual entry', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = await mountPage();
      const input = wrapper.get('#home-base-input');

      await input.trigger('focus');
      await input.setValue('A');

      expect(wrapper.text()).toContain('Pick a suggestion or keep typing.');
      expect(wrapper.find('.home-base-suggestions').exists()).toBe(false);

      await input.setValue('zz');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();

      expect(wrapper.get('.home-base-combobox__status').text()).toBe('No matches');
      expect(wrapper.text()).toContain('No clean matches yet. Try a city, ZIP code, or nearby street.');

      searchLocationsMock.mockRejectedValueOnce(new Error('offline'));
      await input.setValue('broken');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();

      expect(wrapper.get('.home-base-combobox__status').text()).toBe('Manual entry');
      expect(wrapper.text()).toContain('Suggestions are not available right now. You can still type your location.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dedupes mixed location suggestions and exposes keyboard selection controls', async () => {
    vi.useFakeTimers();
    try {
      searchLocationsMock.mockResolvedValue({
        data: [
          {
            id: 'address-main',
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Main Street',
            formattedAddress: 'Main Street',
            city: 'Austin',
            country: 'United States',
            precision: 'address',
            source: 'mapbox',
          },
          {
            id: 'neighborhood-east',
            latitude: 30.264,
            longitude: -97.72,
            placeName: 'East Austin',
            formattedAddress: 'East Austin',
            city: 'Austin',
            country: 'United States',
            precision: 'neighborhood',
            source: 'mapbox',
          },
          {
            id: 'zip-78701',
            latitude: 30.271,
            longitude: -97.742,
            placeName: '78701',
            formattedAddress: '78701',
            city: 'Austin',
            country: 'United States',
            precision: 'postcode',
            source: 'mapbox',
          },
          {
            id: 'mystery',
            latitude: 30.28,
            longitude: -97.75,
            placeName: 'Mystery Point',
            formattedAddress: 'Mystery Point',
            precision: 'poi',
            source: 'mapbox',
          },
          {
            id: 'dupe',
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Main Street',
            formattedAddress: 'Main Street',
            city: 'Austin',
            country: 'United States',
            precision: 'address',
            source: 'mapbox',
          },
          {
            id: 'blank',
            latitude: 0,
            longitude: 0,
            precision: 'unknown',
            source: 'mapbox',
          },
        ],
      });

      const { wrapper } = await mountPage();
      const input = wrapper.get('#home-base-input');

      await input.trigger('focus');
      await input.trigger('keydown', { key: 'ArrowDown' });
      await input.setValue('Austin');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();

      const suggestions = wrapper.findAll('.home-base-suggestion');
      expect(suggestions).toHaveLength(4);
      expect(suggestions.map((suggestion) => suggestion.text())).toEqual([
        expect.stringContaining('Address'),
        expect.stringContaining('Area'),
        expect.stringContaining('ZIP'),
        expect.stringContaining('Place'),
      ]);
      expect(suggestions[0].text()).toContain('Austin, United States');
      expect(suggestions[3].text()).toContain('Verified location');

      await input.trigger('keydown', { key: 'ArrowDown' });
      expect(wrapper.findAll('.home-base-suggestion').at(1)?.classes()).toContain('is-active');

      await input.trigger('keydown', { key: 'ArrowUp' });
      expect(wrapper.findAll('.home-base-suggestion').at(0)?.classes()).toContain('is-active');

      await input.trigger('keydown', { key: 'Enter' });
      expect((input.element as HTMLInputElement).value).toBe('Main Street, Austin, TX');

      await input.setValue('East');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();
      input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flushPromises();

      await input.trigger('focus');
      await input.trigger('blur');
      await vi.advanceTimersByTimeAsync(130);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores stale preferred-location search successes and failures', async () => {
    vi.useFakeTimers();
    try {
      const staleSuccess = createDeferred<{ data: any[] }>();
      const freshSuccess = createDeferred<{ data: any[] }>();
      searchLocationsMock
        .mockReturnValueOnce(staleSuccess.promise)
        .mockReturnValueOnce(freshSuccess.promise);

      const { wrapper } = await mountPage();
      const input = wrapper.get('#home-base-input');

      await input.trigger('focus');
      await input.setValue('Austin');
      await vi.advanceTimersByTimeAsync(260);
      await input.setValue('Dallas');
      await vi.advanceTimersByTimeAsync(260);

      staleSuccess.resolve({
        data: [
          {
            id: 'stale-austin',
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Austin',
            formattedAddress: 'Austin, Texas',
            precision: 'place',
            source: 'mapbox',
          },
        ],
      });
      await flushPromises();

      expect(wrapper.find('.home-base-suggestion').exists()).toBe(false);

      freshSuccess.resolve({
        data: [
          {
            id: 'fresh-dallas',
            latitude: 32.7767,
            longitude: -96.797,
            placeName: 'Dallas',
            formattedAddress: 'Dallas, Texas',
            precision: 'place',
            source: 'mapbox',
          },
        ],
      });
      await flushPromises();

      expect(wrapper.get('.home-base-suggestion').text()).toContain('Dallas');

      const staleFailure = createDeferred<{ data: any[] }>();
      const freshFailure = createDeferred<{ data: any[] }>();
      searchLocationsMock
        .mockReturnValueOnce(staleFailure.promise)
        .mockReturnValueOnce(freshFailure.promise);

      await input.setValue('Paris');
      await vi.advanceTimersByTimeAsync(260);
      await input.setValue('Rome');
      await vi.advanceTimersByTimeAsync(260);

      staleFailure.reject(new Error('stale offline'));
      await flushPromises();

      expect(wrapper.find('.home-base-combobox__status').text()).not.toBe('Manual entry');

      freshFailure.resolve({ data: [] });
      await flushPromises();

      expect(wrapper.get('.home-base-combobox__status').text()).toBe('No matches');
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists selected interests and forwards to the redirect target after continue', async () => {
    const { wrapper, router } = await mountPage('/onboarding/preferences?redirect=/profile/user-42');

    const chips = wrapper.findAll('.preference-chip');
    // Pick "Food & drink" and "Culture & arts" — first and third chips in
    // document order. The underlying SpotCategory values are what we care
    // about, so we assert on those rather than the display labels.
    await chips[0].trigger('click');
    await chips[2].trigger('click');

    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton).toBeDefined();
    await continueButton!.trigger('click');
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['food', 'culture'],
      homeBase: undefined,
      avatarUrl: undefined,
    });
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      interests: ['food', 'culture'],
      homeBase: undefined,
      avatarUrl: undefined,
    }, 'user-42');
    expect(router.currentRoute.value.fullPath).toBe('/profile/user-42');
  });

  it('saves a home base only when the user chooses to share it', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('#home-base-input').setValue('Chicago, IL');
    await wrapper.findAll('.preference-chip')[0].trigger('click');

    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton).toBeDefined();
    await continueButton!.trigger('click');
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['food'],
      homeBase: 'Chicago, IL',
      avatarUrl: undefined,
    });
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      interests: ['food'],
      homeBase: 'Chicago, IL',
      avatarUrl: undefined,
    }, 'user-42');
  });

  it('shows location matches and saves the selected home base', async () => {
    vi.useFakeTimers();
    try {
      searchLocationsMock.mockResolvedValue({
        data: [
          {
            id: 'mapbox.fort-worth',
            latitude: 32.7555,
            longitude: -97.3308,
            placeName: 'Fort Worth',
            formattedAddress: 'Fort Worth, Texas, United States',
            city: 'Fort Worth',
            country: 'United States',
            precision: 'place',
            source: 'mapbox',
          },
        ],
      });

      const { wrapper } = await mountPage();
      const input = wrapper.get('#home-base-input');

      await input.trigger('focus');
      await input.setValue('Fort W');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();

      expect(searchLocationsMock).toHaveBeenCalledWith('Fort W', {
        limit: 6,
        preferPoi: false,
        sortByDistance: false,
        types: 'address,street,place,city,locality,neighborhood,postcode',
      });
      expect(wrapper.get('.home-base-suggestion').text()).toContain('Fort Worth');

      await wrapper.get('.home-base-suggestion').trigger('click');
      expect((input.element as HTMLInputElement).value).toBe('Fort Worth, TX');

      await wrapper.findAll('.preference-chip')[0].trigger('click');
      const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
      expect(continueButton).toBeDefined();
      await continueButton!.trigger('click');
      await flushPromises();

      expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
        interests: ['food'],
        homeBase: 'Fort Worth, TX',
        avatarUrl: undefined,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a clear action outside the preferred location input', async () => {
    vi.useFakeTimers();
    try {
      searchLocationsMock.mockResolvedValue({
        data: [
          {
            id: 'mapbox.chicago',
            latitude: 41.8781,
            longitude: -87.6298,
            placeName: 'Chicago',
            formattedAddress: 'Chicago, Illinois, United States',
            city: 'Chicago',
            country: 'United States',
            precision: 'place',
            source: 'mapbox',
          },
        ],
      });

      const { wrapper } = await mountPage();
      const input = wrapper.get('#home-base-input');

      await input.trigger('focus');
      await input.setValue('Chicago');
      await vi.advanceTimersByTimeAsync(260);
      await flushPromises();
      await wrapper.get('.home-base-suggestion').trigger('click');

      expect(wrapper.get('.home-base-field__clear').text()).toBe('Clear');
      expect(wrapper.find('.home-base-combobox__status').exists()).toBe(false);

      await wrapper.get('.home-base-field__clear').trigger('click');

      expect((input.element as HTMLInputElement).value).toBe('');
      expect(wrapper.find('.home-base-field__clear').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves an optional user-selected profile photo during onboarding', async () => {
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => 'blob:profile-photo');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    const { wrapper } = await mountPage();
    const photoInput = wrapper.get('input[type="file"]');
    const file = new File(['scope'], 'profile.png', { type: 'image/png' });

    Object.defineProperty(photoInput.element, 'files', {
      configurable: true,
      value: [file],
    });

    await photoInput.trigger('change');
    await wrapper.findAll('.preference-chip')[0].trigger('click');

    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton).toBeDefined();
    await continueButton!.trigger('click');
    await flushPromises();

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['food'],
      homeBase: undefined,
      avatarUrl: 'blob:profile-photo',
    });

    wrapper.unmount();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('validates profile photo type and size before previewing it', async () => {
    const { wrapper } = await mountPage();
    const photoInput = wrapper.get('input[type="file"]');
    const setFiles = (files: File[]) => {
      Object.defineProperty(photoInput.element, 'files', {
        configurable: true,
        value: files,
      });
    };

    setFiles([new File(['scope'], 'profile.txt', { type: 'text/plain' })]);
    await photoInput.trigger('change');

    expect(wrapper.text()).toContain('Choose a JPG, PNG, WebP, or GIF profile photo.');

    const oversizedPhoto = new File(['scope'], 'profile.png', { type: 'image/png' });
    Object.defineProperty(oversizedPhoto, 'size', {
      configurable: true,
      value: 5 * 1024 * 1024 + 1,
    });

    setFiles([oversizedPhoto]);
    await photoInput.trigger('change');

    expect(wrapper.text()).toContain('Profile photo must be 5 MB or smaller.');
  });

  it('surfaces preview support failures and ignores empty file input changes', async () => {
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      const { wrapper } = await mountPage();
      const photoInput = wrapper.get('input[type="file"]');

      Object.defineProperty(photoInput.element, 'files', {
        configurable: true,
        value: [new File(['scope'], 'profile.png', { type: 'image/png' })],
      });
      await photoInput.trigger('change');

      expect(wrapper.text()).toContain('Scope could not preview that profile photo in this browser.');

      Object.defineProperty(photoInput.element, 'files', {
        configurable: true,
        value: [],
      });
      await photoInput.trigger('change');

      expect(wrapper.text()).toContain('Scope could not preview that profile photo in this browser.');
    } finally {
      Object.defineProperty(globalThis.URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
    }
  });

  it('clears a selected profile photo and revokes the temporary preview URL', async () => {
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => 'blob:temporary-profile-photo');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    try {
      const { wrapper } = await mountPage();
      const photoInput = wrapper.get('input[type="file"]');
      const file = new File(['scope'], 'profile.webp', { type: 'image/webp' });

      Object.defineProperty(photoInput.element, 'files', {
        configurable: true,
        value: [file],
      });

      await photoInput.trigger('change');
      expect(createObjectURL).toHaveBeenCalledWith(file);
      expect(wrapper.get('.photo-clear-button').attributes('aria-hidden')).toBe('false');

      await wrapper.get('.photo-clear-button').trigger('click');

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:temporary-profile-photo');
      expect(wrapper.get('.photo-clear-button').attributes('aria-hidden')).toBe('true');
    } finally {
      Object.defineProperty(globalThis.URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }
  });

  it('does not carry seeded stock avatars into the onboarding profile photo', async () => {
    authStoreMock.currentUser.avatarUrl = 'https://i.pravatar.cc/300?img=12';
    const { wrapper } = await mountPage();

    await wrapper.findAll('.preference-chip')[0].trigger('click');

    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton).toBeDefined();
    await continueButton!.trigger('click');
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: ['food'],
      homeBase: undefined,
      avatarUrl: undefined,
    });
  });

  it('allows skipping and still routes to the default dashboard', async () => {
    const { wrapper, router } = await mountPage();
    const skipButton = wrapper.findAll('button').find((btn) => btn.text().includes('Skip'));
    expect(skipButton).toBeDefined();

    await skipButton!.trigger('click');
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      interests: [],
      homeBase: undefined,
      avatarUrl: undefined,
    });
    expect(router.currentRoute.value.fullPath).toBe('/');
  });

  it('keeps the traveler on the page when saving preferences fails', async () => {
    userStoreMock.saveProfile.mockRejectedValueOnce(new Error('offline'));
    const { wrapper, router } = await mountPage('/onboarding/preferences?redirect=/profile/user-42');

    await wrapper.findAll('.preference-chip')[0].trigger('click');
    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton).toBeDefined();

    await continueButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not save your preferences. Try once more in a moment.');
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/preferences?redirect=/profile/user-42');
  });
});
