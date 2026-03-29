import { mount } from '@vue/test-utils';
import MemberList from '@/components/trips/MemberList.vue';

describe('MemberList', () => {
  it('renders traveler initials and formatted role badges', () => {
    const wrapper = mount(MemberList, {
      props: {
        members: [
          { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
          { id: 'user-2', displayName: 'Maya Chen', status: 'editor' },
        ],
      },
    });

    expect(wrapper.text()).toContain('2 travelers');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Owner');
    expect(wrapper.text()).toContain('MC');
  });
});
