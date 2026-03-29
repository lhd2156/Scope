import { mount } from '@vue/test-utils';
import MapControls from '@/components/map/MapControls.vue';
import type { SpotCategory } from '@/types';

const categories: SpotCategory[] = ['food', 'nature', 'culture'];

describe('MapControls', () => {
  it('emits control actions and category toggles', async () => {
    const wrapper = mount(MapControls, {
      props: {
        categories,
        activeCategories: ['food', 'culture'],
        routeReady: true,
        trackingState: 'tracking',
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    await buttons[3].trigger('click');
    await buttons[5].trigger('click');

    expect(wrapper.emitted('zoom-in')).toHaveLength(1);
    expect(wrapper.emitted('zoom-out')).toHaveLength(1);
    expect(wrapper.emitted('locate')).toHaveLength(1);
    expect(wrapper.emitted('fit-route')).toHaveLength(1);
    expect(wrapper.emitted('toggle-category')?.[0]).toEqual(['food']);
    expect(wrapper.text()).toContain('Live GPS is sharing your current position');
  });
});
