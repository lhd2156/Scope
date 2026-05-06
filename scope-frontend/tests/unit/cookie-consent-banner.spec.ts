import { mount } from '@vue/test-utils';
import { computed, ref } from 'vue';

const consentState = ref<'unknown' | 'granted' | 'denied'>('unknown');
const setAnalyticsConsentMock = vi.hoisted(() => vi.fn((nextConsent: 'granted' | 'denied') => {
  consentState.value = nextConsent;
}));

vi.mock('@/utils/analyticsConsent', () => ({
  useAnalyticsConsent: () => ({
    consent: consentState,
    hasAnalyticsConsentChoice: computed(() => consentState.value !== 'unknown'),
    setAnalyticsConsent: setAnalyticsConsentMock,
  }),
}));

import CookieConsentBanner from '@/components/common/CookieConsentBanner.vue';

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    consentState.value = 'unknown';
    setAnalyticsConsentMock.mockClear();
  });

  it('renders the consent copy and accepts analytics cookies', async () => {
    const wrapper = mount(CookieConsentBanner);

    expect(wrapper.get('[data-test="cookie-consent-banner"]').text()).toContain('Choose how Scope uses optional analytics cookies');

    await wrapper.get('[data-test="cookie-consent-accept"]').trigger('click');

    expect(setAnalyticsConsentMock).toHaveBeenCalledWith('granted');
    expect(wrapper.find('[data-test="cookie-consent-banner"]').exists()).toBe(false);
  });

  it('lets the traveler keep only necessary cookies', async () => {
    const wrapper = mount(CookieConsentBanner);

    await wrapper.get('[data-test="cookie-consent-decline"]').trigger('click');

    expect(setAnalyticsConsentMock).toHaveBeenCalledWith('denied');
    expect(wrapper.find('[data-test="cookie-consent-banner"]').exists()).toBe(false);
  });

  it('stays hidden after a consent choice has already been made', () => {
    consentState.value = 'granted';

    const wrapper = mount(CookieConsentBanner);

    expect(wrapper.find('[data-test="cookie-consent-banner"]').exists()).toBe(false);
  });
});
