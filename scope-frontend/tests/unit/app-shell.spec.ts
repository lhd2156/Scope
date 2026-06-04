import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import {
  AUTH_SESSION_HINT_CHANGE_EVENT,
  clearStoredAuthSessionHint,
  persistAuthSessionHint,
} from '@/utils/authSessionStorage';

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearStoredAuthSessionHint();
  });

  it('renders the shared navbar shell and page content slot', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/settings',
          name: 'settings',
          component: { template: '<div>Settings target</div>' },
          meta: { requiresAuth: true },
        },
      ],
    });

    await router.push('/settings');
    await router.isReady();

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div data-test="page-slot">Scope page content</div>',
      },
      global: {
        plugins: [router],
        stubs: {
          Navbar: { template: '<div data-test="navbar-stub">Navbar</div>' },
          GuestNavbar: { template: '<div data-test="guest-navbar-stub">Guest navbar</div>' },
        },
      },
    });

    expect(wrapper.find('[data-test="navbar-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="guest-navbar-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="page-slot"]').text()).toBe('Scope page content');
  });

  it('renders the guest shell until a stored auth hint appears', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: { template: '<div>Home target</div>' },
        },
      ],
    });

    await router.push('/');
    await router.isReady();

    const wrapper = mount(AppShell, {
      props: {
        hideFooter: true,
      },
      slots: {
        default: '<div data-test="page-slot">Guest page content</div>',
      },
      global: {
        plugins: [router],
        stubs: {
          Navbar: { template: '<div data-test="navbar-stub">Navbar</div>' },
          GuestNavbar: { template: '<div data-test="guest-navbar-stub">Guest navbar</div>' },
          AppFooter: { template: '<footer data-test="footer-stub">Footer</footer>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.attributes('data-navbar')).toBe('guest');
    expect(wrapper.find('[data-test="guest-navbar-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="navbar-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="footer-stub"]').exists()).toBe(false);

    persistAuthSessionHint('refresh-token-1', { persistence: 'session' });
    await flushPromises();

    expect(wrapper.attributes('data-navbar')).toBe('auth');
    expect(wrapper.find('[data-test="navbar-stub"]').exists()).toBe(true);

    clearStoredAuthSessionHint();
    await flushPromises();

    expect(wrapper.attributes('data-navbar')).toBe('guest');

    wrapper.unmount();
    persistAuthSessionHint('refresh-token-2', { persistence: 'session' });
    window.dispatchEvent(new Event(AUTH_SESSION_HINT_CHANGE_EVENT));
    await flushPromises();

    expect(wrapper.attributes('data-navbar')).toBe('guest');
  });
});
