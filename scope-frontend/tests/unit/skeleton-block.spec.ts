import { mount } from '@vue/test-utils';
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';

describe('SkeletonBlock', () => {
  it('renders shape and tone classes with configurable dimensions', () => {
    const wrapper = mount(SkeletonBlock, {
      props: {
        width: '4rem',
        height: '2rem',
        shape: 'pill',
        tone: 'soft',
      },
    });

    expect(wrapper.classes()).toContain('skeleton-block--pill');
    expect(wrapper.classes()).toContain('skeleton-block--soft');
    expect(wrapper.attributes('style')).toContain('--skeleton-width: 4rem');
    expect(wrapper.attributes('style')).toContain('--skeleton-height: 2rem');
  });
});
