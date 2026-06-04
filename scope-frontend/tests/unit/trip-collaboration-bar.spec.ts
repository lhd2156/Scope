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

  it('keeps the Scope AI shortcut in the trip bar and emits an inline open request', async () => {
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

    expect(wrapper.get('[data-test="trip-open-ai"]').text()).toContain('Scope AI');

    await wrapper.get('[data-test="trip-open-ai"]').trigger('click');

    expect(wrapper.emitted('open-ai')).toHaveLength(1);
  });

  it('announces autosave state in the trip bar', async () => {
    const wrapper = mount(TripCollaborationBar, {
      props: {
        trip: draftTrip,
        members: draftTrip.members,
        saveState: 'unsaved',
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.get('[data-test="trip-autosave-status"]').text()).toBe('Autosave pending');

    await wrapper.setProps({ saveState: 'saving' });
    expect(wrapper.get('[data-test="trip-autosave-status"]').text()).toBe('Autosaving...');

    await wrapper.setProps({ saveState: 'saved' });
    expect(wrapper.get('[data-test="trip-autosave-status"]').text()).toBe('Autosaved');
  });

  it('emits draft actions and visibility changes while guarding unchanged or saving state', async () => {
    const wrapper = mount(TripCollaborationBar, {
      props: {
        trip: draftTrip,
        members: [
          { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
          { id: 'user-2', displayName: 'Maya Chen', status: 'editor', inviteStatus: 'pending' },
        ],
        saveState: 'unsaved',
        isPublic: false,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.text()).toContain('2 crew members');
    expect(wrapper.text()).toContain('Maya Chen pending');

    await wrapper.get('[data-test="trip-save-draft"]').trigger('click');
    await wrapper.get('[data-test="trip-share-button"]').trigger('click');
    await wrapper.get('[data-test="trip-visibility-public"]').trigger('click');
    await wrapper.get('[data-test="trip-visibility-private"]').trigger('click');

    expect(wrapper.emitted('save')).toHaveLength(1);
    expect(wrapper.emitted('share')).toHaveLength(1);
    expect(wrapper.emitted('update:isPublic')).toEqual([[true]]);

    await wrapper.setProps({ saving: true });
    await wrapper.get('[data-test="trip-visibility-public"]').trigger('click');
    expect(wrapper.emitted('update:isPublic')).toEqual([[true]]);
    expect(wrapper.get('[data-test="trip-save-draft"]').text()).toContain('Saving...');
  });

  it('renders an unsaved solo draft with optional controls hidden', () => {
    const wrapper = mount(TripCollaborationBar, {
      props: {
        trip: null,
        members: [],
        canEdit: false,
        canManage: false,
        showAiAction: false,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Unsaved draft');
    expect(wrapper.text()).toContain('1 crew member');
    expect(wrapper.text()).toContain('Only you for now');
    expect(wrapper.find('[data-test="trip-save-draft"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="trip-open-ai"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="trip-share-button"]').exists()).toBe(false);
  });
});
