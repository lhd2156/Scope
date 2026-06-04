import { mount } from '@vue/test-utils';
import NotFoundPage from '@/views/NotFoundPage.vue';

describe('NotFoundPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/missing-route');
  });

  it('renders the fallback message and recovery routes', () => {
    const wrapper = mount(NotFoundPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SectionHeading: {
            props: ['eyebrow', 'title', 'description'],
            template: '<div data-test="heading">{{ eyebrow }} {{ title }} {{ description }}</div>',
          },
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('This trail does not exist in Scope');
    expect(wrapper.text()).toContain('Page not found');
    expect(wrapper.text()).toContain('Explore spots');
    expect(wrapper.text()).toContain('Open map');

    const links = wrapper.findAll('a').map((link) => ({ href: link.attributes('href'), text: link.text() }));
    expect(links).toEqual([
      { href: '/', text: 'Return home' },
      { href: '/explore', text: 'Explore spots' },
      { href: '/map', text: 'Open map' },
    ]);
  });

  it('renders the audit shell directly during Scope QA sessions', () => {
    window.history.pushState({}, '', '/missing-route?scopeQaSession=guest');

    const wrapper = mount(NotFoundPage, {
      global: {
        stubs: {
          AppShell: { template: '<div data-test="app-shell"><slot /></div>' },
          SectionHeading: {
            props: ['eyebrow', 'title', 'description'],
            template: '<div data-test="heading">{{ eyebrow }} {{ title }} {{ description }}</div>',
          },
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-test="app-shell"]').exists()).toBe(false);
    expect(wrapper.get('main').classes()).toContain('not-found-audit-shell');
    expect(wrapper.get('[role="alert"]').attributes('aria-live')).toBe('polite');
    expect(wrapper.text()).toContain('Return home');
    expect(wrapper.text()).toContain('Explore spots');
    expect(wrapper.text()).toContain('Open map');
  });
});
