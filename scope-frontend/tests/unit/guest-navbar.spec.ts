import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import GuestNavbar from '@/components/common/GuestNavbar.vue';

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/explore', name: 'explore', component: { template: '<div>Explore</div>' } },
      { path: '/map', name: 'map', component: { template: '<div>Map</div>' } },
      { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
      { path: '/register', name: 'register', component: { template: '<div>Register</div>' } },
    ],
  });
}

describe('GuestNavbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  it('renders public navigation, auth actions, and active route state', async () => {
    const router = buildRouter();
    await router.push('/explore');
    await router.isReady();

    const wrapper = mount(GuestNavbar, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: false,
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Transition: false,
        },
      },
    });

    const primaryNav = wrapper.get('nav[aria-label="Primary"]');
    expect(primaryNav.text()).toContain('Home');
    expect(primaryNav.text()).toContain('Explore');
    expect(primaryNav.text()).toContain('Map');
    expect(primaryNav.find('a[href="/explore"]').classes()).toContain('is-active');

    expect(wrapper.get('.guest-navbar__brand').attributes('href')).toBe('/');
    expect(wrapper.get('.guest-navbar__ghost-link').attributes('href')).toBe('/login');
    expect(wrapper.get('.guest-navbar__accent-link').attributes('href')).toBe('/register');

    wrapper.unmount();
  });

  it('switches to scrolled styling when the public page scrolls', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(GuestNavbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          RouterLink: false,
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    expect(wrapper.get('.guest-navbar').classes()).not.toContain('guest-navbar--scrolled');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 48,
    });
    window.dispatchEvent(new Event('scroll'));
    await flushPromises();

    expect(wrapper.get('.guest-navbar').classes()).toContain('guest-navbar--scrolled');

    wrapper.unmount();
  });

  it('opens the mobile drawer, locks background scroll, and closes from the drawer controls', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(GuestNavbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          RouterLink: false,
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Transition: false,
        },
      },
    });

    const toggle = wrapper.get('.guest-navbar__mobile-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes('aria-label')).toBe('Open navigation drawer');

    await toggle.trigger('click');
    await flushPromises();

    const drawer = wrapper.get('.guest-navbar__mobile-drawer');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(toggle.attributes('aria-label')).toBe('Close navigation drawer');
    expect(toggle.attributes('aria-controls')).toBe(drawer.attributes('id'));
    expect(drawer.attributes('role')).toBe('dialog');
    expect(drawer.attributes('aria-modal')).toBe('true');
    expect(drawer.text()).toContain('Plan your next adventure');
    expect(drawer.text()).toContain('Curated highlights and featured journeys.');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(drawer.element);

    await wrapper.get('.guest-navbar__mobile-close').trigger('click');
    await flushPromises();

    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
  });

  it('closes the mobile drawer on navigation and cleans up page scroll on unmount', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(GuestNavbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          RouterLink: false,
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('.guest-navbar__mobile-toggle').trigger('click');
    await flushPromises();
    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('.guest-navbar__brand').trigger('click');
    await flushPromises();
    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    await wrapper.get('.guest-navbar__mobile-toggle').trigger('click');
    await flushPromises();
    await wrapper.get('.guest-navbar__mobile-secondary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/login');
    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(false);

    await router.push('/');
    await router.isReady();
    await wrapper.get('.guest-navbar__mobile-toggle').trigger('click');
    await flushPromises();
    await wrapper.get('.guest-navbar__mobile-primary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/register');
    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(false);

    await router.push('/');
    await router.isReady();
    await wrapper.get('.guest-navbar__mobile-toggle').trigger('click');
    await flushPromises();
    await wrapper.get('.guest-navbar__mobile-link[href="/map"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/map');
    expect(wrapper.find('.guest-navbar__mobile-drawer').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    await wrapper.get('.guest-navbar__mobile-toggle').trigger('click');
    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');

    wrapper.unmount();

    expect(document.body.style.overflow).toBe('');
  });
});
