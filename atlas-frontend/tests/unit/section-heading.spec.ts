import { mount } from '@vue/test-utils';
import SectionHeading from '@/components/common/SectionHeading.vue';

describe('SectionHeading', () => {
  it('renders eyebrow, title, and supporting description copy', () => {
    const wrapper = mount(SectionHeading, {
      props: {
        eyebrow: 'Trending now',
        title: 'Community-loved spots',
        description: 'The strongest Atlas signals across the map.',
      },
    });

    expect(wrapper.text()).toContain('Trending now');
    expect(wrapper.text()).toContain('Community-loved spots');
    expect(wrapper.text()).toContain('The strongest Atlas signals across the map.');
  });
});
