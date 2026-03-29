import { mount } from '@vue/test-utils';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';

describe('EmptyStatePanel', () => {
  it('renders reusable copy, icon chrome, and action content', () => {
    const wrapper = mount(EmptyStatePanel, {
      props: {
        eyebrow: 'Network activity',
        title: 'No updates yet',
        description: 'Your Atlas feed will populate here soon.',
        icon: 'bell',
        tone: 'surface',
        headingLevel: 'h4',
      },
      slots: {
        default: '<button class="button">Refresh</button>',
      },
      global: {
        stubs: {
          AtlasIcon: { template: '<span class="atlas-icon-stub" />' },
        },
      },
    });

    expect(wrapper.classes()).toContain('empty-state-panel--surface');
    expect(wrapper.text()).toContain('Network activity');
    expect(wrapper.find('h4').text()).toBe('No updates yet');
    expect(wrapper.text()).toContain('Your Atlas feed will populate here soon.');
    expect(wrapper.find('.atlas-icon-stub').exists()).toBe(true);
    expect(wrapper.find('.button').text()).toBe('Refresh');
  });
});
