import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

const { authStoreMock, notificationServiceMock, onboardingStoreMock, routerPush, toastStoreMock, userStoreMock } = vi.hoisted(() => ({
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
      profileVisibility: 'friends' as const,
    },
  },
  notificationServiceMock: {
    getNotificationPreferences: vi.fn().mockResolvedValue({
      data: [
        {
          category: 'trip',
          inAppEnabled: true,
          pushEnabled: true,
          emailEnabled: true,
          digestCadence: 'instant',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
        {
          category: 'digest',
          inAppEnabled: true,
          pushEnabled: false,
          emailEnabled: true,
          digestCadence: 'daily',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
      ],
    }),
    updateNotificationPreference: vi.fn(async (payload) => payload),
  },
  onboardingStoreMock: {
    hasCompleted: true,
    totalSteps: 3,
    restart: vi.fn().mockReturnValue(true),
  },
  routerPush: vi.fn().mockResolvedValue(undefined),
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
      profileVisibility: 'friends' as const,
    }),
    saveProfile: vi.fn().mockResolvedValue({
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      interests: [],
    }),
    deleteCurrentAccount: vi.fn().mockResolvedValue(undefined),
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

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRouter: () => ({ push: routerPush }),
  };
});

vi.mock('@/services/feedService', () => notificationServiceMock);

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
      profileVisibility: 'friends' as const,
    };
    userStoreMock.profile = authStoreMock.currentUser;
    userStoreMock.saving = false;
    userStoreMock.error = null;
    userStoreMock.fetchCurrentProfile.mockClear();
    userStoreMock.fetchCurrentProfile.mockResolvedValue(userStoreMock.profile);
    userStoreMock.saveProfile.mockClear();
    userStoreMock.deleteCurrentAccount.mockClear();
    userStoreMock.deleteCurrentAccount.mockResolvedValue(undefined);
    notificationServiceMock.getNotificationPreferences.mockClear();
    notificationServiceMock.getNotificationPreferences.mockResolvedValue({
      data: [
        {
          category: 'trip',
          inAppEnabled: true,
          pushEnabled: true,
          emailEnabled: true,
          digestCadence: 'instant',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
        {
          category: 'digest',
          inAppEnabled: true,
          pushEnabled: false,
          emailEnabled: true,
          digestCadence: 'daily',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
      ],
    });
    notificationServiceMock.updateNotificationPreference.mockClear();
    notificationServiceMock.updateNotificationPreference.mockImplementation(async (payload) => payload);
    onboardingStoreMock.restart.mockClear();
    onboardingStoreMock.restart.mockReturnValue(true);
    routerPush.mockClear();
    routerPush.mockResolvedValue(undefined);
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
      profileVisibility: 'friends',
    }, 'user-1');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Settings saved',
      message: 'Profile details synced across your Scope account.',
    });
    expect(JSON.parse(localStorage.getItem('scope-settings-local-preferences-v1') ?? '{}')).toMatchObject({
      firstName: 'Louis',
      lastName: 'Do',
      tripInvites: 'instant',
      emailAlerts: true,
    });
    expect(JSON.parse(localStorage.getItem('scope-settings-local-preferences-v1') ?? '{}')).not.toHaveProperty('privacy');

    await wrapper.get('[data-test="settings-form-error"]').trigger('click');
    await nextTick();
    expect(wrapper.text()).toContain('Inline settings issue');

    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    await flushPromises();
    expect(userStoreMock.deleteCurrentAccount).toHaveBeenCalledTimes(1);
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Account deleted',
      message: 'Your Scope account and its associated content were permanently deleted.',
    });
  });

  it('syncs settings notification controls through the notification preference API', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue'],
            emits: ['submit'],
            methods: {
              saveNotificationPreferences() {
                this.$emit('submit', {
                  ...this.initialValue,
                  tripInvites: 'weekly',
                  emailAlerts: false,
                }, { source: 'preference' });
              },
            },
            template: '<button data-test="settings-notification-save" @click="saveNotificationPreferences">Save notifications</button>',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="settings-notification-save"]').trigger('click');
    await flushPromises();

    expect(notificationServiceMock.updateNotificationPreference).toHaveBeenCalledTimes(6);
    expect(notificationServiceMock.updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'trip',
      emailEnabled: false,
      digestCadence: 'weekly',
    }));
    expect(notificationServiceMock.updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'digest',
      emailEnabled: false,
    }));
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      profileVisibility: 'friends',
    }), 'user-1');
  });

  it('recovers from corrupt local preferences and saves trip-only notification cadence safely', async () => {
    localStorage.setItem('scope-settings-local-preferences-v1', 'false');
    notificationServiceMock.getNotificationPreferences.mockResolvedValueOnce({
      data: [{
        category: 'trip',
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        digestCadence: 'daily',
        quietHoursStartMinutes: null,
        quietHoursEndMinutes: null,
        timeZoneId: '',
      }],
    });
    const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      resolvedOptions: () => ({ timeZone: '' }),
    }) as Intl.DateTimeFormat);

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['initialValue'],
            emits: ['submit'],
            methods: {
              saveTripCadenceOnly() {
                this.$emit('submit', {
                  ...this.initialValue,
                  tripInvites: 'instant',
                  emailAlerts: false,
                }, { source: 'preference' });
              },
            },
            template: `
              <div>
                <p data-test="settings-derived-name">{{ initialValue.firstName }} {{ initialValue.lastName }}</p>
                <button data-test="settings-trip-cadence-save" @click="saveTripCadenceOnly">Save cadence</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="settings-derived-name"]').text()).toBe('Louis Do');

    await wrapper.get('[data-test="settings-trip-cadence-save"]').trigger('click');
    await flushPromises();

    expect(notificationServiceMock.updateNotificationPreference).toHaveBeenCalledTimes(1);
    expect(notificationServiceMock.updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'trip',
      emailEnabled: false,
      digestCadence: 'instant',
      timeZoneId: 'UTC',
    }));
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();

    dateTimeFormatSpy.mockRestore();
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
      profileVisibility: 'friends' as const,
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

  it('keeps the account active and surfaces the API error when permanent deletion fails', async () => {
    userStoreMock.error = 'Content deletion is temporarily unavailable.';
    userStoreMock.deleteCurrentAccount.mockRejectedValueOnce(new Error('content deletion failed'));

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            props: ['errorMessage', 'deletingAccount'],
            emits: ['delete-account'],
            template: `
              <div>
                <button data-test="settings-delete-account" @click="$emit('delete-account')">Delete account</button>
                <p data-test="settings-error">{{ errorMessage }}</p>
                <p data-test="settings-deleting">{{ deletingAccount }}</p>
              </div>
            `,
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.deleteCurrentAccount).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="settings-error"]').text()).toBe('Content deletion is temporarily unavailable.');
    expect(wrapper.get('[data-test="settings-deleting"]').text()).toBe('false');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Account not deleted',
      message: 'Content deletion is temporarily unavailable.',
    });
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();
  });

  it('does not start account deletion without a current authenticated user', async () => {
    authStoreMock.currentUser = null;

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SettingsForm: {
            emits: ['delete-account'],
            template: '<button data-test="settings-delete-account" @click="$emit(\'delete-account\')">Delete account</button>',
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.deleteCurrentAccount).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();
    expect(toastStoreMock.showError).not.toHaveBeenCalled();
  });

  it('keeps the shell and settings theme controls synced across dark and light', async () => {
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
    expect(shellToggle.attributes('aria-label')).toBe('Dark theme active. Switch to light mode.');

    const lightOption = wrapper.get('[data-test="theme-option-light"]');
    expect(lightOption.attributes('aria-disabled')).toBeUndefined();
    expect(lightOption.text()).not.toContain('Coming soon');

    await lightOption.trigger('click');
    await flushPromises();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(wrapper.get('[data-test="theme-option-light"]').classes()).toContain('is-active');
    expect(shellToggle.attributes('aria-label')).toBe('Light theme active. Switch to dark mode.');
    expect(userStoreMock.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      username: 'louisdo',
      displayName: 'Louis Do',
      interests: ['food', 'culture', 'adventure'],
      showActivityStatus: true,
    }), 'user-1');
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();

    await wrapper.get('[data-test="theme-option-dark"]').trigger('click');
    await flushPromises();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(shellToggle.attributes('aria-label')).toBe('Dark theme active. Switch to light mode.');
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
    await flushPromises();

    expect(routerPush).toHaveBeenCalledWith('/');
    expect(onboardingStoreMock.restart).toHaveBeenCalledWith('home-hero');
    expect(routerPush.mock.invocationCallOrder[0]).toBeLessThan(onboardingStoreMock.restart.mock.invocationCallOrder[0]);
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
    await flushPromises();

    expect(routerPush).toHaveBeenCalledWith('/');
    expect(onboardingStoreMock.restart).toHaveBeenCalledWith('home-hero');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Tutorial unavailable',
      message: 'Scope could not start the guided walkthrough right now.',
    });
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
  });

  it('does not reset truthful tour completion when home navigation fails', async () => {
    routerPush.mockRejectedValueOnce(new Error('navigation failed'));

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
    await flushPromises();

    expect(onboardingStoreMock.restart).not.toHaveBeenCalled();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Tutorial unavailable',
      message: 'Scope could not open the guided walkthrough right now.',
    });
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

  it('keeps settings audit, helper, storage, and fallback save branches explicit', async () => {
    window.history.pushState({}, '', '/settings?scopeQaSession=authenticated');
    localStorage.setItem('scope-settings-local-preferences-v1', '{not-json');

    const wrapper = mount(SettingsPage, {
      attachTo: document.body,
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Settings sections stay condensed');
    expect(wrapper.text()).toContain('Louis Do');

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(coverage.readLocalSettingsPreferences()).toEqual({});
    expect(coverage.normalizeTripInviteCadence('daily')).toBe('daily');
    expect(coverage.normalizeTripInviteCadence('weekly')).toBe('weekly');
    expect(coverage.normalizeTripInviteCadence('surprise')).toBe('instant');
    expect(coverage.buildDefaultNotificationPreference('digest')).toMatchObject({
      category: 'digest',
      pushEnabled: false,
      emailEnabled: true,
      digestCadence: 'daily',
    });
    expect(coverage.buildDefaultNotificationPreference('friend')).toMatchObject({
      category: 'friend',
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'instant',
    });
    expect(coverage.deriveSettingsNotificationPreferences([], {
      tripInvites: 'weekly',
      emailAlerts: false,
    })).toEqual({ tripInvites: 'weekly', emailAlerts: false });
    expect(coverage.deriveSettingsNotificationPreferences([
      {
        category: 'trip',
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
        digestCadence: 'bad-cadence',
        quietHoursStartMinutes: null,
        quietHoursEndMinutes: null,
        timeZoneId: '',
      },
      {
        category: 'friend',
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        digestCadence: 'instant',
        quietHoursStartMinutes: null,
        quietHoursEndMinutes: null,
        timeZoneId: '',
      },
    ], {})).toEqual({ tripInvites: 'instant', emailAlerts: true });
    expect(coverage.toCategoryPreferences(['unknown-vibe'])).toEqual(['food', 'culture', 'adventure']);
    expect(coverage.toCategoryPreferences(['scenic', 'food'])).toEqual(['scenic', 'food']);

    const noProfileSettings = coverage.buildSettingsValueFromProfile(null);
    expect(noProfileSettings).toMatchObject({
      displayName: 'New explorer',
      firstName: 'New',
      lastName: 'explorer',
      username: '',
      privacy: 'friends',
    });

    const section = document.createElement('section');
    section.id = 'settings-profile';
    section.scrollIntoView = vi.fn();
    section.focus = vi.fn();
    document.body.appendChild(section);
    coverage.goToSection('settings-profile');
    expect(read(coverage.activeSection)).toBe('settings-profile');
    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(section.focus).toHaveBeenCalledWith({ preventScroll: true });
    section.remove();

    const payload = {
      ...read(coverage.settingsValue),
      displayName: 'Louis Do',
      username: 'louisdo',
      bio: '',
      avatarUrl: '',
      homeBase: '',
      categoryPreferences: ['food', 'culture', 'adventure'],
    };
    userStoreMock.error = null;
    userStoreMock.saveProfile.mockRejectedValueOnce(new Error('generic profile failure'));
    await coverage.handleSave(payload, { source: 'manual' });
    expect(read(coverage.formError)).toBe('Scope could not save your settings right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Settings not saved',
      message: 'Scope could not save your settings right now.',
    });

    notificationServiceMock.getNotificationPreferences.mockRejectedValueOnce(new Error('preferences offline'));
    await expect(coverage.loadNotificationPreferences()).resolves.toBeUndefined();

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    expect(coverage.readLocalSettingsPreferences()).toEqual({});
    expect(() => coverage.writeLocalSettingsPreferences(payload)).not.toThrow();
    vi.stubGlobal('window', originalWindow);

    window.history.pushState({}, '', '/settings');
  });
});
