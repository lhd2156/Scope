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

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => true,
}));

import SpotComposerPage from '@/views/SpotComposerPage.vue';

async function mountComposer(path: string, routes: Parameters<typeof createRouter>[0]['routes']) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });

  await router.push(path);
  await router.isReady();

  const wrapper = mount(SpotComposerPage, {
    global: {
      plugins: [router],
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        SpotForm: { template: '<form data-test="spot-form-stub" />' },
      },
    },
  });

  await flushPromises();

  return wrapper;
}

describe('SpotComposerPage QA preview', () => {
  beforeEach(() => {
    spotsStoreMock.fetchSpot.mockClear();
  });

  it('renders a compact create-mode composer preview without loading the full form', async () => {
    const wrapper = await mountComposer('/spots/new', [
      { path: '/spots/new', name: 'spot-create', component: SpotComposerPage },
    ]);

    expect(wrapper.text()).toContain('Spot composer preview');
    expect(wrapper.text()).toContain('Pin creation stays condensed for quick previews.');
    expect(wrapper.text()).toContain('Creating new pin');
    expect(wrapper.text()).toContain('Fort Worth');
    expect(wrapper.text()).toContain('Return to explore');
    expect(wrapper.find('[data-test="spot-form-stub"]').exists()).toBe(false);
    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
  });

  it('renders a compact edit-mode composer preview without fetching the editable spot', async () => {
    const wrapper = await mountComposer('/spots/spot-7/edit', [
      { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage },
    ]);

    expect(wrapper.text()).toContain('Pin refinement stays condensed for quick previews.');
    expect(wrapper.text()).toContain('Editing community pin');
    expect(wrapper.text()).toContain('Fort Worth');
    expect(wrapper.text()).toContain('culture');
    expect(wrapper.text()).toContain('Return to spot detail');
    expect(wrapper.find('[data-test="spot-form-stub"]').exists()).toBe(false);
    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
  });
});
