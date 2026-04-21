import { mount } from '@vue/test-utils';
import SpotMarker from '@/components/map/SpotMarker.vue';
import type { MapPoint } from '@/types';

const spot: MapPoint = {
  id: 'spot-1',
  title: 'Sunset Rooftop Tacos',
  latitude: 32.7555,
  longitude: -97.3308,
  category: 'food',
  city: 'Fort Worth',
  rating: 4.8,
};

describe('SpotMarker', () => {
  it('renders the spot label and active state', () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot,
        active: true,
      },
    });

    expect(wrapper.classes()).toContain('badge-food');
    expect(wrapper.classes()).toContain('is-active');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Fort Worth');
    expect(wrapper.find('use').attributes('href')).toBe('/atlas-icons.svg#icon-food');
  });

  it('emits select when clicked', async () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
  });
});
