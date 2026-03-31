import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import FriendsPage from '@/views/FriendsPage.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/friends', component: FriendsPage },
      { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
    ],
  });
}

const globalStubs = {
  AppShell: { template: '<div><slot /></div>' },
  AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
  Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
  LazyImage: { props: ['src', 'alt'], template: '<img class="lazy-image-stub" :src="src" :alt="alt" />' },
};

describe('FriendsPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the premium friends workspace with friend cards and suggestions', async () => {
    const router = createTestRouter();

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('Build your Atlas travel circle.');
    expect(wrapper.get('[data-test="tab-all"]').text()).toContain('6');
    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(6);
    expect(wrapper.findAll('[data-test="suggestion-card"]')).toHaveLength(3);
    expect(wrapper.text()).toContain('People You May Know');
  });

  it('filters the grid through search plus the online tab and routes to a profile', async () => {
    vi.useFakeTimers();

    const router = createTestRouter();

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('[data-test="tab-online"]').trigger('click');
    expect(wrapper.text()).toContain('Friends online now');
    expect(wrapper.text()).toContain('Maya Chen');
    expect(wrapper.text()).not.toContain('Theo Alvarez');

    await wrapper.get('input[aria-label="Search friends"]').setValue('Priya');
    vi.advanceTimersByTime(320);
    await flushPromises();

    const friendCards = wrapper.findAll('[data-test="friend-card"]');
    expect(friendCards).toHaveLength(1);
    expect(wrapper.text()).toContain('Priya Nair');
    expect(wrapper.text()).not.toContain('Noah Kim');

    await wrapper.get('[data-test="view-profile-user-6"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/profile/user-6');
  });

  it('declines and accepts requests while keeping tab counts in sync', async () => {
    const router = createTestRouter();

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    expect(wrapper.findAll('[data-test="request-card"]')).toHaveLength(3);
    expect(wrapper.text()).toContain('Sofia Ramirez');
    expect(wrapper.text()).toContain('Jordan Reed');

    await wrapper.get('[data-test="decline-request-request-2"]').trigger('click');
    expect(wrapper.get('[data-test="tab-requests"]').text()).toContain('2');
    expect(wrapper.text()).not.toContain('Jordan Reed');

    await wrapper.get('[data-test="accept-request-request-1"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="tab-all"]').text()).toContain('7');
    expect(wrapper.get('[data-test="tab-requests"]').text()).toContain('1');
    expect(wrapper.get('[data-test="tab-all"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.text()).toContain('Sofia Ramirez');
    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(7);
  });
});
