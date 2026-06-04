import { mount } from '@vue/test-utils';
import MapControls from '@/components/map/MapControls.vue';
import type { SpotCategory } from '@/types';

const categories: SpotCategory[] = ['food', 'nature', 'culture'];

describe('MapControls', () => {
  it('emits control actions and category toggles when the filter panel is visible', async () => {
    const wrapper = mount(MapControls, {
      props: {
        categories,
        activeCategories: ['food', 'culture'],
        routeReady: true,
        trackingState: 'tracking',
        showFilterPanel: true,
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    await buttons[3].trigger('click');
    await buttons[4].trigger('click');
    await buttons[5].trigger('click');
    await buttons[6].trigger('click');

    expect(wrapper.emitted('zoom-in')).toHaveLength(1);
    expect(wrapper.emitted('zoom-out')).toHaveLength(1);
    expect(wrapper.emitted('locate')).toHaveLength(1);
    expect(wrapper.emitted('reset-map')).toHaveLength(1);
    expect(wrapper.emitted('fit-route')).toHaveLength(1);
    expect(wrapper.emitted('reset-filters')).toHaveLength(1);
    expect(wrapper.emitted('toggle-category')?.[0]).toEqual(['food']);
    expect(wrapper.text()).toContain('Live GPS is sharing your current position');
  });

  it('renders a compact bottom-right control stack by default', () => {
    const wrapper = mount(MapControls, {
      props: {
        categories,
        activeCategories: ['food'],
      },
    });

    expect(wrapper.find('.filter-panel').exists()).toBe(false);
    expect(wrapper.findAll('button')).toHaveLength(5);
    expect(wrapper.classes()).not.toContain('map-controls--with-panel');
    expect(wrapper.get('.control-stack').attributes('data-onboarding-target')).toBe('map-controls');
  });

  it('renders unavailable and transient error location status copy', async () => {
    const wrapper = mount(MapControls, {
      props: {
        categories,
        activeCategories: ['food'],
        trackingState: 'unsupported',
        showFilterPanel: true,
      },
    });

    expect(wrapper.text()).toContain('This browser cannot provide GPS updates');

    await wrapper.setProps({ trackingState: 'error' });

    expect(wrapper.text()).toContain('Scope could not refresh your location yet');
  });
});
