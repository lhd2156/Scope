import { afterEach, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    Map: class {
      on() {}
      easeTo() {}
      setStyle() {}
      remove() {}
    },
    Marker: class {
      setLngLat() {
        return this;
      }

      addTo() {
        return this;
      }

      on() {
        return this;
      }

      remove() {}
    },
  },
}));

vi.mock('@/services/mapService', () => ({
  searchLocations: vi.fn().mockResolvedValue({ data: [] }),
  searchNearbyPlaces: vi.fn().mockResolvedValue({ data: [] }),
  reverseGeocode: vi.fn().mockResolvedValue({
    latitude: 32.7767,
    longitude: -96.797,
    placeName: 'Dallas',
    formattedAddress: 'Dallas, Texas, United States',
    city: 'Dallas',
    country: 'US',
    postalCode: '75201',
    providerPlaceId: 'mapbox.dallas',
    precision: 'place',
  }),
}));

vi.mock('@/components/map/MapView.vue', () => ({
  default: {
    name: 'MapView',
    props: ['spots', 'routePoints', 'initialViewport'],
    emits: ['map-click'],
    template: '<button type="button" data-test="spot-map-picker" class="map-view-stub" @click="$emit(\'map-click\', { latitude: 31.7619, longitude: -106.485 })">2D map picker</button>',
  },
}));

import { mount } from '@vue/test-utils';
import SpotForm from '@/components/spots/SpotForm.vue';
import type { SpotFormInput } from '@/types';

const validInput: SpotFormInput = {
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '123 Main St',
  city: 'Fort Worth',
  country: 'US',
  postalCode: '76102',
  category: 'food',
  pillars: ['hidden-gem', 'photo-worthy'],
  vibe: 'electric',
  rating: 4.8,
  visitedAt: '2026-03-20',
  isPublic: true,
};

