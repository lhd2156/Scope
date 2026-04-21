import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';

describe('AppShell', () => {
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
        default: '<div data-test="page-slot">Atlas page content</div>',
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
    expect(wrapper.find('[data-test="page-slot"]').text()).toBe('Atlas page content');
  });
});
