import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

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
    profile: null as any,
    saving: false,
    error: null as string | null,
    fetchCurrentProfile: vi.fn().mockResolvedValue({
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture', 'adventure'],
      showActivityStatus: true,
    }),
    saveProfile: vi.fn().mockResolvedValue({
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: [],
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
  IS_PRODUCTION_BUILD: false,
  LOCAL_PREVIEW_ENABLED: false,
  DEMO_MODE_ENABLED: false,
  AUTH_MOCK_FALLBACK_ENABLED: false,
  USER_MOCK_FALLBACK_ENABLED: false,
  localFallbackEnabled: vi.fn(() => false),
}));

import SettingsPage from '@/views/SettingsPage.vue';

describe('SettingsPage', () => {
  beforeEach(() => {
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture', 'adventure'],
      showActivityStatus: true,
    };
    userStoreMock.profile = authStoreMock.currentUser;
    userStoreMock.saving = false;
    userStoreMock.error = null;
    userStoreMock.fetchCurrentProfile.mockClear();
    userStoreMock.fetchCurrentProfile.mockResolvedValue(userStoreMock.profile);
    userStoreMock.saveProfile.mockClear();
    onboardingStoreMock.restart.mockClear();
    onboardingStoreMock.restart.mockReturnValue(true);
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
    resetAnalyticsConsent();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('renders the premium settings shell and saves through the user profile contract', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue', 'submitting', 'errorMessage'],
            emits: ['submit', 'update:errorMessage', 'delete-account'],
            template: `
              <div>
                <button data-test="settings-submit" @click="$emit('submit', initialValue)">Save</button>
                <button data-test="settings-form-error" @click="$emit('update:errorMessage', 'Inline settings issue')">Set error</button>
                <button data-test="settings-delete-account" @click="$emit('delete-account')">Delete account</button>
                <p>{{ errorMessage }}</p>
              </div>
            `,
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Shape how Scope looks, feels, and shares your story.');
    expect(wrapper.find('[data-test="settings-sidebar"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('API-backed');

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      username: 'louisdo',
      displayName: 'Louis Do',
      avatarUrl: undefined,
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture', 'adventure'],
      showActivityStatus: true,
    }, 'user-1');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Settings saved',
      message: 'Profile details synced across your Scope account.',
    });

    await wrapper.get('[data-test="settings-form-error"]').trigger('click');
    await nextTick();
    expect(wrapper.text()).toContain('Inline settings issue');

    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Delete request received',
      message: 'Scope will email you to confirm the permanent deletion within 24 hours.',
    });
  });

  it('hydrates travel preferences from the live profile instead of the lean auth payload', async () => {
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: '',
      homeBase: '',
      interests: [],
      showActivityStatus: true,
    };
    userStoreMock.profile = {
      ...authStoreMock.currentUser,
      bio: 'Live profile biography.',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'scenic'],
    };
    userStoreMock.fetchCurrentProfile.mockResolvedValueOnce(userStoreMock.profile);

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await flushPromises();

    expect(userStoreMock.fetchCurrentProfile).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="preference-pill-food"]').classes()).toContain('is-active');
    expect(wrapper.get('[data-test="preference-pill-scenic"]').classes()).toContain('is-active');
  });

  it('moves keyboard and scroll focus to the selected settings section', async () => {
    const wrapper = mount(SettingsPage, {
      attachTo: document.body,
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            template: '<section id="settings-profile" tabindex="-1">Profile target</section>',
          },
        },
      },
    });

    const profileSection = wrapper.get('#settings-profile').element as HTMLElement;
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    Object.defineProperty(profileSection, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(profileSection, 'focus', {
      configurable: true,
      value: focus,
    });

    await wrapper.get('[data-test="settings-nav-settings-profile"]').trigger('click');

    expect(wrapper.get('[data-test="settings-nav-settings-profile"]').classes()).toContain('is-active');
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('blocks settings saves when the authenticated session is missing', async () => {
    authStoreMock.currentUser = null;

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue', 'errorMessage'],
            emits: ['submit', 'update:errorMessage'],
            template: '<div><button data-test="settings-submit" @click="$emit(\'submit\', initialValue)">Save</button><p>{{ errorMessage }}</p></div>',
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Sign in again to update your Scope settings.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Settings not saved',
      message: 'Sign in again to update your Scope settings.',
    });
  });

  it('keeps the shell theme control dark-only while settings marks light mode coming soon', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: {
            components: { ThemeToggle },
            template: '<div><ThemeToggle /><slot /></div>',
          },
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    const shellToggle = wrapper.get('button.theme-toggle');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(shellToggle.attributes('aria-label')).toBe('Light mode coming soon');

    await wrapper.get('[data-test="theme-option-light"]').trigger('click');
    await nextTick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(wrapper.get('[data-test="theme-option-dark"]').classes()).toContain('is-active');
    expect(wrapper.get('[data-test="theme-option-light"]').text()).toContain('Coming soon');
    expect(shellToggle.attributes('aria-label')).toBe('Light mode coming soon');
  });

  it('updates the analytics opt-out control locally without hitting the profile save contract', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(localStorage.getItem('scope-analytics-consent')).toBeNull();

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');
    await nextTick();

    expect(localStorage.getItem('scope-analytics-consent')).toBe('granted');
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');
    await nextTick();

    expect(localStorage.getItem('scope-analytics-consent')).toBe('denied');
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
  });

  it('restarts the guided walkthrough from settings without touching the profile save contract', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Replay tutorial');
    expect(wrapper.text()).toContain('3-step guide');

    await wrapper.get('[data-test="settings-replay-tutorial"]').trigger('click');
    await nextTick();

    expect(onboardingStoreMock.restart).toHaveBeenCalledWith('home-hero');
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
    expect(toastStoreMock.showError).not.toHaveBeenCalled();
  });

  it('shows a toast when the guided walkthrough cannot be restarted from settings', async () => {
    onboardingStoreMock.restart.mockReturnValueOnce(false);

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('[data-test="settings-replay-tutorial"]').trigger('click');
    await nextTick();

    expect(onboardingStoreMock.restart).toHaveBeenCalledWith('home-hero');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Tutorial unavailable',
      message: 'Scope could not start the guided walkthrough right now.',
    });
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
  });

  it('surfaces a settings error when the profile update throws and emits an error toast', async () => {
    userStoreMock.error = 'Scope could not update that profile right now.';
    userStoreMock.saveProfile.mockRejectedValueOnce(new Error('Settings sync failed'));

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue', 'submitting', 'errorMessage'],
            emits: ['submit', 'update:errorMessage'],
            template: '<div><button data-test="settings-submit" @click="$emit(\'submit\', initialValue)">Save</button><p>{{ errorMessage }}</p></div>',
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not update that profile right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Settings not saved',
      message: 'Scope could not update that profile right now.',
    });
  });
});
