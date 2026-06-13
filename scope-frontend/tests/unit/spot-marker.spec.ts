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
    expect(wrapper.find('use').attributes('href')).toBe('/scope-icons.svg#icon-food');
  });

  it('renders the rating with a full-size filled star icon', () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot,
        active: true,
      },
    });

    const rating = wrapper.get('.spot-marker__rating');

    expect(rating.attributes('aria-label')).toBe('Rated 4.8 out of 5');
    expect(rating.text()).toBe('4.8');
    expect(rating.get('use').attributes('href')).toBe('/scope-icons.svg#icon-star-filled');
    expect(wrapper.text()).not.toContain('* 4.8');
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

  it('emits select when the visible label is clicked', async () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot,
        active: true,
      },
    });

    await wrapper.get('.spot-marker__label').trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
  });

  it('emits remove from the route label action', async () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot: { ...spot, routeRole: 'start', routeLabel: 'S' },
        variant: 'sequence',
        sequence: 'S',
        removable: true,
      },
    });

    await wrapper.get('[data-test="map-route-point-remove"]').trigger('click');

    expect(wrapper.emitted('remove')).toHaveLength(1);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('renders a plain green pin without a category icon when pin-only', () => {
    const wrapper = mount(SpotMarker, {
      props: {
        spot,
        pinOnly: true,
        showLabel: false,
      },
    });

    expect(wrapper.classes()).toContain('spot-marker--pin-only');
    expect(wrapper.find('use').exists()).toBe(false);
    expect(wrapper.find('.spot-marker__label').exists()).toBe(false);
  });
});
