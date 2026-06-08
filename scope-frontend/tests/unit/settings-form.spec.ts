import { flushPromises, mount } from '@vue/test-utils';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { resetAnalyticsConsent } from '@/utils/analyticsConsent';

const searchLocationsMock = vi.hoisted(() => vi.fn());
const getPresignedUploadTargetMock = vi.hoisted(() => vi.fn());
const uploadFileToPresignedTargetMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  searchLocations: searchLocationsMock,
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
    searchLocationsMock.mockReset();
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

  it('emits the premium settings payload with selectable theme and category preferences', async () => {
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
    expect(wrapper.get('[data-test="theme-option-light"]').exists()).toBe(true);
    const submitEvents = wrapper.emitted('submit') ?? [];
    const payload = submitEvents.at(-1)?.[0] as SettingsFormValue;
    const options = submitEvents.at(-1)?.[1] as { source: string };
    expect(payload).toMatchObject({
      displayName: 'Louis Do',
      themeMode: 'dark',
    });
    expect(payload.categoryPreferences).toEqual(['food', 'culture', 'adventure', 'shopping']);
    expect(options.source).toBe('manual');
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

    const submitEvents = wrapper.emitted('submit') ?? [];
    const payload = submitEvents.at(-1)?.[0] as SettingsFormValue;
    const options = submitEvents.at(-1)?.[1] as { source: string };
    expect(payload).toMatchObject({
      firstName: 'Lou',
      lastName: 'Traveler',
      phoneNumber: '+1 817 555 0100',
      bio: 'Always checking quiet patios and good map handoffs.',
      showActivityStatus: false,
      emailAlerts: false,
    });
    expect(payload.categoryPreferences).toEqual(['culture', 'adventure', 'other']);
    expect(options.source).toBe('manual');

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
    expect(wrapper.get('[data-test="theme-option-light"]').classes()).toContain('is-active');
    expect(wrapper.text()).toContain('Profile changes saved');
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
    expect(wrapper.get('[data-test="settings-tutorial-card"]').text()).toContain('Completed');

    await wrapper.get('[data-test="settings-replay-tutorial"]').trigger('click');

    expect(wrapper.emitted('replay-tutorial')).toHaveLength(1);

    await wrapper.setProps({ tutorialCompleted: false, tutorialStepCount: 0 });
    await flushPromises();

    expect(wrapper.get('[data-test="settings-tutorial-card"]').text()).toContain('Ready to start');
    expect(wrapper.get('[data-test="settings-tutorial-card"]').text()).toContain('Guided tour ready');
    expect(wrapper.get('[data-test="settings-tutorial-card"]').text()).toContain('Start the guided walkthrough');
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
    searchLocationsMock
      .mockResolvedValueOnce({
        data: [
          {
            latitude: 30.2672,
            longitude: -97.7431,
            placeName: 'Austin, Texas, United States',
            formattedAddress: 'Austin, TX, United States',
            city: 'Austin',
            country: 'United States',
            source: 'mock',
          },
          {
            latitude: 32.7767,
            longitude: -96.797,
            placeName: 'Dallas',
            formattedAddress: 'Dallas, TX, United States',
            address: 'Dallas',
            city: 'Dallas',
            country: 'United States',
            source: 'mock',
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
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(searchLocationsMock).toHaveBeenCalledWith('Austin', expect.objectContaining({
      limit: 6,
      preferPoi: false,
      sortByDistance: false,
      types: expect.stringContaining('address'),
    }));
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
    expect((locationInput.element as HTMLInputElement).value).toBe('Dallas, TX');
    expect((wrapper.emitted('submit')?.at(-1)?.[1] as { source: string }).source).toBe('location');
    expect((wrapper.emitted('submit')?.at(-1)?.[0] as SettingsFormValue).homeBase).toBe('Dallas, TX');

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      city: 'Austin',
      country: 'United States',
      source: 'mock',
    }];
    coverage.locationOpen.value = true;
    await locationInput.trigger('keydown', { key: 'Escape' });
    expect(coverage.locationOpen.value).toBe(false);

    await locationInput.setValue('Nowhere');
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(wrapper.text()).toContain('No clean matches yet. Try a city, ZIP code, or nearby street.');

    const submitCountBeforeFreeTextSave = wrapper.emitted('submit')?.length ?? 0;
    await wrapper.get('form').trigger('submit');
    expect(wrapper.text()).toContain('Choose a suggested location before saving your profile location.');
    expect(wrapper.emitted('submit')).toHaveLength(submitCountBeforeFreeTextSave);

    await locationInput.setValue('Offline');
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(wrapper.text()).toContain('Location suggestions are offline right now.');

    await wrapper.get('button[aria-label="Clear location"]').trigger('click');
    await flushPromises();
    expect((locationInput.element as HTMLInputElement).value).toBe('');
    expect((wrapper.emitted('submit')?.at(-1)?.[1] as { source: string }).source).toBe('location');
    expect((wrapper.emitted('submit')?.at(-1)?.[0] as SettingsFormValue).homeBase).toBe('');

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      city: 'Austin',
      country: 'United States',
      source: 'mock',
    }];
    coverage.locationOpen.value = true;
    await locationInput.trigger('blur');
    await vi.advanceTimersByTimeAsync(150);
    expect(coverage.locationOpen.value).toBe(false);

    coverage.locationResults.value = [{
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin, Texas, United States',
      formattedAddress: 'Austin, TX, United States',
      city: 'Austin',
      country: 'United States',
      source: 'mock',
    }];
    coverage.locationOpen.value = true;
    await flushPromises();
    await wrapper.get('.location-suggestion').trigger('click');
    expect((locationInput.element as HTMLInputElement).value).toBe('Austin, TX');

    coverage.locationResults.value = [{
      latitude: 32.74769,
      longitude: -97.32555,
      placeName: 'Fort Worth Water Gardens',
      formattedAddress: '1502 Commerce Street, Fort Worth, Texas 76102, United States',
      address: '1502 Commerce Street',
      city: 'Fort Worth',
      stateCode: 'us-tx',
      country: 'United States',
      precision: 'address',
      source: 'mock',
    }];
    coverage.locationOpen.value = true;
    await flushPromises();
    await wrapper.get('.location-suggestion').trigger('click');
    expect((locationInput.element as HTMLInputElement).value).toBe('1502 Commerce Street, Fort Worth, TX');
    expect((wrapper.emitted('submit')?.at(-1)?.[0] as SettingsFormValue).homeBase).toBe('1502 Commerce Street, Fort Worth, TX');

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
    expect((wrapper.emitted('submit')?.at(-1)?.[1] as { source: string }).source).toBe('avatar');
    expect((wrapper.emitted('submit')?.at(-1)?.[0] as SettingsFormValue).avatarUrl).toBe('https://cdn.example/avatar.webp');

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

  it('tracks every autosaved settings field and deduplicates provider locations', async () => {
    const wrapper = mount(SettingsForm, {
      props: { initialValue },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const fieldChanges: Array<[keyof SettingsFormValue, unknown]> = [
      ['username', 'updated-handle'],
      ['lastName', 'Traveler'],
      ['dateOfBirth', '1990-02-03'],
      ['bio', 'Updated traveler bio.'],
      ['showActivityStatus', false],
      ['privacy', 'private'],
      ['tripInvites', 'daily'],
      ['emailAlerts', false],
    ];

    expect(coverage.isFormDirty.value).toBe(false);
    for (const [field, nextValue] of fieldChanges) {
      const originalValue = coverage.form[field];
      coverage.form[field] = nextValue;
      expect(coverage.isFormDirty.value, field).toBe(true);
      coverage.form[field] = originalValue;
      expect(coverage.isFormDirty.value, `${field} reset`).toBe(false);
    }

    const deduped = coverage.dedupeLocationResults([
      {
        latitude: 32.7555,
        longitude: -97.3308,
        placeName: 'Fort Worth',
        formattedAddress: 'Fort Worth, TX, United States',
        source: 'mapbox',
      },
      {
        latitude: 32.7555,
        longitude: -97.3308,
        placeName: 'Fort Worth duplicate',
        formattedAddress: 'Fort Worth, TX, United States',
        source: 'mapbox',
      },
      {
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Austin',
        source: 'mapbox',
      },
      {
        latitude: 0,
        longitude: 0,
        placeName: '',
        formattedAddress: '',
        source: 'mapbox',
      },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((result: { placeName: string }) => result.placeName)).toEqual([
      'Fort Worth',
      'Austin',
    ]);
  });

  it('ignores stale location provider responses and can reopen search from the keyboard', async () => {
    let resolveFirst!: (value: { data: any[] }) => void;
    let rejectThird!: (reason: unknown) => void;
    const first = new Promise<{ data: any[] }>((resolve) => {
      resolveFirst = resolve;
    });
    const third = new Promise<{ data: any[] }>((_resolve, reject) => {
      rejectThird = reject;
    });
    searchLocationsMock
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ data: [] })
      .mockReturnValueOnce(third)
      .mockResolvedValueOnce({ data: [] });

    const wrapper = mount(SettingsForm, {
      props: { initialValue: { ...initialValue, homeBase: 'Austin' } },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    const staleSuccess = coverage.runLocationSearch('Austin');
    coverage.form.homeBase = 'Dallas';
    await coverage.runLocationSearch('Dallas');
    resolveFirst({
      data: [{
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Stale Austin',
        formattedAddress: 'Austin, TX, United States',
        source: 'mapbox',
      }],
    });
    await staleSuccess;
    expect(coverage.locationResults.value).toEqual([]);

    coverage.form.homeBase = 'Houston';
    const staleFailure = coverage.runLocationSearch('Houston');
    coverage.form.homeBase = 'San Antonio';
    await coverage.runLocationSearch('San Antonio');
    rejectThird(new Error('stale provider failure'));
    await staleFailure;
    expect(coverage.locationStatus.value).not.toContain('offline');

    coverage.form.homeBase = 'Fort Worth';
    coverage.locationOpen.value = false;
    coverage.locationResults.value = [];
    coverage.handleLocationKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(coverage.locationOpen.value).toBe(true);
  });

  it('reads avatar data URLs and tolerates unavailable or failed FileReader APIs', async () => {
    const wrapper = mount(SettingsForm, {
      props: { initialValue },
      global: {
        stubs: {
          ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
          Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const originalFileReader = globalThis.FileReader;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await expect(coverage.readFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);

    vi.stubGlobal('FileReader', undefined);
    await expect(coverage.readFileAsDataUrl(file)).resolves.toBe('');

    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      private listeners = new Map<string, () => void>();

      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }

      readAsDataURL() {
        this.listeners.get('error')?.();
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader);
    await expect(coverage.readFileAsDataUrl(file)).resolves.toBe('');

    vi.stubGlobal('FileReader', originalFileReader);
  });
});
