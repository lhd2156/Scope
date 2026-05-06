import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mountBoundary(shouldThrow: { value: boolean }, resetKey = '/explore') {
    const ThrowingChild = defineComponent({
      name: 'ThrowingChild',
      setup() {
        return () => {
          if (shouldThrow.value) {
            throw new Error('Failed to fetch dynamically imported module');
          }

          return h('div', { 'data-test': 'recovered-view' }, 'Recovered view');
        };
      },
    });

    return mount(AppErrorBoundary, {
      props: { resetKey },
      slots: {
        default: () => h(ThrowingChild),
      },
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a href="/">Back home</a>' },
        },
      },
    });
  }

  it('renders an accessible fallback and retries the current view after an error', async () => {
    const shouldThrow = ref(true);
    const wrapper = mountBoundary(shouldThrow);

    await flushPromises();

    const fallback = wrapper.get('[data-test="route-error-boundary"]');

    expect(fallback.attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('This workspace hit a snag');
    expect(wrapper.text()).toContain('route bundle');
    expect(document.activeElement).toBe(fallback.element);

    shouldThrow.value = false;
    await wrapper.get('button.button-primary').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="route-error-boundary"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="recovered-view"]').text()).toBe('Recovered view');
  });

  it('clears the fallback when the route key changes after a failure', async () => {
    const shouldThrow = ref(true);
    const wrapper = mountBoundary(shouldThrow, '/friends');

    await flushPromises();
    expect(wrapper.find('[data-test="route-error-boundary"]').exists()).toBe(true);

    shouldThrow.value = false;
    await wrapper.setProps({ resetKey: '/map' });
    await flushPromises();

    expect(wrapper.find('[data-test="route-error-boundary"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="recovered-view"]').exists()).toBe(true);
  });
});
