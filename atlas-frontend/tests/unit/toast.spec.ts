import { mount } from '@vue/test-utils';
import Toast from '@/components/common/Toast.vue';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders status copy and auto-hides after the configured delay', async () => {
    const wrapper = mount(Toast, {
      props: {
        title: 'Saved',
        message: 'Spot saved to Atlas.',
        tone: 'success',
        autoHideMs: 500,
      },
    });

    expect(wrapper.text()).toContain('Saved');
    expect(wrapper.classes()).toContain('toast--success');
    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.attributes('aria-live')).toBe('polite');

    await vi.advanceTimersByTimeAsync(500);

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('announces error toasts assertively and stays open when auto-hide is disabled', async () => {
    const wrapper = mount(Toast, {
      props: {
        title: 'Save failed',
        message: 'Atlas could not save that spot right now.',
        tone: 'error',
        autoHideMs: 0,
      },
    });

    expect(wrapper.classes()).toContain('toast--error');
    expect(wrapper.attributes('role')).toBe('alert');
    expect(wrapper.attributes('aria-live')).toBe('assertive');

    await vi.advanceTimersByTimeAsync(2_000);

    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
