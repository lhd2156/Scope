import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, spotsStoreMock, toastStoreMock } = vi.hoisted(() => ({
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

import SpotComposerPage from '@/views/SpotComposerPage.vue';

describe('SpotComposerPage', () => {
  beforeEach(() => {
    spotsStoreMock.error = '';
    spotsStoreMock.fetchSpot.mockClear();
    spotsStoreMock.createSpot.mockClear();
    spotsStoreMock.updateSpot.mockClear();
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
    expect(router.currentRoute.value.fullPath).toBe('/spots/spot-7');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Spot updated',
      message: 'Scope saved the latest pin details for explorers.',
    });
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
            props: ['mode'],
            emits: ['submit', 'cancel'],
            template: '<button data-test="spot-form-submit" @click="$emit(\'submit\', { spot: { title: \'Created Spot\', description: \'Demo\', latitude: 32.7, longitude: -97.3, address: \'123 Main\', city: \'Fort Worth\', country: \'US\', category: \'food\', vibe: \'electric\', rating: 4.7, visitedAt: \'2026-03-29\', isPublic: true }, existingPhotos: [], newPhotos: [] })">{{ mode }}</button>',
          },
        },
      },
    });

    await wrapper.get('[data-test="spot-form-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('That spot could not be saved');
    expect(wrapper.text()).toContain('Scope could not save that spot right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Spot save failed',
      message: 'Scope could not save that spot right now.',
    });
  });
});
