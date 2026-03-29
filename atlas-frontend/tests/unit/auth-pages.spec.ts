import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    error: null as string | null,
    clearError: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    loginWithCognito: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import LoginPage from '@/views/LoginPage.vue';
import RegisterPage from '@/views/RegisterPage.vue';

describe('auth page views', () => {
  beforeEach(() => {
    authStoreMock.error = null;
    authStoreMock.clearError.mockClear();
    authStoreMock.login.mockClear();
    authStoreMock.loginWithCognito.mockClear();
    authStoreMock.register.mockClear();
  });

  it('submits the login form and redirects to the requested protected route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginPage },
        { path: '/friends', component: { template: '<div>Friends target</div>' } },
        { path: '/map', component: { template: '<div>Map target</div>' } },
      ],
    });

    await router.push('/login?redirect=/friends');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(authStoreMock.clearError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.login).toHaveBeenCalledWith({
      email: 'louis@example.com',
      password: 'SecurePass123!',
    });
    expect(router.currentRoute.value.fullPath).toBe('/friends');
  });

  it('surfaces login failures without redirecting away from the form', async () => {
    authStoreMock.login.mockImplementation(async () => {
      authStoreMock.error = 'Atlas could not sign you in right now.';
      throw new Error('Login failed');
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginPage },
        { path: '/map', component: { template: '<div>Map target</div>' } },
      ],
    });

    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Atlas could not sign you in right now.');
    expect(router.currentRoute.value.fullPath).toBe('/login');
  });

  it('submits registration and redirects to the requested protected route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', component: RegisterPage },
        { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
        { path: '/map', component: { template: '<div>Map target</div>' } },
      ],
    });

    await router.push('/register?redirect=/profile/user-1');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(authStoreMock.clearError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.register).toHaveBeenCalledWith({
      username: 'louisdo',
      displayName: 'Louis Do',
      email: 'louis@example.com',
      password: 'SecurePass123!',
    });
    expect(router.currentRoute.value.fullPath).toBe('/profile/user-1');
  });
});
