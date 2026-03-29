import { mount } from '@vue/test-utils';
import NotFoundPage from '@/views/NotFoundPage.vue';

describe('NotFoundPage', () => {
  it('renders the fallback missing-route message', () => {
    const wrapper = mount(NotFoundPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Page not found');
  });
});
