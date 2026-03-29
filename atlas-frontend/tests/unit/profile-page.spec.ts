import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProfilePage from '@/views/ProfilePage.vue';

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');

  return {
    ...actual,
    useRoute: () => ({
      params: {
        id: 'user-1',
      },
    }),
  };
});

describe('ProfilePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the profile workspace with highlights and trips for the requested user', () => {
    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          MapView: { template: '<div data-test="profile-map-stub">Map stub</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Adventure map and public highlights');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Design District Gallery Row');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.find('[data-test="profile-map-stub"]').exists()).toBe(true);
  });
});
