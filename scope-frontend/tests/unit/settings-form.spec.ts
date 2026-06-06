import { flushPromises, mount } from '@vue/test-utils';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

const geocodeMock = vi.hoisted(() => vi.fn());
const getPresignedUploadTargetMock = vi.hoisted(() => vi.fn());
const uploadFileToPresignedTargetMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  geocode: geocodeMock,
}));

vi.mock('@/services/s3Service', () => ({
  getPresignedUploadTarget: getPresignedUploadTargetMock,
  uploadFileToPresignedTarget: uploadFileToPresignedTargetMock,
}));

const initialValue: SettingsFormValue = {
  displayName: 'Louis Do',
  username: 'louisdo',
  firstName: 'Louis',
  lastName: 'Do',
  phoneNumber: '',
  dateOfBirth: '',
  avatarUrl: '',
  bio: 'Collecting rooftop taco stops.',
  homeBase: 'Fort Worth, TX',
  showActivityStatus: true,
  privacy: 'friends',
  tripInvites: 'instant',
  emailAlerts: true,
  categoryPreferences: ['food', 'culture', 'adventure'],
  themeMode: 'dark',
};

describe('SettingsForm', () => {
  const createObjectURL = vi.fn(() => 'blob:avatar-preview');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    resetAnalyticsConsent();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    geocodeMock.mockReset();
    getPresignedUploadTargetMock.mockReset();
    uploadFileToPresignedTargetMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  });

  it('emits the premium settings payload with dark-only theme and category preferences', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
        accountEmail: 'louis@example.com',
        syncModeLabel: 'API-backed',
        syncModeDescription: 'Changes sync through the Scope account API.',
      },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('[data-test="preference-pill-shopping"]').trigger('click');
    await wrapper.get('form').trigger('submit');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(wrapper.get('[data-test="theme-option-dark"]').classes()).toContain('is-active');
    expect(wrapper.find('[data-test="theme-option-light"]').exists()).toBe(false);
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      displayName: 'Louis Do',
      themeMode: 'dark',
    });
    expect(wrapper.emitted('submit')?.[0]?.[0].categoryPreferences).toEqual(['food', 'culture', 'adventure', 'shopping']);
  });

  it('updates account, privacy, notification, birthday, and preference controls', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('input[placeholder="+1 555 123 4567"]').setValue('+1 817 555 0100');
    await wrapper.get('input[placeholder="First name"]').setValue('Lou');
    await wrapper.get('input[placeholder="Last name"]').setValue('Traveler');
    await wrapper.get('input[autocomplete="bday"]').setValue('02/03/1990');
    await wrapper.get('textarea[placeholder="Tell other travelers what kind of adventures you chase."]').setValue('Always checking quiet patios and good map handoffs.');
    await wrapper.get('[data-test="theme-option-dark"]').trigger('click');
    await wrapper.findAll('.option-card')[0].trigger('click');
    await wrapper.get('[data-test="activity-status-toggle"]').trigger('click');
    await wrapper.findAll('.option-pill')[1].trigger('click');
    await wrapper.findAll('.toggle-row').find((button) => button.text().includes('Email alerts'))!.trigger('click');
    await wrapper.get('[data-test="preference-pill-food"]').trigger('click');
    await wrapper.get('[data-test="preference-pill-other"]').trigger('click');

    await wrapper.get('form').trigger('submit');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload).toMatchObject({
      firstName: 'Lou',
      lastName: 'Traveler',
      phoneNumber: '+1 817 555 0100',
      bio: 'Always checking quiet patios and good map handoffs.',
      showActivityStatus: false,
      emailAlerts: false,
    });
    expect(payload.categoryPreferences).toEqual(['culture', 'adventure', 'other']);

    await wrapper.setProps({
      initialValue: {
        ...initialValue,
        displayName: 'Maya Chen',
        categoryPreferences: ['nature'],
        themeMode: 'light',
      },
    });
    await flushPromises();

    expect((wrapper.get('input[placeholder="How your name appears in Scope"]').element as HTMLInputElement).value).toBe('Maya Chen');
    expect(wrapper.get('[data-test="preference-pill-nature"]').classes()).toContain('is-active');
    expect(wrapper.get('[data-test="theme-option-dark"]').classes()).toContain('is-active');
    expect(wrapper.find('[data-test="theme-option-light"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('All changes saved');
  });

  it('resets draft edits and restores the initial theme when cancel is pressed', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('input[placeholder="How your name appears in Scope"]').setValue('Louis D.');
    await wrapper.get('[data-test="settings-cancel"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect((wrapper.get('input[placeholder="How your name appears in Scope"]').element as HTMLInputElement).value).toBe('Louis Do');
  });

  it('toggles analytics consent immediately from the privacy controls', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('No analytics choice saved yet');

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');

    expect(localStorage.getItem('scope-analytics-consent')).toBe('granted');
    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('Analytics enabled');

    await wrapper.get('[data-test="analytics-consent-toggle"]').trigger('click');

    expect(localStorage.getItem('scope-analytics-consent')).toBe('denied');
    expect(wrapper.get('[data-test="analytics-consent-status"]').text()).toContain('Analytics opted out');
  });

  it('emits a replay request from the guided walkthrough card', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
        tutorialCompleted: true,
        tutorialStepCount: 3,
      },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('3-step guide');

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
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });

    await wrapper.get('input[placeholder="How your name appears in Scope"]').setValue('');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain('Display name is required so your profile stays recognizable.');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('covers location autocomplete keyboard, empty, offline, clear, and username normalization branches', async () => {
    vi.useFakeTimers();
    geocodeMock
      .mockResolvedValueOnce({
        data: [
          {
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Austin, Texas, United States',
            city: 'Austin',
            country: 'US',
          },
          {
            latitude: 32.7767,
            longitude: -96.797,
            placeName: '',
            city: 'Dallas',
            country: 'US',
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error('geocode offline'));

    const wrapper = mount(SettingsForm, {
      props: { initialValue: { ...initialValue, homeBase: '' } },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const locationInput = wrapper.get('input[placeholder="City, neighborhood, or address"]');

    await locationInput.setValue('A');
    expect(coverage.locationOpen.value).toBe(false);

    await locationInput.setValue('Austin');
    expect(coverage.locationLoading.value).toBe(true);
    await vi.advanceTimersByTimeAsync(230);
    await flushPromises();
    expect(geocodeMock).toHaveBeenCalledWith('Austin', 6);
    expect(wrapper.findAll('.location-suggestion')).toHaveLength(2);
    expect(coverage.formatLocationTitle(coverage.locationResults.value[1])).toBe('Dallas');
    expect(coverage.formatLocationMeta({ placeName: 'Fallback place' })).toBe('Fallback place');

    await locationInput.trigger('focus');
    expect(coverage.locationOpen.value).toBe(true);
    await wrapper.findAll('.location-suggestion')[0].trigger('mouseenter');
    expect(coverage.locationActiveIndex.value).toBe(0);
    coverage.locationActiveIndex.value = -1;
    await locationInput.trigger('keydown', { key: 'ArrowDown' });
    expect(coverage.locationActiveIndex.value).toBe(0);
    await locationInput.trigger('keydown', { key: 'ArrowUp' });
    expect(coverage.locationActiveIndex.value).toBe(1);
    await locationInput.trigger('keydown', { key: 'Enter' });
    expect((locationInput.element as HTMLInputElement).value).toBe('Dallas');

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      city: 'Austin',
      country: 'US',
    }];
    coverage.locationOpen.value = true;
    await locationInput.trigger('keydown', { key: 'Escape' });
    expect(coverage.locationOpen.value).toBe(false);

    await locationInput.setValue('Nowhere');
    await vi.advanceTimersByTimeAsync(230);
    await flushPromises();
    expect(wrapper.text()).toContain('No matching places. Try a city or address.');

    await locationInput.setValue('Offline');
    await vi.advanceTimersByTimeAsync(230);
    await flushPromises();
    expect(wrapper.text()).toContain('Place search is offline right now.');

    await wrapper.get('button[aria-label="Clear location"]').trigger('click');
    await flushPromises();
    expect((locationInput.element as HTMLInputElement).value).toBe('');

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      city: 'Austin',
      country: 'US',
    }];
    coverage.locationOpen.value = true;
    await locationInput.trigger('blur');
    await vi.advanceTimersByTimeAsync(150);
    expect(coverage.locationOpen.value).toBe(false);

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      city: 'Austin',
      country: 'US',
    }];
    coverage.locationOpen.value = true;
    await flushPromises();
    await wrapper.get('.location-suggestion').trigger('click');
    expect((locationInput.element as HTMLInputElement).value).toBe('Austin');

    const usernameInput = wrapper.get('input[placeholder="your-handle"]');
    await usernameInput.setValue('@Louis Do!!');
    expect((usernameInput.element as HTMLInputElement).value).toBe('louisdo');

    vi.useRealTimers();
  });

  it('uploads avatars, releases previews, handles upload failures, and confirms account deletion', async () => {
    getPresignedUploadTargetMock.mockResolvedValue({ uploadUrl: 'https://uploads.example/avatar', fileUrl: 'https://cdn.example/avatar.webp' });
    uploadFileToPresignedTargetMock.mockResolvedValue('https://cdn.example/avatar.webp');
    const confirmSpy = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);

    const wrapper = mount(SettingsForm, {
      props: { initialValue },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name', 'src'], template: '<div class="avatar-stub">{{ name }} {{ src }}</div>' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    await wrapper.get('.profile-avatar-shell').trigger('click');
    await flushPromises();
    expect(clickSpy).toHaveBeenCalled();

    const avatarInput = wrapper.get('[data-test="settings-avatar-input"]');
    const avatarFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(avatarInput.element, 'files', {
      configurable: true,
      value: [avatarFile],
    });

    await avatarInput.trigger('change');
    await flushPromises();

    expect(createObjectURL).toHaveBeenCalledWith(avatarFile);
    expect(getPresignedUploadTargetMock).toHaveBeenCalledWith({
      fileName: 'avatar.png',
      contentType: 'image/png',
      sizeBytes: avatarFile.size,
    });
    expect(uploadFileToPresignedTargetMock).toHaveBeenCalledWith(expect.any(Object), avatarFile);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview');
    expect(wrapper.text()).toContain('https://cdn.example/avatar.webp');

    uploadFileToPresignedTargetMock.mockRejectedValueOnce(new Error('upload failed'));
    Object.defineProperty(avatarInput.element, 'files', {
      configurable: true,
      value: [new File(['avatar'], 'avatar.webp', { type: 'image/webp' })],
    });
    await avatarInput.trigger('change');
    await flushPromises();
    expect(coverage.errorMessage.value).toBe('Scope could not finish uploading that photo. Try again in a moment.');
    expect(coverage.avatarUploading.value).toBe(false);

    await coverage.handleAvatarFileSelection({ target: { files: [], value: 'stale' } });
    await coverage.handleAvatarFileSelection({ target: { files: [new File(['x'], 'avatar.gif', { type: 'image/gif' })], value: 'stale' } });
    expect(coverage.errorMessage.value).toBe('Only JPEG, PNG, and WebP photos are supported for avatars.');
    await coverage.handleAvatarFileSelection({
      target: {
        files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })],
        value: 'stale',
      },
    });
    expect(coverage.errorMessage.value).toBe('Avatar uploads must be 5 MB or smaller.');

    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    expect(wrapper.emitted('delete-account')).toBeUndefined();
    await wrapper.get('[data-test="settings-delete-account"]').trigger('click');
    expect(wrapper.emitted('delete-account')).toHaveLength(1);
    expect(confirmSpy).toHaveBeenCalledTimes(2);

    clickSpy.mockRestore();
  });
});
