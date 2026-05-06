import { mount } from '@vue/test-utils';
import Sidebar from '@/components/common/Sidebar.vue';

describe('Sidebar', () => {
  it('renders header content and emits collapsed state changes', async () => {
    const wrapper = mount(Sidebar, {
      props: {
        title: 'Map workspace',
        eyebrow: 'Filters',
        collapsible: true,
      },
      slots: {
        default: '<div data-test="sidebar-body">Body content</div>',
        footer: '<div data-test="sidebar-footer">Footer content</div>',
      },
    });

    expect(wrapper.text()).toContain('Map workspace');
    expect(wrapper.find('[data-test="sidebar-body"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="sidebar-footer"]').exists()).toBe(true);

    await wrapper.get('.sidebar-toggle').trigger('click');

    expect(wrapper.emitted('update:collapsed')?.[0]).toEqual([true]);
  });
});
