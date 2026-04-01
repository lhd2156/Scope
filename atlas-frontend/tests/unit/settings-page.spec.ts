import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

const { authStoreMock, toastStoreMock, userStoreMock } = vi.hoisted(() => ({
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
    },
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  userStoreMock: {
    saving: false,
    error: null as string | null,
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

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

import SettingsPage from '@/views/SettingsPage.vue';

describe('SettingsPage', () => {
  beforeEach(() => {
    userStoreMock.error = null;
    userStoreMock.saveProfile.mockClear();
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
            emits: ['submit', 'update:errorMessage'],
            template: '<button data-test="settings-submit" @click="$emit(\'submit\', initialValue)">Save</button>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Shape how Atlas looks, feels, and shares your story.');
    expect(wrapper.find('[data-test="settings-sidebar"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('API-backed');

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      displayName: 'Louis Do',
      avatarUrl: undefined,
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
    });
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Settings saved',
      message: 'Profile details synced across your Atlas account.',
    });
  });

  it('keeps the shell theme toggle synchronized with the appearance controls inside settings', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: {
            components: { ThemeToggle },
            template: '<div><ThemeToggle /><slot /></div>',
          },
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    const shellToggle = wrapper.get('button.theme-toggle');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(shellToggle.attributes('aria-label')).toBe('Switch to light mode');

    await wrapper.get('[data-test="theme-option-light"]').trigger('click');
    await nextTick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('atlas-theme')).toBe('light');
    expect(shellToggle.attributes('aria-label')).toBe('Switch to dark mode');
  });

  it('updates the analytics opt-out control locally without hitting the profile save contract', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(localStorage.getItem('atlas-analytics-consent')).toBeNull();

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');
    await nextTick();

    expect(localStorage.getItem('atlas-analytics-consent')).toBe('granted');
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');
    await nextTick();

    expect(localStorage.getItem('atlas-analytics-consent')).toBe('denied');
    expect(userStoreMock.saveProfile).not.toHaveBeenCalled();
  });

  it('surfaces a settings error when the profile update throws and emits an error toast', async () => {
    userStoreMock.error = 'Atlas could not update that profile right now.';
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

    expect(wrapper.text()).toContain('Atlas could not update that profile right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Settings not saved',
      message: 'Atlas could not update that profile right now.',
    });
  });
});
