import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    delete window.__SCOPE_ROUTE_ERROR__;
  });

  function mountBoundary(shouldThrow: { value: boolean }, resetKey = '/explore', errorMessage = 'Planner render failure') {
    const ThrowingChild = defineComponent({
      name: 'ThrowingChild',
      setup() {
        return () => {
          if (shouldThrow.value) {
            throw new Error(errorMessage);
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
    expect(wrapper.text()).toContain('page-level error');
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

  it('publishes chunk errors, marks one reload attempt, and keeps retry copy specific', async () => {
    const shouldThrow = ref(true);
    const wrapper = mountBoundary(shouldThrow, '/chunked', 'Loading chunk 42 failed');

    await flushPromises();

    expect(wrapper.text()).toContain('could not finish loading that route bundle');
    expect(window.__SCOPE_ROUTE_ERROR__).toMatchObject({
      message: 'Loading chunk 42 failed',
      resetKey: '/chunked',
    });
    expect(sessionStorage.getItem('scope-route-chunk-reload:/chunked')).toBe('reloaded');

    await wrapper.get('button.button-primary').trigger('click');
    expect(wrapper.find('[data-test="route-error-boundary"]').exists()).toBe(true);
  });

  it('recovers trip planner route errors once and clears transient planner storage', async () => {
    localStorage.setItem('scope.tripPlanner.mapStyleMode', 'native');
    localStorage.setItem('scope-trip-planner-packing-checklist:test', '["water"]');
    localStorage.setItem('keep-me', 'value');
    sessionStorage.setItem('scope-route-error-recovery:old', 'recovered');
    sessionStorage.setItem('keep-session', 'value');

    const shouldThrow = ref(true);
    mountBoundary(shouldThrow, '/trips/new', 'Planner render failure');

    await flushPromises();

    expect(sessionStorage.getItem('scope-route-error-recovery:/trips/new')).toBeNull();
    expect(localStorage.getItem('scope.tripPlanner.mapStyleMode')).toBeNull();
    expect(localStorage.getItem('scope-trip-planner-packing-checklist:test')).toBeNull();
    expect(sessionStorage.getItem('scope-route-error-recovery:old')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('value');
    expect(sessionStorage.getItem('keep-session')).toBe('value');
  });

  it('does not repeat automatic recovery reloads when storage already records the attempt', async () => {
    sessionStorage.setItem('scope-route-chunk-reload:/already-reloaded', 'reloaded');
    sessionStorage.setItem('scope-route-error-recovery:/trips/retry/edit', 'recovered');

    mountBoundary(ref(true), '/already-reloaded', 'Loading CSS chunk failed');
    mountBoundary(ref(true), '/trips/retry/edit', 'Planner render failure');

    await flushPromises();

    expect(sessionStorage.getItem('scope-route-chunk-reload:/already-reloaded')).toBe('reloaded');
    expect(sessionStorage.getItem('scope-route-error-recovery:/trips/retry/edit')).toBe('recovered');
  });

  it('normalizes string and blank thrown errors for the fallback and route diagnostics', async () => {
    const ThrowStringChild = defineComponent({
      setup() {
        return () => {
          throw 'plain string route failure';
        };
      },
    });
    const stringWrapper = mount(AppErrorBoundary, {
      props: { resetKey: '/string-error' },
      slots: {
        default: () => h(ThrowStringChild),
      },
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a href="/">Back home</a>' },
        },
      },
    });
    await flushPromises();

    expect(stringWrapper.text()).toContain('page-level error');
    expect(window.__SCOPE_ROUTE_ERROR__).toMatchObject({
      message: 'plain string route failure',
      name: 'Error',
      resetKey: '/string-error',
    });

    delete window.__SCOPE_ROUTE_ERROR__;
    const blankError = new Error('   ');
    blankError.name = '';
    const ThrowBlankErrorChild = defineComponent({
      setup() {
        return () => {
          throw blankError;
        };
      },
    });

    mount(AppErrorBoundary, {
      props: { resetKey: '/blank-error' },
      slots: {
        default: () => h(ThrowBlankErrorChild),
      },
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a href="/">Back home</a>' },
        },
      },
    });
    await flushPromises();

    expect(window.__SCOPE_ROUTE_ERROR__).toMatchObject({
      message: 'Unknown route error',
      name: 'Error',
      resetKey: '/blank-error',
    });

    stringWrapper.unmount();
  });
});
