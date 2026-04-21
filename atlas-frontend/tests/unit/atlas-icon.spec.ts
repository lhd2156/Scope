import { mount } from '@vue/test-utils';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

describe('AtlasIcon', () => {
  it('renders the expected sprite href and accessible label', () => {
    const wrapper = mount(AtlasIcon, {
      props: {
        name: 'map',
        label: 'Map icon',
      },
    });

    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-hidden')).toBe('false');
    expect(wrapper.find('title').text()).toBe('Map icon');
    expect(wrapper.find('use').attributes('href')).toBe('/atlas-icons.svg#icon-map');
  });

  it('marks decorative icons as presentation-only', () => {
    const wrapper = mount(AtlasIcon, {
      props: {
        name: 'close',
      },
    });

    expect(wrapper.attributes('role')).toBe('presentation');
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.find('title').exists()).toBe(false);
  });
});
