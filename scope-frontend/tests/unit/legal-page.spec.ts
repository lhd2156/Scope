import { mount } from '@vue/test-utils';

const { routeName } = vi.hoisted(() => ({
  routeName: { value: 'security' },
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');

  return {
    ...actual,
    useRoute: () => ({
      get name() {
        return routeName.value;
      },
    }),
  };
});

import LegalPage from '@/views/LegalPage.vue';

function mountLegalPage() {
  return mount(LegalPage, {
    global: {
      stubs: {
        AppShell: { template: '<main><slot /></main>' },
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
        },
      },
    },
  });
}

describe('LegalPage', () => {
  beforeEach(() => {
    routeName.value = 'security';
  });

  it('renders legal pages as plain documents with a related-page switcher', () => {
    const wrapper = mountLegalPage();

    expect(wrapper.find('[data-test="legal-hero"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="legal-page-switcher"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="legal-navigation"]').exists()).toBe(false);
    expect(wrapper.find('.legal-card').exists()).toBe(false);
    expect(wrapper.find('.legal-section__number').exists()).toBe(false);

    const headings = wrapper.findAll('.legal-section h2').map((heading) => heading.text());
    expect(headings).toEqual(['Account protection', 'Application controls', 'Operational practices', 'Reporting']);

    expect(wrapper.find('.legal-switcher__link.is-active').text()).toBe('Security');
  });

  it('switches shared structure for longer policy pages', () => {
    routeName.value = 'privacy';
    const wrapper = mountLegalPage();

    expect(wrapper.find('h1').text()).toBe('Privacy Policy');
    expect(wrapper.findAll('.legal-section')).toHaveLength(8);
    expect(wrapper.find('.legal-section h2').text()).toBe('Scope');
    expect(wrapper.find('.legal-section ul').exists()).toBe(true);
    expect(wrapper.find('.legal-switcher__link.is-active').text()).toBe('Privacy');
  });
});
