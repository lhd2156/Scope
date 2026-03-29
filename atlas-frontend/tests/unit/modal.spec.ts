import { mount } from '@vue/test-utils';
import Modal from '@/components/common/Modal.vue';

describe('Modal', () => {
  it('renders dialog copy and closes on backdrop click by default', async () => {
    const wrapper = mount(Modal, {
      props: {
        open: true,
        title: 'Atlas modal',
        eyebrow: 'Overlay',
      },
      slots: {
        default: '<p>Modal content</p>',
      },
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).toContain('Atlas modal');
    expect(wrapper.text()).toContain('Modal content');

    await wrapper.get('.modal-backdrop').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('respects escape handling and optional backdrop disabling', async () => {
    const wrapper = mount(Modal, {
      props: {
        open: true,
        title: 'Persistent modal',
        closeOnBackdrop: false,
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    await wrapper.get('.modal-backdrop').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
