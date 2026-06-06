import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, listSpotsMock, spotsStoreMock, toastStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      homeBase: 'Fort Worth, TX',
    },
  },
  spotsStoreMock: {
    loading: false,
    saving: false,
    error: '',
    selectedSpot: {
      id: 'spot-7',
      title: 'Garden Gallery',
      description: 'Art and green space.',
      latitude: 32.7555,
      longitude: -97.3308,
      address: '123 Main St',
      city: 'Fort Worth',
      country: 'US',
      category: 'culture',
      vibe: 'curated',
      rating: 4.7,
      isPublic: false,
      createdAt: '2026-03-28T00:00:00Z',
      photos: [],
    },
    fetchSpot: vi.fn().mockResolvedValue(undefined),
    createSpot: vi.fn().mockResolvedValue({ id: 'spot-created' }),
    updateSpot: vi.fn().mockResolvedValue({ id: 'spot-7' }),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  listSpotsMock: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  listSpots: listSpotsMock,
}));

import SpotComposerPage from '@/views/SpotComposerPage.vue';

function buildSelectedSpot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spot-7',
    title: 'Garden Gallery',
    description: 'Art and green space.',
    latitude: 32.7555,
    longitude: -97.3308,
    address: '123 Main St',
    city: 'Fort Worth',
    country: 'US',
    category: 'culture',
    vibe: 'curated',
    rating: 4.7,
    isPublic: false,
    createdAt: '2026-03-28T00:00:00Z',
    photos: [],
    ...overrides,
  };
}

