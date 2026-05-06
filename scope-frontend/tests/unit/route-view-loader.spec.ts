import { mount } from '@vue/test-utils';
import RouteViewLoader from '@/components/common/RouteViewLoader.vue';

describe('RouteViewLoader', () => {
  it('renders the shared route-loading spinner and status copy', () => {
    const wrapper = mount(RouteViewLoader);

    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.text()).toContain('Loading Scope workspace…');
    expect(wrapper.text()).toContain('Preparing the next route view.');
    expect(wrapper.findComponent({ name: 'LoadingSpinner' }).exists()).toBe(true);
  });
});
