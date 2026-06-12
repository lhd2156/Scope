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

  it('supports custom keys, staggered rendering, and clamps scroll after list shrink', async () => {
    const itemKey = vi.fn((item: unknown, index: number) => `custom-${String((item as { label?: string }).label ?? item)}-${index}`);
    const wrapper = mount(VirtualList, {
      props: {
        items: [
          { label: 'No id object' },
          'Primitive item',
          { id: 3, label: 'Numeric id item' },
          { label: 'Last item' },
        ],
        itemHeight: 30,
        viewportHeight: 60,
        overscan: 0,
        stagger: true,
        itemKey,
      },
      slots: {
        default: ({ item }: { item: { label?: string } | string }) => `<div class="row">${typeof item === 'string' ? item : item.label}</div>`,
      },
    });

    expect(wrapper.classes()).toContain('virtual-list--stagger');
    expect(itemKey).toHaveBeenCalledWith({ label: 'No id object' }, 0);

    const container = wrapper.get('.virtual-list').element as HTMLElement;
    container.scrollTop = 120;
    await wrapper.setProps({ items: [{ label: 'Only item left' }] });

    expect(container.scrollTop).toBe(0);
    expect(wrapper.text()).toContain('Only item left');

    const primitiveWrapper = mount(VirtualList, {
      props: {
        items: ['Primitive fallback'],
        itemHeight: 20,
        viewportHeight: 20,
      },
      slots: {
        default: ({ item }: { item: string }) => `<div class="row">${item}</div>`,
      },
    });

    expect(primitiveWrapper.text()).toContain('Primitive fallback');
  });

  it('uses built-in numeric keys and leaves scroll alone when shrink stays in range', async () => {
    const wrapper = mount(VirtualList, {
      props: {
        items: [
          { id: 101, label: 'Numeric key' },
          { label: 'Index fallback' },
          { id: 'string-key', label: 'String key' },
        ],
        itemHeight: 25,
        viewportHeight: 75,
        overscan: 0,
      },
      slots: {
        default: ({ item }: { item: { label: string } }) => `<div class="row">${item.label}</div>`,
      },
    });

    const container = wrapper.get('.virtual-list').element as HTMLElement;
    container.scrollTop = 0;
    await wrapper.setProps({
      items: [
        { id: 101, label: 'Numeric key' },
        { label: 'Index fallback' },
      ],
    });

    expect(container.scrollTop).toBe(0);
    expect(wrapper.text()).toContain('Numeric key');
    expect(wrapper.text()).toContain('Index fallback');
  });
});
