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
        open: true,
        title: 'Saved',
        message: 'Spot saved to Atlas.',
        tone: 'success',
        autoHideMs: 500,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).toContain('Saved');
    expect(wrapper.classes()).toContain('toast--success');

    await vi.advanceTimersByTimeAsync(500);

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
