import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock, onboardingStoreMock, toastStoreMock, userStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture', 'adventure'],
      showActivityStatus: true,
    },
  },
  onboardingStoreMock: {
    hasCompleted: true,
    totalSteps: 3,
    restart: vi.fn().mockReturnValue(true),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  userStoreMock: {
    saving: false,
    error: null as string | null,
    fetchCurrentProfile: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn().mockResolvedValue({
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture', 'adventure'],
    }),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

vi.mock('@/services/demoMode', () => ({
  USER_MOCK_FALLBACK_ENABLED: true,
}));

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => false,
}));

import SettingsPage from '@/views/SettingsPage.vue';

describe('SettingsPage preview sync mode', () => {
  beforeEach(() => {
    userStoreMock.fetchCurrentProfile.mockClear();
    userStoreMock.saveProfile.mockClear();
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
  });

  it('uses preview-mode copy while saving profile settings locally', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue', 'syncModeDescription'],
            emits: ['submit', 'update:errorMessage'],
            template: '<div><p data-test="sync-description">{{ syncModeDescription }}</p><button data-test="settings-submit" @click="$emit(\'submit\', initialValue)">Save</button></div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Preview mode');
    expect(wrapper.get('[data-test="sync-description"]').text()).toContain('Local preview fallbacks are only active');

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.saveProfile).toHaveBeenCalledTimes(1);
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Settings saved',
      message: 'Profile details refreshed in the local preview workspace.',
    });
  });
});