describe('SpotForm', () => {
  const createObjectURL = vi.fn(() => 'blob:spot-photo');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('collects uploaded photos and emits a normalized submission payload', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    const photo = new File(['scope'], 'cover.png', { type: 'image/png' });
    const photoInput = wrapper.get('[data-test="photo-upload-input"]');

    Object.defineProperty(photoInput.element, 'files', {
      value: [photo],
      configurable: true,
    });

    await photoInput.trigger('change');
    await wrapper.get('[data-test="spot-map-picker"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="spot-form"]').trigger('submit');
    await flushPromises();

    const submitPayload = wrapper.emitted('submit')?.[0]?.[0];
    expect(wrapper.find('[data-test="photo-preview-card"]').exists()).toBe(true);
    expect(submitPayload.spot.title).toBe('Sunset Rooftop Tacos');
    expect(submitPayload.spot.city).toBe('Dallas');
    expect(submitPayload.spot.postalCode).toBe('75201');
    expect(submitPayload.spot.latitude).toBe(31.7619);
    expect(submitPayload.spot.longitude).toBe(-106.485);
    expect(submitPayload.spot.rating).toBe(4.8);
    expect(submitPayload.spot.visitedAt).toBe('2026-03-20');
    expect(submitPayload.spot.pillars).toEqual(['hidden-gem', 'photo-worthy']);
    expect(submitPayload.spot.verificationStatus).toBe('unverified');
    expect(submitPayload.newPhotos).toHaveLength(1);
    expect(submitPayload.newPhotos[0].caption).toBe('cover');
    expect(createObjectURL).toHaveBeenCalledWith(photo);
  });

  it('shows a validation message for unsupported upload types', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    const photo = new File(['scope'], 'cover.gif', { type: 'image/gif' });
    const photoInput = wrapper.get('[data-test="photo-upload-input"]');

    Object.defineProperty(photoInput.element, 'files', {
      value: [photo],
      configurable: true,
    });

    await photoInput.trigger('change');

    expect(wrapper.text()).toContain('Only JPEG, PNG, and WebP photos are supported.');
    expect(wrapper.find('[data-test="photo-preview-card"]').exists()).toBe(false);
  });

  it('caps uploads at ten photos and keeps the native file control visually hidden', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    const photos = Array.from({ length: 11 }, (_, index) => new File(['scope'], `cover-${index}.png`, { type: 'image/png' }));
    const photoInput = wrapper.get('[data-test="photo-upload-input"]');

    Object.defineProperty(photoInput.element, 'files', {
      value: photos,
      configurable: true,
    });

    await photoInput.trigger('change');

    expect(photoInput.classes()).toContain('sr-only');
    expect(wrapper.findAll('[data-test="photo-preview-card"]')).toHaveLength(10);
    expect(wrapper.text()).toContain('10/10 photos');
    expect(wrapper.text()).toContain('You can add up to 10 photos.');
    expect(photoInput.attributes('disabled')).toBeDefined();
  });

  it('renders backend rejection guidance and clears it when a related field changes', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
        serverRejection: {
          id: 1,
          title: 'Clean up the copy',
          message: 'This contains a blocked slur or hate term.',
          action: 'Edit the highlighted copy, then try publishing again.',
          fields: ['title'],
        },
      },
    });

    expect(wrapper.get('[data-test="server-rejection-panel"]').text()).toContain('Clean up the copy');
    expect(wrapper.text()).toContain('Place');
    expect(wrapper.find('.composer-section--story.has-server-error').exists()).toBe(true);

    await wrapper.get('input[name="title"]').setValue('Clean Rooftop Tacos');

    expect(wrapper.emitted('server-rejection-cleared')).toBeTruthy();
  });

  it('keeps public publish disabled until gates pass but allows private draft saving', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    expect(wrapper.get('[data-test="visibility-control"]').get('button[aria-label="Public"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="visibility-control"]').get('button[aria-label="Private"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('[data-test="spot-submit"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="spot-save-private"]').attributes('disabled')).toBeUndefined();

    await wrapper.findAll('.visibility-option')[1].trigger('click');

    expect(wrapper.get('[data-test="visibility-control"]').get('button[aria-label="Public"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('[data-test="visibility-control"]').get('button[aria-label="Private"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="spot-submit"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-test="spot-submit"]').text()).toContain('Save private draft');
  });

  it('surfaces public publish validation for unsafe copy and missing photos', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: 'Scope test blocked slur',
          verificationStatus: 'unverified',
        },
      },
    });

    await wrapper.get('[data-test="spot-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('This contains a blocked slur or hate term.');
    expect(wrapper.text()).toContain('Upload at least one photo');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('removes the manual verifier and infers non-food categories from place wording', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: 'Sparkle Car Wash',
          category: 'food',
        },
      },
    });

    await wrapper.get('input[name="title"]').setValue('Sparkle Car Wash');
    await flushPromises();

    expect(wrapper.find('.verify-button').exists()).toBe(false);
    expect((wrapper.get('select[name="category"]').element as HTMLSelectElement).value).toBe('other');
  });

  it('adds, removes, and limits vibe pillars with inline validation', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          pillars: ['hidden-gem', 'photo-worthy', 'date-night', 'group-friendly'],
        },
      },
    });

    const getPillar = (label: string) => wrapper.findAll('[data-test="pillar-options"] button')
      .find((button) => button.text() === label)!;

    await getPillar('Solo-friendly').trigger('click');
    expect(wrapper.text()).toContain('Choose up to 4 vibe pillars.');

    await getPillar('Date night').trigger('click');
    expect(getPillar('Date night').attributes('aria-pressed')).toBe('false');

    await getPillar('Solo-friendly').trigger('click');
    expect(getPillar('Solo-friendly').attributes('aria-pressed')).toBe('true');
    expect(wrapper.text()).not.toContain('Choose up to 4 vibe pillars.');
  });

  it('removes existing and newly uploaded photos while revoking upload previews', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
        initialPhotos: [{
          id: 'existing-1',
          url: 'https://images.example/spot.jpg',
          caption: ' Existing caption ',
        }],
      },
    });

    await wrapper.findAll('button.photo-action.danger')[0].trigger('click');
    expect(wrapper.text()).not.toContain('Existing photo');

    const photo = new File(['scope'.repeat(1024 * 512)], 'wide-cover.webp', { type: 'image/webp' });
    const photoInput = wrapper.get('[data-test="photo-upload-input"]');

    Object.defineProperty(photoInput.element, 'files', {
      value: [photo],
      configurable: true,
    });

    await photoInput.trigger('change');

    const previewCard = wrapper.get('[data-test="photo-preview-card"]');
    expect(previewCard.get('img').attributes('src')).toBe('blob:spot-photo');
    expect(wrapper.text()).toContain('1 photo');

    await wrapper.find('button.photo-action.danger').trigger('click');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:spot-photo');
    expect(wrapper.find('[data-test="photo-preview-card"]').exists()).toBe(false);
  });

  it('keeps empty photo changes inert and renders edit-mode fallback copy', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        mode: 'edit',
        initialValue: {
          ...validInput,
          title: '',
          description: '',
          address: '',
          city: '',
          country: '',
          isPublic: false,
        },
      },
    });

    const photoInput = wrapper.get('[data-test="photo-upload-input"]');
    Object.defineProperty(photoInput.element, 'files', {
      value: [],
      configurable: true,
    });

    await photoInput.trigger('change');

    expect(wrapper.text()).toContain('Drop your hero photo');
    expect(wrapper.text()).toContain('JPEG, PNG, or WebP');
    expect(wrapper.text()).toContain('2D map picker');
    expect(wrapper.get('[data-test="spot-submit"]').text()).toContain('Save private draft');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('updates every composer field, cancels, and saves through the private draft control', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialPhotos: [{
          id: 'existing-1',
          url: 'https://images.example/spot.jpg',
          caption: 'Existing caption',
        }],
        serverRejection: {
          id: 2,
          title: 'Location needs review',
          message: 'Clean up the highlighted fields.',
          action: 'Adjust the form, then save again.',
          fields: ['story', 'location', 'photos', 'visibility'],
        },
      },
    });

    expect((wrapper.get('input[name="visitedAt"]').element as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await wrapper.get('select[name="category"]').setValue('nature');
    await wrapper.get('input[name="vibe"]').setValue('quiet');
    await wrapper.get('input[name="rating"]').setValue('3.9');
    await wrapper.get('input[name="visitedAt"]').setValue('2026-05-01');
    await wrapper.get('input[name="title"]').setValue('Garden Court');
    await wrapper.get('textarea[name="description"]').setValue('A quiet garden reset with good shade.');
    await wrapper.get('input[name="address"]').setValue('500 Garden Ave');
    await wrapper.get('input[name="address"]').trigger('blur');
    await flushPromises();
    await wrapper.get('input[name="city"]').setValue('Austin');
    await wrapper.get('input[name="country"]').setValue('us');
    await wrapper.get('input[name="postalCode"]').setValue('78701');
    await wrapper.get('input[name="latitude"]').setValue('30.2672');
    await wrapper.get('input[name="longitude"]').setValue('-97.7431');

    const visibilityOptions = wrapper.findAll('.visibility-option');
    await visibilityOptions[0].trigger('click');
    await visibilityOptions[1].trigger('click');
    await visibilityOptions[0].trigger('click');
    await wrapper.findAll('.bar-button--ghost')[0].trigger('click');

    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('server-rejection-cleared')).toBeTruthy();

    await wrapper.get('[data-test="spot-save-private"]').trigger('click');
    await flushPromises();

    const submitPayload = wrapper.emitted('submit')?.[0]?.[0];
    expect(submitPayload.spot).toMatchObject({
      title: 'Garden Court',
      category: 'nature',
      vibe: 'quiet',
      rating: 3.9,
      visitedAt: '2026-05-01',
      city: 'Austin',
      country: 'US',
      postalCode: '78701',
      latitude: 30.2672,
      longitude: -97.7431,
      isPublic: false,
    });
  });

  it('keeps verified provider places until the location signature drifts', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          providerPlaceId: 'mapbox.sunset-rooftop',
          providerPlaceName: 'Sunset Rooftop Tacos',
          providerPlaceAddress: '123 Main St, Fort Worth, TX',
          verificationStatus: 'verified',
          verificationSource: 'mapbox',
          verificationDistanceMeters: 8,
          verifiedAt: '2026-03-20T18:00:00Z',
        },
        initialPhotos: [{
          id: 'existing-1',
          url: 'https://images.example/spot.jpg',
          caption: 'Existing caption',
        }],
      },
    });

    await wrapper.get('[data-test="spot-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')?.[0]?.[0].spot.verificationStatus).toBe('verified');

    await wrapper.get('input[name="city"]').setValue('Dallas');
    await flushPromises();
    await wrapper.get('[data-test="spot-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')?.[1]?.[0].spot.verificationStatus).toBe('unverified');
    expect(wrapper.emitted('submit')?.[1]?.[0].spot.verifiedAt).toBeNull();
  });

  it('exercises composer readiness, preview, focus, and private draft coverage hooks', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    const wrapper = mount(SpotForm, {
      attachTo: document.body,
      props: {
        mode: 'edit',
        initialValue: {
          ...validInput,
          rating: undefined,
          city: '',
          country: '',
          address: '3220 Botanic Garden Blvd',
          isPublic: true,
          verificationStatus: 'unverified',
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const read = (value: any) => value?.value ?? value;

    expect(read(coverage.heading)).toBe('Refine spot');
    expect(read(coverage.previewTitle)).toBe('Sunset Rooftop Tacos');
    expect(read(coverage.previewSubtitle)).toBe('3220 Botanic Garden Blvd');
    expect(read(coverage.submitLabel)).toBe('Save changes');

    const publicSteps = read(coverage.composerSteps);
    expect(publicSteps.map((step: any) => step.label)).toEqual(['Photos', 'Story', 'Vibe', 'Place', 'Details']);
    expect(publicSteps.find((step: any) => step.id === 'media')).toMatchObject({
      sub: 'Lead with a hero',
      ready: false,
    });
    expect(publicSteps.find((step: any) => step.id === 'location')).toMatchObject({
      sub: 'Pinned',
      ready: true,
    });
    expect(publicSteps.find((step: any) => step.id === 'details')).toMatchObject({
      sub: '4.5 rating',
      ready: true,
    });

    const publicReadiness = read(coverage.readinessItems);
    expect(publicReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'photos', detail: 'Needed for public', ready: false }),
      expect.objectContaining({ key: 'location', label: 'Place', detail: 'Pin ready', ready: true }),
      expect.objectContaining({ key: 'visibility', label: 'Public', detail: 'Discoverable', ready: true }),
    ]));

    coverage.focusStep('story');
    expect(read(coverage.activeStepId)).toBe('story');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    await coverage.submitPrivateDraft();
    await flushPromises();

    const privateSteps = read(coverage.composerSteps);
    expect(read(coverage.submitLabel)).toBe('Save private draft');
    expect(privateSteps.find((step: any) => step.id === 'location')).toMatchObject({
      sub: 'Pinned',
      ready: true,
    });
    expect(read(coverage.readinessItems)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'location', label: 'Private place', detail: 'Pin ready', ready: true }),
      expect.objectContaining({ key: 'visibility', label: 'Private', detail: 'Hidden draft', ready: true }),
    ]));

    wrapper.unmount();
    scrollIntoView.mockRestore();
  });

  it('covers SpotForm normalization, provider fallback, and public gate branches', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          latitude: 0,
          longitude: 0,
          address: '',
          city: '',
          country: '',
          postalCode: '',
          providerPlaceId: '',
          providerPlaceName: '',
          providerPlaceAddress: '',
          verificationStatus: 'unverified',
        },
        initialPhotos: [{
          id: 'photo-safe',
          url: 'https://images.example/safe.jpg',
          caption: 'Clean caption',
        }],
        serverRejection: {
          id: 9,
          title: 'Server guidance',
          message: 'Fix highlighted fields.',
          action: 'Try again.',
          fields: ['story', 'unknown_field', 'unknown_field', 'publish', 'visibility', 'location'],
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const read = (value: any) => value?.value ?? value;

    expect(coverage.todayValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(coverage.createDefaultForm(null)).toMatchObject({
      title: '',
      category: 'food',
      pillars: ['hidden-gem'],
      rating: 4.5,
      isPublic: true,
    });
    const clonedPhotos = coverage.clonePhotos([{ id: 'clone', url: 'https://images.example/clone.jpg', caption: 'Clone' }]);
    clonedPhotos[0].caption = 'Changed';
    expect(coverage.clonePhotos([{ id: 'clone', url: 'https://images.example/clone.jpg', caption: 'Clone' }])[0].caption).toBe('Clone');
    expect(coverage.formatCategory('scenic')).toBe('Scenic');
    expect(coverage.formatPillar('hidden-gem')).toBe('Hidden gem');
    expect(coverage.formatPillar('custom-pillar')).toBe('custom-pillar');
    expect(coverage.isValidLatitude(-91)).toBe(false);
    expect(coverage.isValidLatitude(45)).toBe(true);
    expect(coverage.isValidLongitude(-181)).toBe(false);
    expect(coverage.isValidLongitude(120)).toBe(true);
    expect(coverage.isServerFieldHighlighted('description')).toBe(true);
    expect(read(coverage.serverRejectionLabels)).toEqual([
      'Story',
      'unknown field',
      'Publish settings',
      'Visibility',
    ]);

    coverage.errors.value = { title: 'Title needed' };
    coverage.clearError('vibe');
    expect(coverage.errors.value.title).toBe('Title needed');
    coverage.clearError('title');
    expect(coverage.errors.value.title).toBeUndefined();
    coverage.clearServerRejectionFor(['visibility']);
    expect(wrapper.emitted('server-rejection-cleared')).toBeTruthy();

    expect(coverage.isPreciseGeocodeResult({ precision: 'coordinate' })).toBe(false);
    expect(coverage.isPreciseGeocodeResult({ precision: 'poi' })).toBe(true);
    coverage.form.title = '';
    coverage.form.address = 'Existing address';
    coverage.form.providerPlaceAddress = 'Existing provider address';
    coverage.applyGeocodeResultToForm({
      latitude: 32.1,
      longitude: -97.1,
      precision: 'fallback',
      placeName: 'Should not apply',
      formattedAddress: 'Nope',
    }, { overwriteTitle: true, updateCoordinates: true });
    expect(coverage.form.title).toBe('');
    coverage.applyGeocodeResultToForm({
      latitude: 32.1111119,
      longitude: -97.2222229,
      precision: 'poi',
      placeName: 'Pinned location',
      formattedAddress: '',
      address: '',
      category: 'museum',
    }, { overwriteTitle: true, updateCoordinates: true });
    expect(coverage.form.address).toBe('Pinned location');
    expect(coverage.form.providerPlaceAddress).toBe('Existing provider address');
    expect(coverage.form.latitude).toBe(32.111112);
    expect(coverage.form.longitude).toBe(-97.222223);

    coverage.applyGeocodeResultToForm({
      latitude: 33,
      longitude: -96,
      precision: 'poi',
      placeName: 'Modern Museum',
      formattedAddress: '100 Museum Way, Dallas, TX',
      address: '',
      providerPlaceId: 'mapbox.modern-museum',
      city: 'Dallas',
      countryCode: 'us',
      postalCode: '75201',
      category: 'museum',
    }, { overwriteTitle: true });
    expect(coverage.form).toMatchObject({
      title: 'Modern Museum',
      address: '100 Museum Way, Dallas, TX',
      providerPlaceName: 'Modern Museum',
      providerPlaceAddress: '100 Museum Way, Dallas, TX',
      providerPlaceId: 'mapbox.modern-museum',
      city: 'Dallas',
      country: 'US',
      postalCode: '75201',
      category: 'culture',
    });
    expect(coverage.readCategorySignals({
      placeName: 'Trailhead',
      formattedAddress: 'Park Road',
      categoryLabel: 'Park',
    })).toEqual(expect.arrayContaining(['Park', 'Trailhead', 'Park Road']));
    expect(coverage.getNearestPinnedPlace([
      { precision: 'fallback', distanceKm: 0.01 },
      { precision: 'poi', distanceKm: 0.2 },
      { precision: 'poi', distanceKm: 0.03, placeName: 'Nearby precise place' },
    ])).toMatchObject({ placeName: 'Nearby precise place' });
    expect(coverage.getNearestPinnedPlace([{ precision: 'coordinate', distanceKm: 0.01 }])).toBeNull();

    coverage.setVisibility(true);
    coverage.setVisibility(false);
    expect(coverage.form.isPublic).toBe(false);
    expect(read(coverage.publishDisabled)).toBe(false);
    expect(read(coverage.privateDraftDisabled)).toBe(false);
    expect(read(coverage.composerSteps).find((step: any) => step.id === 'location')).toMatchObject({
      sub: 'Matched',
      ready: true,
    });
    expect(read(coverage.readinessItems)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'location', detail: 'Provider matched', ready: true }),
      expect.objectContaining({ key: 'visibility', label: 'Private', detail: 'Hidden draft' }),
    ]));
    expect(read(coverage.pinMapPoints)[0]).toMatchObject({
      title: 'Modern Museum',
      city: 'Dallas',
      category: 'culture',
    });
    expect(read(coverage.pinMapViewport)).toMatchObject({
      center: [-97.222223, 32.111112],
      zoom: 13.35,
    });

    coverage.form.providerPlaceId = '';
    coverage.form.providerPlaceName = '';
    coverage.form.providerPlaceAddress = '';
    coverage.form.latitude = 0;
    coverage.form.longitude = 0;
    coverage.form.isPublic = true;
    await coverage.handleSubmit();
    await flushPromises();
    expect(coverage.errors.value.locationVerification).toBe('Choose the place on the map before publishing.');

    await wrapper.setProps({
      initialPhotos: [{
        id: 'photo-unsafe',
        url: 'https://images.example/unsafe.jpg',
        caption: 'scope test blocked slur',
      }],
    });
    coverage.form.title = 'Clean title';
    coverage.form.description = 'Clean description';
    coverage.form.vibe = 'calm';
    coverage.form.pillars = ['hidden-gem'];
    coverage.form.providerPlaceId = 'mapbox.safe-place';
    coverage.form.providerPlaceName = 'Safe Place';
    coverage.form.providerPlaceAddress = 'Safe Place Address';
    coverage.form.latitude = 32;
    coverage.form.longitude = -97;
    await coverage.handleSubmit();
    await flushPromises();
    expect(coverage.errors.value.safety).toBe('This contains a blocked slur or hate term.');
  });

  it('keeps private drafts usable without public location proof and normalizes geocode fallbacks', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          latitude: 0,
          longitude: 0,
          address: '',
          city: '',
          country: '',
          postalCode: undefined,
          isPublic: false,
          providerPlaceId: '',
          providerPlaceName: '',
          providerPlaceAddress: '',
          verificationStatus: 'unverified',
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const read = (value: any) => value?.value ?? value;

    expect(read(coverage.composerSteps).find((step: any) => step.id === 'location')).toMatchObject({
      sub: 'Needs place',
      ready: true,
    });
    expect(read(coverage.readinessItems)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'photos',
        detail: 'Needed for public',
        ready: true,
      }),
      expect.objectContaining({
        key: 'location',
        label: 'Private place',
        detail: 'Needed for public',
        ready: true,
      }),
    ]));

    coverage.form.title = '';
    coverage.form.address = '';
    coverage.form.providerPlaceAddress = '';
    coverage.applyGeocodeResultToForm({
      latitude: 12.345678,
      longitude: -98.765432,
      precision: 'poi',
      formattedAddress: 'Formatted-only address',
      country: 'mx',
      categoryLabel: 'Trail',
    });
    expect(coverage.form.title).toBe('');
    expect(coverage.form.address).toBe('Formatted-only address');
    expect(coverage.form.providerPlaceAddress).toBe('Formatted-only address');
    expect(coverage.form.country).toBe('MX');
    expect(coverage.form.latitude).toBe(0);
    expect(coverage.form.longitude).toBe(0);

    coverage.form.address = '';
    coverage.form.providerPlaceAddress = '';
    coverage.applyGeocodeResultToForm({
      latitude: 12,
      longitude: -98,
      precision: 'poi',
      address: 'Street-only address',
      category: 'park',
    });
    expect(coverage.form.address).toBe('Street-only address');
    expect(coverage.form.providerPlaceAddress).toBe('Street-only address');

    coverage.form.address = 'Manual fallback address';
    coverage.applyGeocodeResultToForm({
      latitude: 12,
      longitude: -98,
      precision: 'poi',
    });
    expect(coverage.form.address).toBe('Manual fallback address');

    coverage.form.verificationStatus = 'verified';
    coverage.form.verificationSource = undefined;
    coverage.form.providerPlaceName = undefined;
    coverage.form.providerPlaceAddress = undefined;
    coverage.form.verificationDistanceMeters = undefined;
    coverage.resetVerificationFromForm();
    expect(coverage.placeVerification).toMatchObject({
      status: 'verified',
      source: '',
      providerPlaceName: '',
      providerPlaceAddress: '',
      distanceMeters: null,
    });
    const stableSignature = coverage.placeVerification.signature;
    coverage.markVerificationStale();
    expect(coverage.placeVerification.status).toBe('verified');
    expect(coverage.placeVerification.signature).toBe(stableSignature);

    wrapper.unmount();
  });

  it('renders fallback photo labels and cleans upload previews when revokeObjectURL is unavailable', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
        initialPhotos: [{
          id: 'photo-without-caption',
          url: 'https://images.example/no-caption.jpg',
          caption: '',
        }],
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    const existingImage = wrapper.get('[data-test="photo-preview-card"] img');
    const existingRemove = wrapper.get('[data-test="photo-preview-card"] button');
    expect(existingImage.attributes('alt')).toBe('Spot photo');
    expect(existingRemove.attributes('aria-label')).toBe('Remove spot photo');

    const photo = new File(['scope'], 'night-market.webp', { type: 'image/webp' });
    const photoInput = wrapper.get('[data-test="photo-upload-input"]');
    Object.defineProperty(photoInput.element, 'files', {
      value: [photo],
      configurable: true,
    });

    await photoInput.trigger('change');
    expect(coverage.uploads.value).toHaveLength(1);

    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(() => coverage.removeUpload(coverage.uploads.value[0].id)).not.toThrow();
    expect(coverage.uploads.value).toHaveLength(0);

    Object.defineProperty(photoInput.element, 'files', {
      value: [photo],
      configurable: true,
    });
    await photoInput.trigger('change');
    expect(coverage.uploads.value).toHaveLength(1);
    expect(() => wrapper.unmount()).not.toThrow();
  });

  it('renders validation messages and in-progress draft labels without hiding private save recovery', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        submitting: true,
        initialValue: {
          ...validInput,
          title: '',
          description: '',
          address: '',
          city: '',
          country: '',
          postalCode: '',
          latitude: Number.NaN,
          longitude: Number.NaN,
          rating: 8,
          visitedAt: 'bad-date',
          vibe: 'scope test blocked slur',
          isPublic: false,
          providerPlaceId: '',
          providerPlaceName: '',
          providerPlaceAddress: '',
          verificationStatus: 'unverified',
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    coverage.errors.value = {
      title: 'Name the spot.',
      description: 'Tell travelers why this spot is worth saving.',
      vibe: 'Use safer vibe copy.',
      pillars: 'Pick at least one pillar.',
      rating: 'Rating must be between 0 and 5.',
      visitedAt: 'Use a valid visit date.',
      address: 'Add a street address.',
      postalCode: 'Add a postal code.',
      latitude: 'Latitude is outside the map.',
      longitude: 'Longitude is outside the map.',
      locationVerification: 'Choose a provider-backed place.',
      safety: 'Safety review failed.',
    };
    await flushPromises();

    expect(wrapper.get('[data-test="spot-save-private"]').text()).toBe('Saving...');
    expect(wrapper.get('[data-test="spot-submit"]').text()).toBe('Saving...');
    expect(wrapper.text()).toContain('Name the spot.');
    expect(wrapper.text()).toContain('Use safer vibe copy.');
    expect(wrapper.text()).toContain('Rating must be between 0 and 5.');
    expect(wrapper.text()).toContain('Use a valid visit date.');
    expect(wrapper.text()).toContain('Tell travelers why this spot is worth saving.');
    expect(wrapper.text()).toContain('Add a street address.');
    expect(wrapper.text()).toContain('Add a postal code.');
    expect(wrapper.text()).toContain('Latitude is outside the map.');
    expect(wrapper.text()).toContain('Longitude is outside the map.');
    expect(wrapper.text()).toContain('Safety review failed.');
    expect(coverage.previewTitle.value).toBe('Name the spot');
    expect(coverage.previewSubtitle.value).toBe('Drop a precise pin');
  });
});
