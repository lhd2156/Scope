import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock } = vi.hoisted(() => ({
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
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import OnboardingPreferencesPage from '@/views/OnboardingPreferencesPage.vue';

describe('onboarding preferences page', () => {
  beforeEach(() => {
    authStoreMock.updateCurrentUser.mockClear();
    authStoreMock.currentUser.interests = [];
    authStoreMock.currentUser.homeBase = '';
    authStoreMock.currentUser.avatarUrl = '';
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

  it('prevents continue until the user selects at least one interest', async () => {
    const { wrapper } = await mountPage();
    const continueButton = wrapper.findAll('button').find((btn) => btn.text().includes('Continue to Scope'));
    expect(continueButton?.attributes('disabled')).toBeDefined();
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
    expect(router.currentRoute.value.fullPath).toBe('/profile/user-42');
  });

  it('saves a home base only when the user chooses to share it', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('input[autocomplete="address-level2"]').setValue('Chicago, IL');
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
});
