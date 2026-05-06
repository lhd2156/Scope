import { mount } from '@vue/test-utils';
import VirtualList from '@/components/common/VirtualList.vue';

describe('VirtualList', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }));

  it('renders only the visible slice of a long list', async () => {
    const wrapper = mount(VirtualList, {
      props: {
        items,
        itemHeight: 40,
        viewportHeight: 120,
        overscan: 1,
      },
      slots: {
        default: ({ item }: { item: { label: string } }) => `<div class="row">${item.label}</div>`,
      },
    });

    expect(wrapper.text()).toContain('Item 0');
    expect(wrapper.text()).toContain('Item 3');
    expect(wrapper.text()).not.toContain('Item 10');

    const container = wrapper.get('.virtual-list');
    (container.element as HTMLElement).scrollTop = 240;
    await container.trigger('scroll');

    expect(wrapper.text()).toContain('Item 6');
    expect(wrapper.text()).not.toContain('Item 0');
  });
});
