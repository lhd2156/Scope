import { mount } from '@vue/test-utils';
import Button from '@/components/common/Button.vue';

describe('Button', () => {
  it('renders icon buttons with the requested variant class', () => {
    const wrapper = mount(Button, {
      props: {
        variant: 'secondary',
        icon: 'map',
        iconLabel: 'Open map',
      },
      slots: {
        default: 'Open map',
      },
    });

    expect(wrapper.classes()).toContain('atlas-button--secondary');
    expect(wrapper.find('.atlas-icon').exists()).toBe(true);
    expect(wrapper.text()).toContain('Open map');
  });

  it('disables the button and shows a spinner while loading', () => {
    const wrapper = mount(Button, {
      props: {
        loading: true,
        block: true,
        loadingLabel: 'Saving spot',
      },
      slots: {
        default: 'Save spot',
      },
    });

    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.classes()).toContain('atlas-button--block');
    expect(wrapper.classes()).toContain('is-loading');
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
  });
});
