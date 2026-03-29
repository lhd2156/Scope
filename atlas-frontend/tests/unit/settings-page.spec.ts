import { flushPromises, mount } from '@vue/test-utils';

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
});
