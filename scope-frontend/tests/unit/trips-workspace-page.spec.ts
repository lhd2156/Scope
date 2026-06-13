import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, toastStoreMock, tripsStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
    },
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  tripsStoreMock: {
    items: [] as any[],
    activeTrip: null as any,
    error: '',
    fetchTrips: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

import TripsWorkspacePage from '@/views/TripsWorkspacePage.vue';

describe('TripsWorkspacePage', () => {
  function buildTrip(overrides: Record<string, unknown> = {}) {
    return {
      id: 'saved-trip-1',
      title: 'Hill Country Draft',
      destination: 'Austin, TX',
      description: 'A simple saved draft.',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 525,
      currency: 'USD',
      status: 'planning',
      coverImageUrl: '',
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      spots: [],
      ...overrides,
    };
  }

  async function mountPage(fullPath = '/trips') {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/trips', name: 'trips', component: TripsWorkspacePage },
        { path: '/trips/new', name: 'trip-planner', component: { template: '<div />' } },
        { path: '/trips/:id/edit', name: 'trip-edit', component: { template: '<div />' } },
      ],
    });

    await router.push(fullPath);
    await router.isReady();

    const wrapper = mount(TripsWorkspacePage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          Avatar: { template: '<span data-test="avatar-stub" />' },
          FloatingTripAiAssistant: { template: '<div data-test="assistant-stub" />' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    return { wrapper, router };
  }

  beforeEach(() => {
    tripsStoreMock.items = [
      buildTrip(),
    ];
    tripsStoreMock.activeTrip = tripsStoreMock.items[0];
    tripsStoreMock.error = '';
    tripsStoreMock.fetchTrips.mockReset().mockResolvedValue(undefined);
    tripsStoreMock.deleteTrip.mockReset().mockResolvedValue(undefined);
    toastStoreMock.showSuccess.mockReset();
    toastStoreMock.showError.mockReset();
  });

  it('renders the trips workspace without the AI assistant surface', async () => {
    const { wrapper } = await mountPage('/trips?assistant=open');

    await flushPromises();

    expect(tripsStoreMock.fetchTrips).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Hill Country Draft');
    expect(wrapper.find('[data-test="assistant-stub"]').exists()).toBe(false);
  });

  it('opens the shared section when the current user only has member trips', async () => {
    tripsStoreMock.items = [
      buildTrip({
        id: 'shared-trip-1',
        title: 'Shared Fort Worth Weekend',
        destination: 'Fort Worth, TX',
        description: 'A collaborator-visible route.',
        isPublic: true,
        startDate: '2026-06-05',
        endDate: '2026-06-07',
        budget: 650,
        currency: 'USD',
        status: 'planning',
        coverImageUrl: '',
        members: [
          { id: 'owner-1', displayName: 'Owner One', status: 'owner' },
          { id: 'user-1', displayName: 'Louis Do', status: 'editor' },
        ],
        spots: [],
      }),
    ];

    const { wrapper } = await mountPage();

    await flushPromises();

    expect(wrapper.text()).toContain('Shared Fort Worth Weekend');
    expect(wrapper.find('.metric-card--active').text()).toContain('Shared');
    expect(wrapper.text()).toContain('2 travelers');
    expect(wrapper.text()).toContain('Shared');
  });

  it('opens upcoming as the first populated workspace view for signed-out readers', async () => {
    authStoreMock.currentUser = null as any;
    tripsStoreMock.items = [
      buildTrip({
        id: 'future-trip',
        title: 'Future Coast Route',
        destination: 'Monterey, CA',
        description: 'Confirmed future route.',
        isPublic: true,
        status: 'confirmed',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        spots: [],
        members: [{ id: 'owner-1', displayName: 'Owner One', status: 'owner' }],
      }),
    ];

    const { wrapper } = await mountPage();
    await flushPromises();

    expect(wrapper.find('.metric-card--active').text()).toContain('Upcoming');
    expect(wrapper.text()).toContain('Future Coast Route');
    expect(wrapper.text()).toContain('1 traveler');
    expect(wrapper.text()).toContain('Public');

    authStoreMock.currentUser = { id: 'user-1' };
  });

  it('switches workspace sections and deletes draft trips with success feedback', async () => {
    tripsStoreMock.items = [
      buildTrip({
        id: 'draft-trip',
        title: 'Editable Draft',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        spots: [{ id: 'stop-1' }],
      }),
      buildTrip({
        id: 'upcoming-trip',
        title: 'Upcoming Denver Route',
        destination: 'Denver, CO',
        isPublic: true,
        status: 'confirmed',
        startDate: '2026-07-10',
        endDate: '2026-07-12',
        spots: [{ id: 'stop-1' }, { id: 'stop-2' }],
      }),
    ];

    const { wrapper } = await mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Editable Draft');
    expect(wrapper.text()).toContain('Jun 1');
    expect(wrapper.text()).toContain('1 route stop');
    expect(wrapper.text()).toContain('Private');

    await wrapper.find('[data-test="delete-draft-trip"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('draft-trip');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft deleted',
      message: 'Editable Draft was removed from your workspace.',
    });

    await wrapper.findAll('.metric-card').find((button) => button.text().includes('Upcoming'))?.trigger('click');
    expect(wrapper.text()).toContain('Upcoming Denver Route');
    expect(wrapper.text()).toContain('2 route stops');
    expect(wrapper.text()).toContain('Public');
  });

  it('surfaces draft delete failures and prevents duplicate deletes while one is pending', async () => {
    let rejectDelete!: (error: Error) => void;
    tripsStoreMock.items = [
      buildTrip({
        id: 'stuck-draft',
        title: '',
      }),
    ];
    tripsStoreMock.error = 'Delete is still syncing.';
    tripsStoreMock.deleteTrip.mockReturnValue(new Promise((_resolve, reject) => {
      rejectDelete = reject;
    }));

    const { wrapper } = await mountPage();
    await flushPromises();

    const deleteButton = wrapper.get('[data-test="delete-draft-trip"]');
    await deleteButton.trigger('click');
    await deleteButton.trigger('click');
    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledTimes(1);

    rejectDelete(new Error('delete failed'));
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft delete failed',
      message: 'Delete is still syncing.',
    });
  });

  it('uses fallback copy when an untitled draft deletes successfully', async () => {
    tripsStoreMock.items = [
      buildTrip({
        id: 'untitled-draft',
        title: '',
      }),
    ];

    const { wrapper } = await mountPage();
    await flushPromises();

    await wrapper.get('[data-test="delete-draft-trip"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('untitled-draft');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft deleted',
      message: 'Trip draft was removed from your workspace.',
    });
  });

  it('renders section-specific empty states after filtering reference trips', async () => {
    tripsStoreMock.items = [
      buildTrip({
        id: 'trip-1',
        title: 'Reference trip hidden from workspace',
      }),
    ];

    const { wrapper } = await mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('No drafts yet');
    expect(wrapper.text()).toContain('Create a trip when you are ready to shape the route.');

    await wrapper.findAll('.metric-card').find((button) => button.text().includes('Shared'))?.trigger('click');
    expect(wrapper.text()).toContain('No shared trips yet');
    expect(wrapper.text()).not.toContain('Reference trip hidden from workspace');

    await wrapper.findAll('.metric-card').find((button) => button.text().includes('Upcoming'))?.trigger('click');
    expect(wrapper.text()).toContain('Nothing scheduled yet');
    expect(wrapper.text()).toContain('Trips with future dates will appear here.');
  });
});
