import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

const { authStoreMock, toastStoreMock, userStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
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
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('saves through the user profile contract and pushes a success toast', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ThemeToggle: { template: '<div data-test="theme-toggle-stub">Theme toggle</div>' },
          SettingsForm: {
            props: ['initialValue', 'submitting', 'errorMessage'],
            emits: ['submit', 'update:errorMessage'],
            template: '<button data-test="settings-submit" @click="$emit(\'submit\', initialValue)">Save</button>',
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await flushPromises();

    expect(userStoreMock.saveProfile).toHaveBeenCalledWith({
      displayName: 'Louis Do',
      avatarUrl: undefined,
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
    });
    expect(wrapper.find('[data-test="theme-toggle-stub"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('API-backed');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Settings saved',
      message: 'Profile details synced across your Atlas account.',
    });
  });

  it('keeps shell and page theme toggles synchronized in the settings workspace', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: {
            components: { ThemeToggle },
            template: '<div><ThemeToggle /><slot /></div>',
          },
          SectionHeading: { template: '<div />' },
          SettingsForm: { template: '<div />' },
        },
      },
    });

    const toggles = wrapper.findAll('button.theme-toggle');
    expect(toggles).toHaveLength(2);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(toggles[0].attributes('aria-label')).toBe('Switch to light mode');
    expect(toggles[1].attributes('aria-label')).toBe('Switch to light mode');

    await toggles[1].trigger('click');
    await nextTick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('atlas-theme')).toBe('light');
    expect(toggles[0].attributes('aria-label')).toBe('Switch to dark mode');
    expect(toggles[1].attributes('aria-label')).toBe('Switch to dark mode');
  });

  it('surfaces a settings error when the profile update throws and emits an error toast', async () => {
    userStoreMock.error = 'Atlas could not update that profile right now.';
    userStoreMock.saveProfile.mockRejectedValueOnce(new Error('Settings sync failed'));

    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ThemeToggle: { template: '<div />' },
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
