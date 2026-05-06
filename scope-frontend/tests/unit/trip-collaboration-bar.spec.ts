import { mount, RouterLinkStub } from '@vue/test-utils';
import TripCollaborationBar from '@/components/trips/TripCollaborationBar.vue';
import type { Trip } from '@/types';

const draftTrip: Trip = {
  id: 'draft-1',
  title: 'Saved desert route',
  destination: 'Williams, AZ to Santa Fe, NM',
  description: 'Planner draft',
  isPublic: false,
  startDate: '2026-05-01',
  endDate: '2026-05-02',
  spots: [],
  members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
  status: 'planning',
};

describe('TripCollaborationBar', () => {
  it('shows edit and delete controls once the autosaved draft exists', async () => {
    const wrapper = mount(TripCollaborationBar, {
      props: {
        trip: draftTrip,
        members: draftTrip.members,
        saveState: 'saved',
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Edit');
    expect(wrapper.get('[data-test="trip-delete-draft"]').exists()).toBe(true);

    await wrapper.get('[data-test="trip-delete-draft"]').trigger('click');

    expect(wrapper.emitted('delete')).toHaveLength(1);
  });

  it('can hide the edit shortcut when the planner should stay in the current draft workspace', () => {
    const wrapper = mount(TripCollaborationBar, {
      props: {
        trip: draftTrip,
        members: draftTrip.members,
        saveState: 'saved',
        showEditLink: false,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.find('.workspace-link--edit').exists()).toBe(false);
    expect(wrapper.get('[data-test="trip-delete-draft"]').exists()).toBe(true);
  });
});