describe('SpotComposerPage', () => {
  beforeEach(() => {
    authStoreMock.currentUser = {
      id: 'user-1',
      homeBase: 'Fort Worth, TX',
    };
    spotsStoreMock.loading = false;
    spotsStoreMock.saving = false;
    spotsStoreMock.error = '';
    spotsStoreMock.selectedSpot = buildSelectedSpot();
    spotsStoreMock.fetchSpot.mockClear();
    spotsStoreMock.fetchSpot.mockImplementation(async () => spotsStoreMock.selectedSpot);
    spotsStoreMock.createSpot.mockClear();
    spotsStoreMock.createSpot.mockResolvedValue({ id: 'spot-created' });
    spotsStoreMock.updateSpot.mockClear();
    spotsStoreMock.updateSpot.mockResolvedValue(buildSelectedSpot());
    listSpotsMock.mockReset();
    listSpotsMock.mockResolvedValue({ data: [buildSelectedSpot()] });
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
  });

  it('submits create mode through the store, routes to the created spot, and shows a success toast', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/new', name: 'spot-create', component: SpotComposerPage },
        { path: '/spots/:id', name: 'spot-detail', component: { template: '<div>Spot detail target</div>' } },
      ],
    });

    await router.push('/spots/new');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['mode'],
            emits: ['submit', 'cancel'],
            template: '<button data-test="spot-form-submit" @click="$emit(\'submit\', { spot: { title: \'Created Spot\', description: \'Demo\', latitude: 32.7, longitude: -97.3, address: \'123 Main\', city: \'Fort Worth\', country: \'US\', category: \'food\', vibe: \'electric\', rating: 4.7, visitedAt: \'2026-03-29\', isPublic: true }, existingPhotos: [], newPhotos: [] })">{{ mode }}</button>',
          },
        },
      },
    });

    await wrapper.get('[data-test="spot-form-submit"]').trigger('click');
    await flushPromises();

    expect(spotsStoreMock.createSpot).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe('/spots/spot-created');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Spot published',
      message: 'Your new Scope pin is now ready for discovery.',
    });
  });

  it('loads edit mode, submits updates through the store, and shows a success toast', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
        { path: '/spots/:id', name: 'spot-detail', component: { template: '<div>Spot detail target</div>' } },
      ],
    });

    await router.push('/spots/spot-7/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['mode'],
            emits: ['submit', 'cancel'],
            template: '<button data-test="spot-form-submit" @click="$emit(\'submit\', { spot: { title: \'Updated Spot\', description: \'Demo\', latitude: 32.7, longitude: -97.3, address: \'123 Main\', city: \'Fort Worth\', country: \'US\', category: \'culture\', vibe: \'curated\', rating: 4.9, visitedAt: \'2026-03-29\', isPublic: true }, existingPhotos: [], newPhotos: [] })">{{ mode }}</button>',
          },
        },
      },
    });

    await flushPromises();
    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith('spot-7');
    expect(wrapper.get('[data-test="spot-form-submit"]').text()).toContain('edit');

    await wrapper.get('[data-test="spot-form-submit"]').trigger('click');
    await flushPromises();

    expect(spotsStoreMock.updateSpot).toHaveBeenCalledWith('spot-7', expect.any(Object), authStoreMock.currentUser);
    expect(router.currentRoute.value.fullPath).toBe('/spots/garden-gallery-fort-worth');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Spot updated',
      message: 'Scope saved the latest pin details for explorers.',
    });
  });

  it('loads edit mode from a polished spot slug by resolving the live spot id', async () => {
    const slugSpot = buildSelectedSpot({
      id: 'spot-88',
      title: 'Hidden Tea Garden',
    });
    spotsStoreMock.selectedSpot = null;
    listSpotsMock.mockResolvedValueOnce({ data: [slugSpot] });
    spotsStoreMock.fetchSpot.mockImplementationOnce(async (spotId: string) => {
      spotsStoreMock.selectedSpot = slugSpot;
      return { ...slugSpot, id: spotId };
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
      ],
    });

    await router.push('/spots/hidden-tea-garden-fort-worth/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['mode', 'initialValue'],
            template: '<div><span data-test="spot-form-mode">{{ mode }}</span><span data-test="spot-form-title">{{ initialValue.title }}</span></div>',
          },
        },
      },
    });

    await flushPromises();

    expect(listSpotsMock).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith('spot-88');
    expect(wrapper.get('[data-test="spot-form-mode"]').text()).toBe('edit');
  });

  it('loads legacy uuid edit routes directly without a public spot lookup', async () => {
    const uuid = '90000000-0000-0000-0000-000000000003';
    const uuidSpot = buildSelectedSpot({
      id: uuid,
      title: 'Legacy River Walk Pin',
    });
    spotsStoreMock.selectedSpot = null;
    spotsStoreMock.fetchSpot.mockImplementationOnce(async () => {
      spotsStoreMock.selectedSpot = uuidSpot;
      return uuidSpot;
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
      ],
    });

    await router.push(`/spots/${uuid}/edit`);
    await router.isReady();

    mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['mode', 'initialValue'],
            template: '<div><span data-test="spot-form-mode">{{ mode }}</span><span data-test="spot-form-title">{{ initialValue.title }}</span></div>',
          },
        },
      },
    });

    await flushPromises();

    expect(listSpotsMock).not.toHaveBeenCalled();
    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith(uuid);
  });

  it('passes the saved private visibility state into the edit form', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
      ],
    });

    await router.push('/spots/spot-7/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['initialValue'],
            template: '<div data-test="spot-form-visibility">{{ String(initialValue.isPublic) }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="spot-form-visibility"]').text()).toBe('false');
  });

  it('shows the edit loading state while the current spot draft is being fetched', async () => {
    spotsStoreMock.loading = true;

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
      ],
    });

    await router.push('/spots/spot-7/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: { template: '<div data-test="spot-form-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Pulling the current spot draft');
    expect(wrapper.text()).toContain('Scope is loading the existing pin so you can refine it safely.');
    expect(wrapper.find('[data-test="spot-form-stub"]').exists()).toBe(false);
  });

  it('shows an unavailable state when an edit route is missing its spot id', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/edit', name: 'spot-edit', component: SpotComposerPage },
        { path: '/explore', name: 'explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/spots/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: { template: '<div data-test="spot-form-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('That spot could not be loaded');
    expect(wrapper.text()).toContain('The requested pin may not exist yet or the content engine has not synced it back.');
    expect(wrapper.find('[data-test="spot-form-stub"]').exists()).toBe(false);
  });

  it('surfaces an unavailable edit state when the existing spot fetch fails', async () => {
    spotsStoreMock.fetchSpot.mockImplementation(async () => {
      spotsStoreMock.error = 'Scope could not load that spot right now.';
      throw new Error('Load failed');
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
        { path: '/explore', name: 'explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/spots/spot-7/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: { template: '<div data-test="spot-form-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('That spot could not be loaded');
    expect(wrapper.text()).toContain('Scope could not load that spot right now.');
  });

  it('cancels create mode back to explore', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/new', name: 'spot-create', component: SpotComposerPage },
        { path: '/explore', name: 'explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/spots/new');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            emits: ['cancel'],
            template: '<button data-test="spot-form-cancel" @click="$emit(\'cancel\')">Cancel</button>',
          },
        },
      },
    });

    await wrapper.get('[data-test="spot-form-cancel"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/explore');
  });

  it('cancels edit mode back to the original spot detail page', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
        { path: '/spots/:id', name: 'spot-detail', component: { template: '<div>Spot detail target</div>' } },
      ],
    });

    await router.push('/spots/spot-7/edit');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            emits: ['cancel'],
            template: '<button data-test="spot-form-cancel" @click="$emit(\'cancel\')">Cancel</button>',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="spot-form-cancel"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/spots/garden-gallery-fort-worth');
  });

  it('shows a save error when spot creation fails and emits an error toast', async () => {
    spotsStoreMock.createSpot.mockImplementation(async () => {
      spotsStoreMock.error = 'Scope could not save that spot right now.';
      throw new Error('Create failed');
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/new', name: 'spot-create', component: SpotComposerPage },
        { path: '/spots/:id', name: 'spot-detail', component: { template: '<div>Spot detail target</div>' } },
      ],
    });

    await router.push('/spots/new');
    await router.isReady();

    const wrapper = mount(SpotComposerPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotForm: {
            props: ['mode', 'serverRejection'],
            emits: ['submit', 'cancel', 'server-rejection-cleared'],
            template: '<div><button data-test="spot-form-submit" @click="$emit(\'submit\', { spot: { title: \'Created Spot\', description: \'Demo\', latitude: 32.7, longitude: -97.3, address: \'123 Main\', city: \'Fort Worth\', country: \'US\', category: \'food\', vibe: \'electric\', rating: 4.7, visitedAt: \'2026-03-29\', isPublic: true }, existingPhotos: [], newPhotos: [] })">{{ mode }}</button><section v-if="serverRejection" data-test="server-rejection-panel"><h2>{{ serverRejection.title }}</h2><p>{{ serverRejection.message }}</p><button data-test="clear-server-rejection" @click="$emit(\'server-rejection-cleared\')">Clear</button></section></div>',
          },
        },
      },
    });

    await wrapper.get('[data-test="spot-form-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="server-rejection-panel"]').text()).toContain('Needs a quick fix');
    expect(wrapper.text()).toContain('Scope could not save that spot right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Spot save failed',
      message: 'Scope could not save that spot right now.',
    });

    await wrapper.get('[data-test="clear-server-rejection"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="server-rejection-panel"]').exists()).toBe(false);
  });
});
