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
    saveProfile: vi.fn(),
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
  IS_PRODUCTION_BUILD: false,
  LOCAL_PREVIEW_ENABLED: true,
  DEMO_MODE_ENABLED: true,
  AUTH_MOCK_FALLBACK_ENABLED: true,
  USER_MOCK_FALLBACK_ENABLED: true,
  localFallbackEnabled: vi.fn(() => true),
}));

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => true,
}));

import SettingsPage from '@/views/SettingsPage.vue';

describe('SettingsPage QA preview', () => {
  it('renders compact settings cards instead of the full form workspace', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: { template: '<form data-test="settings-form-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Preferences preview');
    expect(wrapper.text()).toContain('Settings sections stay condensed during the QA session.');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('louis@example.com');
    expect(wrapper.text()).toContain('Preview mode');
    expect(wrapper.text()).toContain('Local preview fallbacks are only active');
    expect(wrapper.text()).toContain('Appearance');
    expect(wrapper.find('[data-test="settings-form-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="settings-sidebar"]').exists()).toBe(false);
  });
});
