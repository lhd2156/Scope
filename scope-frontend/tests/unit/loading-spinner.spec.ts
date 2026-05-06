import { mount } from '@vue/test-utils';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

describe('LoadingSpinner', () => {
  it('renders an accessible status indicator with the requested size', () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        size: 'lg',
        label: 'Loading map workspace',
      },
    });

    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.attributes('aria-label')).toBe('Loading map workspace');
    expect(wrapper.classes()).toContain('size-lg');
    expect(wrapper.find('.loading-spinner__ring').exists()).toBe(true);
  });
});
