import { mount } from '@vue/test-utils';
import MemberList from '@/components/trips/MemberList.vue';

describe('MemberList', () => {
  it('renders traveler avatars and formatted role badges', () => {
    const wrapper = mount(MemberList, {
      props: {
        members: [
          { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
          { id: 'user-2', displayName: 'Maya Chen', status: 'editor' },
        ],
      },
    });

    expect(wrapper.text()).toContain('2 total');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Maya Chen');
    expect(wrapper.text()).toContain('Owner');
    expect(wrapper.text()).toContain('Editor');
    expect(wrapper.findAll('.member-avatar')).toHaveLength(2);
  });

  it('uses fallback labels for pending invites and members without roles', () => {
    const wrapper = mount(MemberList, {
      props: {
        title: 'Planning crew',
        members: [
          { id: 'user-1', displayName: 'Pending Editor', status: 'editor', inviteStatus: 'pending' },
          { id: 'user-2', displayName: 'Role Later' },
        ],
      },
    });

    expect(wrapper.text()).toContain('Planning crew');
    expect(wrapper.text()).toContain('Editor invite pending');
    expect(wrapper.text()).toContain('Trip member');
  });
});
