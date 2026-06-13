import { mount } from '@vue/test-utils';
import TripShareModal from '@/components/trips/TripShareModal.vue';
import type { Trip, TripMember } from '@/types';

const trip: Trip = {
  id: 'trip-share-1',
  title: 'Hill Country Crew Route',
  destination: 'Austin, TX',
  isPublic: false,
  startDate: '2026-06-12',
  endDate: '2026-06-13',
  spots: [],
  members: [],
};

const members: TripMember[] = [
  { id: 'owner-1', displayName: 'Louis Do', status: 'owner' },
  { id: 'editor-1', displayName: 'Maya Chen', status: 'editor', inviteStatus: 'pending' },
  { id: 'viewer-1', displayName: 'Noah Kim', status: 'viewer' },
];

function mountModal(overrides: Partial<InstanceType<typeof TripShareModal>['$props']> = {}) {
  return mount(TripShareModal, {
    props: {
      open: true,
      trip,
      members,
      shareLink: 'https://scope.test/trips/shared/abc123',
      submitting: false,
      canManage: true,
      ...overrides,
    },
    global: {
      stubs: {
        Avatar: { props: ['name'], template: '<span class="avatar-stub">{{ name }}</span>' },
        Modal: {
          props: ['open', 'title', 'eyebrow'],
          emits: ['close'],
          template: `
            <section v-if="open" data-test="modal">
              <h2>{{ title }}</h2>
              <p>{{ eyebrow }}</p>
              <button type="button" data-test="modal-close" @click="$emit('close')">Close</button>
              <slot />
            </section>
          `,
        },
        ScopeIcon: { props: ['name', 'label'], template: '<i :data-icon="name" :aria-label="label" />' },
      },
    },
  });
}

describe('TripShareModal', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders share link state, copies the URL, and resets when closed', async () => {
    const wrapper = mountModal();

    expect(wrapper.text()).toContain('Share this trip');
    expect(wrapper.text()).toContain('Hill Country Crew Route');
    expect(wrapper.get<HTMLInputElement>('[data-test="trip-share-link-input"]').element.value).toBe(
      'https://scope.test/trips/shared/abc123',
    );

    await wrapper.get('[data-test="copy-trip-link"]').trigger('click');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://scope.test/trips/shared/abc123');
    expect(wrapper.text()).toContain('Copied');

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    expect(wrapper.get('[data-test="copy-trip-link"]').text()).toContain('Copy');
  });

  it('validates member invites and emits editor/viewer invites', async () => {
    const wrapper = mountModal();

    await wrapper.get('[data-test="trip-share-submit"]').trigger('submit');
    expect(wrapper.text()).toContain('Search for a registered Scope member');
    expect(wrapper.emitted('invite')).toBeUndefined();

    await wrapper.get('[data-test="trip-share-recipient"]').setValue('+1 (555) 123-4567');
    await wrapper.get('[data-test="trip-share-submit"]').trigger('submit');
    expect(wrapper.text()).toContain('Phone-only invites are not supported');
    expect(wrapper.emitted('invite')).toBeUndefined();

    await wrapper.get('[data-test="trip-share-recipient"]').setValue('maya@example.com');
    await wrapper.findAll('.role-option')[1]?.trigger('click');
    await wrapper.get('[data-test="trip-share-submit"]').trigger('submit');

    expect(wrapper.emitted('invite')?.[0]).toEqual([{ recipient: 'maya@example.com', role: 'viewer' }]);
  });

  it('labels crew roles and only emits real role changes for manageable members', async () => {
    const wrapper = mountModal();

    expect(wrapper.text()).toContain('Owner');
    expect(wrapper.text()).toContain('Editor invite pending');
    expect(wrapper.text()).toContain('Viewer');

    const roleButtons = wrapper.findAll('.crew-role-button');
    await roleButtons.find((button) => button.text() === 'Can view')?.trigger('click');
    expect(wrapper.emitted('updateRole')?.[0]).toEqual([{ userId: 'editor-1', role: 'viewer' }]);

    await roleButtons.find((button) => button.text() === 'Can view' && button.classes('active'))?.trigger('click');
    expect(wrapper.emitted('updateRole')).toHaveLength(1);

    await wrapper.setProps({ canManage: false });
    expect(wrapper.find('[data-test="trip-member-role-select"]').exists()).toBe(false);
  });

  it('handles draft trips and unavailable clipboard without emitting side effects', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    const wrapper = mountModal({
      trip: null,
      members: [],
      shareLink: '',
      submitting: true,
    });

    expect(wrapper.text()).toContain('Trip draft');
    expect(wrapper.text()).toContain('Save this trip first');
    expect(wrapper.get('[data-test="copy-trip-link"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="trip-share-submit"]').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ shareLink: 'https://scope.test/fail' });
    await wrapper.get('[data-test="copy-trip-link"]').trigger('click');
    expect(wrapper.get('[data-test="copy-trip-link"]').text()).toContain('Copy');
  });

  it('keeps private trips invite-only without exposing an anonymous URL', () => {
    const wrapper = mountModal({
      trip,
      shareLink: '',
    });

    expect(wrapper.text()).toContain('Only invited Scope members can open it');
    expect(wrapper.get<HTMLInputElement>('[data-test="trip-share-link-input"]').element.value).toBe('');
    expect(wrapper.get('[data-test="trip-share-link-input"]').attributes('placeholder')).toBe(
      'Private trips do not have anonymous links',
    );
    expect(wrapper.get('[data-test="copy-trip-link"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="trip-share-form"]').exists()).toBe(true);
  });
});
