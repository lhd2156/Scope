import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

const { authStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      displayName: 'Louis Do',
      avatarUrl: '',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
    },
    updateCurrentUser: vi.fn(),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import SettingsPage from '@/views/SettingsPage.vue';

describe('SettingsPage', () => {
  beforeEach(() => {
    authStoreMock.updateCurrentUser.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('wires the settings form into the auth profile shell and success toast', async () => {
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
          Toast: {
            props: ['open', 'title'],
            template: '<div v-if="open" data-test="toast-stub">{{ title }}</div>',
          },
        },
      },
    });

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(authStoreMock.updateCurrentUser).toHaveBeenCalledWith({
      displayName: 'Louis Do',
      avatarUrl: undefined,
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
    });
    expect(wrapper.find('[data-test="theme-toggle-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="toast-stub"]').text()).toContain('Settings updated');
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
          Toast: { template: '<div />' },
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

  it('surfaces a settings error when the profile update throws', async () => {
    authStoreMock.updateCurrentUser.mockImplementationOnce(() => {
      throw new Error('Settings sync failed');
    });

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
          Toast: { template: '<div />' },
        },
      },
    });

    await wrapper.get('[data-test="settings-submit"]').trigger('click');
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(wrapper.text()).toContain('Atlas could not save your settings right now.');
  });
});
