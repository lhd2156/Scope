import { mount } from '@vue/test-utils';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

const initialValue: SettingsFormValue = {
  displayName: 'Louis Do',
  avatarUrl: '',
  bio: 'Collecting rooftop taco stops.',
  homeBase: 'Fort Worth, TX',
  privacy: 'friends',
  tripInvites: 'instant',
  emailAlerts: true,
  categoryPreferences: ['food', 'culture', 'adventure'],
  themeMode: 'dark',
};

describe('SettingsForm', () => {
  beforeEach(() => {
    resetAnalyticsConsent();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('emits the premium settings payload with theme and category preferences', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
        accountEmail: 'louis@example.com',
        syncModeLabel: 'API-backed',
        syncModeDescription: 'Changes sync through the Atlas account API.',
      },
      global: {
        stubs: {
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('[data-test="theme-option-light"]').trigger('click');
    await wrapper.get('[data-test="preference-pill-shopping"]').trigger('click');
    await wrapper.get('form').trigger('submit');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      displayName: 'Louis Do',
      themeMode: 'light',
    });
    expect(wrapper.emitted('submit')?.[0]?.[0].categoryPreferences).toEqual(['food', 'culture', 'adventure', 'shopping']);
  });

  it('resets draft edits and restores the initial theme when cancel is pressed', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('[data-test="theme-option-light"]').trigger('click');
    await wrapper.get('input[placeholder="How your name appears in Atlas"]').setValue('Louis D.');
    await wrapper.get('[data-test="settings-cancel"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect((wrapper.get('input[placeholder="How your name appears in Atlas"]').element as HTMLInputElement).value).toBe('Louis Do');
  });

  it('toggles analytics consent immediately from the privacy controls', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('No analytics choice saved yet');

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');

    expect(localStorage.getItem('atlas-analytics-consent')).toBe('granted');
    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('Analytics enabled');

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');

    expect(localStorage.getItem('atlas-analytics-consent')).toBe('denied');
    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('Analytics opted out');
  });

  it('emits a replay request from the guided walkthrough card', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
        tutorialCompleted: true,
        tutorialStepCount: 5,
      },
      global: {
        stubs: {
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('5-step guide');

    await wrapper.get('[data-test="settings-replay-tutorial"]').trigger('click');

    expect(wrapper.emitted('replay-tutorial')).toHaveLength(1);
  });

  it('requires a display name before submit', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          AtlasIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('input[placeholder="How your name appears in Atlas"]').setValue('');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain('Display name is required so your profile stays recognizable.');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
