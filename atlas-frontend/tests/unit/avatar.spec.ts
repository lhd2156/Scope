import { mount } from '@vue/test-utils';
import Avatar from '@/components/common/Avatar.vue';

describe('Avatar', () => {
  it('renders initials and size styles when no image is provided', () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Louis Do',
        size: 56,
      },
    });

    expect(wrapper.text()).toContain('LD');
    expect(wrapper.attributes('aria-label')).toBe('Louis Do');
    expect((wrapper.element as HTMLElement).style.width).toBe('56px');
  });

  it('falls back to initials when the image fails to load', async () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Maya Chen',
        src: 'https://images.example.com/maya.jpg',
      },
    });

    expect(wrapper.find('img').attributes('src')).toContain('maya.jpg');

    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('MC');
  });
});
