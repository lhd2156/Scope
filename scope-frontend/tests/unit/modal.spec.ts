import { mount } from '@vue/test-utils';
import Modal from '@/components/common/Modal.vue';

describe('Modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('renders dialog copy and closes on backdrop click by default', async () => {
    const wrapper = mount(Modal, {
      props: {
        open: true,
        title: 'Scope modal',
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

    expect(wrapper.text()).toContain('Scope modal');
    expect(wrapper.text()).toContain('Modal content');
    expect(wrapper.get('.modal-panel').attributes('aria-labelledby')).toBeTruthy();
    expect(wrapper.get('.modal-panel').attributes('aria-describedby')).toBeTruthy();

    await wrapper.get('.modal-backdrop').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('traps keyboard focus inside the panel and restores the opener focus when it closes', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open modal';
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mount(Modal, {
      props: {
        open: true,
        title: 'Focusable modal',
      },
      slots: {
        default: '<button data-test="secondary-action">Secondary action</button>',
      },
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    await wrapper.vm.$nextTick();

    const closeButton = wrapper.get('.modal-close').element as HTMLButtonElement;
    const secondaryButton = wrapper.get('[data-test="secondary-action"]').element as HTMLButtonElement;

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(closeButton);

    secondaryButton.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(secondaryButton);

    await wrapper.setProps({ open: false });
    await wrapper.vm.$nextTick();

    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
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
    wrapper.unmount();
  });
});
