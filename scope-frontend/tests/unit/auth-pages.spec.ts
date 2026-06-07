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

vi.stubEnv('VITE_ENABLE_COGNITO_OAUTH', 'true');

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

    await wrapper.get('input[autocomplete="username"]').setValue('louis@example.com');
    await wrapper.get('input[type="password"]').setValue('SecurePass123!');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(authStoreMock.clearError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.login).toHaveBeenCalledWith({
      email: 'louis@example.com',
      password: 'SecurePass123!',
      rememberMe: true,
    });
    expect(router.currentRoute.value.fullPath).toBe('/friends');
  });

  it('blocks empty login input before the auth request fires', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginPage }],
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

    await wrapper.get('input[autocomplete="username"]').setValue('   ');
    await wrapper.get('input[type="password"]').setValue('   ');
    await wrapper.get('form').trigger('submit');

    expect(authStoreMock.login).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Enter your email, phone number, or display name.');
    expect(wrapper.text()).toContain('Enter your password to continue.');
  });

  it('keeps the login background free of floating panel effects', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginPage }],
    });

    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.auth-stage__particle-layer').exists()).toBe(false);
    expect(wrapper.find('.auth-stage').classes()).not.toContain('has-panel-effects');
  });

  it('keeps shared footer legal links reachable on auth pages', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginPage },
        { path: '/register', component: RegisterPage },
        { path: '/privacy', name: 'privacy', component: { template: '<div>Privacy target</div>' } },
        { path: '/terms', name: 'terms', component: { template: '<div>Terms target</div>' } },
      ],
    });

    await router.push('/login');
    await router.isReady();

    const loginWrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });

    const loginFooter = loginWrapper.get('.app-footer');
    expect(loginFooter.text()).toContain('Privacy Policy');
    expect(loginFooter.text()).toContain('Terms of Service');

    await router.push('/register');

    const registerWrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
      },
    });

    const registerFooter = registerWrapper.get('.app-footer');
    expect(registerFooter.text()).toContain('Privacy Policy');
    expect(registerFooter.text()).toContain('Terms of Service');
  });

  it('surfaces login failures without redirecting away from the form', async () => {
    authStoreMock.login.mockImplementation(async () => {
      authStoreMock.error = 'Scope could not sign you in right now.';
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

    await wrapper.get('input[autocomplete="username"]').setValue('louis@example.com');
    await wrapper.get('input[type="password"]').setValue('SecurePass123!');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not sign you in right now.');
    expect(router.currentRoute.value.fullPath).toBe('/login');
  });

  it('toggles password visibility and continues with Google from login', async () => {
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
      },
    });

    const passwordInput = wrapper.get('input[type="password"]');
    await wrapper.get('button[aria-label="Show password"]').trigger('click');

    expect(passwordInput.element.getAttribute('type')).toBe('text');

    await wrapper.get('button.oauth-button').trigger('click');
    await flushPromises();

    expect(authStoreMock.loginWithCognito).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe('/map');
  });

  it('submits registration and routes through the preferences onboarding step', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', component: RegisterPage },
        { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
        { path: '/map', component: { template: '<div>Map target</div>' } },
        {
          path: '/onboarding/preferences',
          name: 'onboarding-preferences',
          component: { template: '<div>Onboarding target</div>' },
        },
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

    // Compute a birthday that satisfies the 13+ COPPA floor regardless of
    // when the test runs (the validator otherwise rejects it).
    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 24);
    const isoDob = dob.toISOString().slice(0, 10);

    const inputs = wrapper.findAll('input');
    // Field order: firstName, lastName, username, email, birthday, phone, password, confirmPassword, terms.
    await inputs[0].setValue('John');
    await inputs[1].setValue('Doe');
    await inputs[2].setValue('johndoe');
    await inputs[3].setValue('john@example.com');
    await inputs[4].setValue(isoDob);
    await inputs[5].setValue('(555) 123-4567');
    await inputs[6].setValue('SecurePass123!');
    await inputs[7].setValue('SecurePass123!');
    await inputs[8].setValue(true);

    const passwordToggleButtons = wrapper.findAll('button[aria-label="Show password"]');
    await passwordToggleButtons[0].trigger('click');
    await passwordToggleButtons[1].trigger('click');
    expect((inputs[6].element as HTMLInputElement).type).toBe('text');
    expect((inputs[7].element as HTMLInputElement).type).toBe('text');

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(authStoreMock.clearError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.register).toHaveBeenCalledWith({
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '(555) 123-4567',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: isoDob,
      acceptedTerms: true,
    });
    // After register we send users through preferences first, passing the
    // original redirect forward so they can still land on the deep link.
    expect(router.currentRoute.value.name).toBe('onboarding-preferences');
    expect(router.currentRoute.value.query.redirect).toBe('/profile/user-1');
  });

  it('blocks first and last names that look like handles', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 24);
    const isoDob = dob.toISOString().slice(0, 10);

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('@john');
    await inputs[1].setValue('Doe');
    await inputs[2].setValue('johndoe');
    await inputs[3].setValue('john@example.com');
    await inputs[4].setValue(isoDob);
    await inputs[5].setValue('');
    await inputs[6].setValue('SecurePass123!');
    await inputs[7].setValue('SecurePass123!');
    await inputs[8].setValue(true);
    await wrapper.get('form').trigger('submit');

    expect(authStoreMock.register).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('letters, spaces');
  });

  it('formats registration phone input and caps it at 10 digits', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    const phoneInput = wrapper.findAll('input')[5];
    await phoneInput.setValue('555123456789');
    await flushPromises();

    expect((phoneInput.element as HTMLInputElement).value).toBe('(555) 123-4567');
  });

  it('blocks malformed registration input before the auth request fires', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('   ');
    await inputs[1].setValue('   ');
    await inputs[2].setValue('a');
    await inputs[3].setValue('not-an-email');
    await inputs[4].setValue('');
    await inputs[5].setValue('555');
    await inputs[6].setValue('123');
    await inputs[7].setValue('');
    await inputs[8].setValue(true);
    await wrapper.get('form').trigger('submit');

    expect(authStoreMock.register).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Enter your first name.');
    expect(wrapper.text()).toContain('Enter your last name.');
    expect(wrapper.text()).toContain('Use at least 3 characters.');
    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(wrapper.text()).toContain('Use at least 10 characters for a stronger password.');
    expect(wrapper.text()).toContain('10-digit phone number');
    expect(wrapper.text()).toContain('You must be 13 or older to use Scope.');
    expect(wrapper.get('.date-field__message').classes()).toContain('is-error');
    expect(wrapper.text()).toContain('Re-enter your password');
  });

  it('blocks registration when the confirmation password does not match', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 24);
    const isoDob = dob.toISOString().slice(0, 10);

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('John');
    await inputs[1].setValue('Doe');
    await inputs[2].setValue('johndoe');
    await inputs[3].setValue('john@example.com');
    await inputs[4].setValue(isoDob);
    await inputs[5].setValue('');
    await inputs[6].setValue('SecurePass123!');
    await inputs[7].setValue('SecurePass124!');
    await inputs[8].setValue(true);
    await wrapper.get('form').trigger('submit');

    expect(authStoreMock.register).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Those two entries do not match yet');
  });

  it('surfaces registration failures without leaving the form', async () => {
    authStoreMock.register.mockRejectedValueOnce(new Error('Register failed'));

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', component: RegisterPage },
        {
          path: '/onboarding/preferences',
          name: 'onboarding-preferences',
          component: { template: '<div>Onboarding target</div>' },
        },
      ],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
        },
      },
    });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 24);
    const isoDob = dob.toISOString().slice(0, 10);

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('John');
    await inputs[1].setValue('Doe');
    await inputs[2].setValue('johndoe');
    await inputs[3].setValue('john@example.com');
    await inputs[4].setValue(isoDob);
    await inputs[5].setValue('');
    await inputs[6].setValue('SecurePass123!');
    await inputs[7].setValue('SecurePass123!');
    await inputs[8].setValue(true);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(authStoreMock.register).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Scope could not create your account right now.');
    expect(router.currentRoute.value.fullPath).toBe('/register');
  });

  it('requires terms before continuing registration with Google', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
      },
    });

    await wrapper.get('button.oauth-button').trigger('click');
    await flushPromises();

    expect(authStoreMock.loginWithCognito).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(
      'Agree to the Terms of Service and Privacy Policy before continuing with Google.',
    );
    expect(router.currentRoute.value.fullPath).toBe('/register');
  });

  it('continues registration with Google and routes to onboarding', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', component: RegisterPage },
        { path: '/map', component: { template: '<div>Map target</div>' } },
        {
          path: '/onboarding/preferences',
          name: 'onboarding-preferences',
          component: { template: '<div>Onboarding target</div>' },
        },
      ],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
      },
    });

    await wrapper.get('#register-accept-terms').setValue(true);
    await wrapper.get('button.oauth-button').trigger('click');
    await flushPromises();

    expect(authStoreMock.clearError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.loginWithCognito).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('onboarding-preferences');
    expect(router.currentRoute.value.query).toEqual({});
  });

  it('surfaces Google registration failures without redirecting', async () => {
    authStoreMock.loginWithCognito.mockRejectedValueOnce(new Error('Google failed'));

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', component: RegisterPage },
        {
          path: '/onboarding/preferences',
          name: 'onboarding-preferences',
          component: { template: '<div>Onboarding target</div>' },
        },
      ],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [router],
      },
    });

    await wrapper.get('#register-accept-terms').setValue(true);
    await wrapper.get('button.oauth-button').trigger('click');
    await flushPromises();

    expect(authStoreMock.loginWithCognito).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Scope could not continue with Google right now.');
    expect(router.currentRoute.value.fullPath).toBe('/register');
  });
});
