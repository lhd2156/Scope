import { mount } from '@vue/test-utils';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';

describe('EmptyStatePanel', () => {
  it('renders reusable copy, premium artwork chrome, and action content', () => {
    const wrapper = mount(EmptyStatePanel, {
      props: {
        eyebrow: 'Network activity',
        title: 'No updates yet',
        description: 'Your Atlas feed will populate here soon.',
        icon: 'bell',
        tone: 'surface',
        artwork: 'notification',
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
    expect(wrapper.classes()).toContain('empty-state-panel--artwork-notification');
    expect(wrapper.text()).toContain('Network activity');
    expect(wrapper.find('h4').text()).toBe('No updates yet');
    expect(wrapper.text()).toContain('Your Atlas feed will populate here soon.');
    expect(wrapper.find('[data-test="empty-state-artwork"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="empty-state-pill"]')).toHaveLength(3);
    expect(wrapper.findAll('.atlas-icon-stub').length).toBeGreaterThan(1);
    expect(wrapper.find('.button').text()).toBe('Refresh');
  });

  it('supports centered alignment for full-page empty states', () => {
    const wrapper = mount(EmptyStatePanel, {
      props: {
        title: 'Trip unavailable',
        description: 'Atlas could not open that trip yet.',
        alignment: 'center',
        artwork: 'itinerary',
      },
      global: {
        stubs: {
          AtlasIcon: { template: '<span class="atlas-icon-stub" />' },
        },
      },
    });

    expect(wrapper.classes()).toContain('empty-state-panel--align-center');
  });
});
