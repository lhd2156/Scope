import { mount } from '@vue/test-utils';
import AppShell from '@/components/common/AppShell.vue';

describe('AppShell', () => {
  it('renders the shared navbar shell and page content slot', () => {
    const wrapper = mount(AppShell, {
      slots: {
        default: '<div data-test="page-slot">Atlas page content</div>',
      },
      global: {
        stubs: {
          Navbar: { template: '<div data-test="navbar-stub">Navbar</div>' },
        },
      },
    });

    expect(wrapper.find('[data-test="navbar-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="page-slot"]').text()).toBe('Atlas page content');
  });
});
