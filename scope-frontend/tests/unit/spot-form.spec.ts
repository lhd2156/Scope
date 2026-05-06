import { afterEach, beforeEach, vi } from 'vitest';

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
  category: 'food',
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
    await wrapper.findAll('button.preset-button')[1]?.trigger('click');
    await wrapper.get('[data-test="spot-form"]').trigger('submit');

    const submitPayload = wrapper.emitted('submit')?.[0]?.[0];
    expect(wrapper.find('[data-test="photo-preview-card"]').exists()).toBe(true);
    expect(submitPayload.spot.title).toBe('Sunset Rooftop Tacos');
    expect(submitPayload.spot.city).toBe('Dallas');
    expect(submitPayload.spot.latitude).toBe(32.7767);
    expect(submitPayload.spot.longitude).toBe(-96.797);
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
});
