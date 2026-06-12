import { flushPromises, mount } from '@vue/test-utils';

const reverseGeocodeMock = vi.hoisted(() => vi.fn());
const searchNearbyPlacesMock = vi.hoisted(() => vi.fn());
const searchLocationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/map/MapView.vue', () => ({
  default: {
    name: 'MapView',
    props: [
      'spots',
      'routePoints',
      'initialViewport',
      'showLocationTracker',
      'showControls',
      'showWeatherBadge',
      'showMapStyleToggle',
      'showPlaceLabels',
      'showTraffic',
      'showProjectionToggle',
      'autoFitRouteOnLoad',
      'singleRoutePointZoom',
      'mapPresentation',
      'labelMode',
      'plainPinMarker',
    ],
    emits: ['map-click'],
    template: '<button type="button" data-test="spot-map-picker" class="map-view-stub" :data-location-tracker="String(showLocationTracker)" :data-controls="String(showControls)" :data-weather="String(showWeatherBadge)" :data-style-toggle="String(showMapStyleToggle)" :data-place-labels="String(showPlaceLabels)" :data-traffic="String(showTraffic)" :data-projection-toggle="String(showProjectionToggle)" :data-auto-fit="String(autoFitRouteOnLoad)" :data-single-point-zoom="String(singleRoutePointZoom)" :data-map-presentation="mapPresentation" :data-label-mode="labelMode" :data-plain-pin-marker="String(plainPinMarker)" @click="$emit(\'map-click\', { latitude: 31.7619, longitude: -106.485 })">2D map picker</button>',
  },
}));

vi.mock('@/services/mapService', () => ({
  reverseGeocode: reverseGeocodeMock,
  searchNearbyPlaces: searchNearbyPlacesMock,
  searchLocations: searchLocationsMock,
}));

import SpotForm from '@/components/spots/SpotForm.vue';

const validInput = {
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '123 Main St',
  city: 'Fort Worth',
  country: 'US',
  postalCode: '76102',
  category: 'food',
  pillars: ['hidden-gem'],
  vibe: 'electric',
  rating: 4.8,
  visitedAt: '2026-03-20',
  isPublic: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('SpotForm 2D map picker', () => {
  beforeEach(() => {
    reverseGeocodeMock.mockReset();
    searchNearbyPlacesMock.mockReset();
    searchLocationsMock.mockReset();
    reverseGeocodeMock.mockResolvedValue({
      latitude: 31.7619,
      longitude: -106.485,
      placeName: 'El Paso',
      formattedAddress: 'El Paso, Texas, United States',
      address: '100 Mesa Street',
      city: 'El Paso',
      country: 'US',
      postalCode: '79901',
      precision: 'address',
    });
    searchNearbyPlacesMock.mockResolvedValue({ data: [] });
    searchLocationsMock.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the shared 2D map surface and turns direct POI pins into place details', async () => {
    searchNearbyPlacesMock.mockResolvedValueOnce({
      data: [{
        id: 'mapbox.starbucks',
        latitude: 31.762,
        longitude: -106.4852,
        placeName: 'Starbucks',
        formattedAddress: '222 Mesa Street, El Paso, Texas 79901',
        address: '222 Mesa Street',
        city: 'El Paso',
        country: 'US',
        postalCode: '79901',
        providerPlaceId: 'mapbox.starbucks',
        precision: 'poi',
        category: 'coffee',
        categoryId: 'coffee',
        categoryLabel: 'Coffee',
        distanceKm: 0.02,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    await wrapper.get('[data-test="spot-map-picker"]').trigger('click');
    await flushPromises();

    const mapPicker = wrapper.get('[data-test="spot-map-picker"]');
    expect(mapPicker.attributes('data-map-presentation')).toBe('scope');
    expect(mapPicker.attributes('data-location-tracker')).toBe('false');
    expect(mapPicker.attributes('data-controls')).toBe('false');
    expect(mapPicker.attributes('data-weather')).toBe('false');
    expect(mapPicker.attributes('data-style-toggle')).toBe('false');
    expect(mapPicker.attributes('data-place-labels')).toBe('true');
    expect(mapPicker.attributes('data-traffic')).toBe('false');
    expect(mapPicker.attributes('data-projection-toggle')).toBe('false');
    expect(mapPicker.attributes('data-auto-fit')).toBe('true');
    expect(mapPicker.attributes('data-single-point-zoom')).toBe('13.35');
    expect(mapPicker.attributes('data-label-mode')).toBe('full');
    expect(mapPicker.attributes('data-plain-pin-marker')).toBe('true');
    expect(wrapper.find('[data-test="pin-picker-detail-card"]').exists()).toBe(false);
    expect(reverseGeocodeMock).toHaveBeenCalledWith(31.7619, -106.485);
    expect(searchNearbyPlacesMock).toHaveBeenCalledWith(expect.objectContaining({
      center: { latitude: 31.7619, longitude: -106.485 },
      limit: 18,
    }));
    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Starbucks');
    expect((wrapper.get('input[name="address"]').element as HTMLInputElement).value).toBe('222 Mesa Street');
    expect((wrapper.get('input[name="city"]').element as HTMLInputElement).value).toBe('El Paso');
    expect((wrapper.get('input[name="postalCode"]').element as HTMLInputElement).value).toBe('79901');
    expect((wrapper.get('select[name="category"]').element as HTMLSelectElement).value).toBe('food');
  });

  it('resolves typed provider places and preserves the backend publish verification boundary', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        id: 'mapbox.costco',
        latitude: 32.8601,
        longitude: -97.315,
        placeName: 'Costco Wholesale',
        formattedAddress: '8900 Tehama Ridge Pkwy, Fort Worth, Texas 76177',
        address: '8900 Tehama Ridge Pkwy',
        city: 'Fort Worth',
        country: 'US',
        postalCode: '76177',
        providerPlaceId: 'mapbox.costco',
        precision: 'poi',
        category: 'supermarket',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: '',
          address: '',
          city: '',
          postalCode: '',
          category: 'food',
        },
      },
    });

    await wrapper.get('input[name="title"]').setValue('costco tehama ridge');
    await wrapper.get('input[name="title"]').trigger('blur');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith(
      'costco tehama ridge US',
      expect.objectContaining({ limit: 1, preferPoi: true }),
    );
    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('costco tehama ridge');
    expect((wrapper.get('select[name="category"]').element as HTMLSelectElement).value).toBe('shopping');
    expect(wrapper.find('.verify-button').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Verified place');
  });

  it('keeps typed place text and clears stale provider details after manual coordinate edits', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        id: 'mapbox.stockyards',
        latitude: 32.78987,
        longitude: -97.34914,
        placeName: 'Stockyards',
        formattedAddress: 'Stockyards, Fort Worth, Texas 76164',
        address: 'Stockyards',
        city: 'Fort Worth',
        country: 'US',
        postalCode: '76164',
        providerPlaceId: 'mapbox.stockyards',
        precision: 'poi',
        category: 'tourism',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: '',
          address: '',
          city: 'Fort Worth',
          postalCode: '',
        },
      },
    });

    await wrapper.get('input[name="title"]').setValue('Fort Worth Water Gardens UI Scope');
    await wrapper.get('input[name="title"]').trigger('blur');
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage;
    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Fort Worth Water Gardens UI Scope');
    expect(coverage.form.providerPlaceId).toBe('mapbox.stockyards');

    await wrapper.get('input[name="latitude"]').setValue('32.74769');
    await wrapper.get('input[name="longitude"]').setValue('-97.32555');

    expect(coverage.form.providerPlaceId).toBe('');
    expect(coverage.form.providerPlaceName).toBe('');
    expect(coverage.form.providerPlaceAddress).toBe('');
  });

  it('ignores stale typed place lookup results after later manual edits', async () => {
    const lookup = deferred<{ data: any[] }>();
    searchLocationsMock.mockReturnValueOnce(lookup.promise);

    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: '',
          address: '',
          city: 'Fort Worth',
          postalCode: '76102',
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    await wrapper.get('input[name="title"]').setValue('Fort Worth Water Gardens UI Scope');
    await wrapper.get('input[name="title"]').trigger('blur');
    await wrapper.get('input[name="address"]').setValue('1502 Commerce St');
    await wrapper.get('input[name="latitude"]').setValue('32.74769');
    await wrapper.get('input[name="longitude"]').setValue('-97.32555');

    lookup.resolve({
      data: [{
        id: 'mapbox.fort-worth',
        latitude: 32.753521,
        longitude: -97.331527,
        placeName: 'Fort Worth',
        formattedAddress: 'Fort Worth, Texas 76102, United States',
        address: 'Fort Worth',
        city: 'Fort Worth',
        country: 'US',
        postalCode: '76102',
        providerPlaceId: 'mapbox.fort-worth',
        precision: 'place',
        source: 'mapbox',
      }],
    });
    await flushPromises();

    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Fort Worth Water Gardens UI Scope');
    expect((wrapper.get('input[name="address"]').element as HTMLInputElement).value).toBe('1502 Commerce St');
    expect((wrapper.get('input[name="latitude"]').element as HTMLInputElement).value).toBe('32.74769');
    expect((wrapper.get('input[name="longitude"]').element as HTMLInputElement).value).toBe('-97.32555');
    expect(coverage.form.providerPlaceId).toBe('');
  });

  it('preserves an in-progress create draft when initial location props refresh', async () => {
    const wrapper = mount(SpotForm, {
      props: {
        initialValue: {
          ...validInput,
          title: '',
          address: '',
          city: '',
          postalCode: '',
        },
      },
    });

    await wrapper.get('input[name="title"]').setValue('Fort Worth Water Gardens UI Scope');
    await wrapper.get('input[name="address"]').setValue('1502 Commerce St');
    await wrapper.get('input[name="city"]').setValue('Fort Worth');
    await wrapper.get('input[name="latitude"]').setValue('32.74769');
    await wrapper.get('input[name="longitude"]').setValue('-97.32555');
    await wrapper.setProps({
      initialValue: {
        ...validInput,
        title: '',
        address: '',
        city: 'Fort Worth',
        country: 'US',
        postalCode: '76102',
      },
    });
    await flushPromises();

    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Fort Worth Water Gardens UI Scope');
    expect((wrapper.get('input[name="address"]').element as HTMLInputElement).value).toBe('1502 Commerce St');
    expect((wrapper.get('input[name="city"]').element as HTMLInputElement).value).toBe('Fort Worth');
    expect((wrapper.get('input[name="latitude"]').element as HTMLInputElement).value).toBe('32.74769');
    expect((wrapper.get('input[name="longitude"]').element as HTMLInputElement).value).toBe('-97.32555');
  });

  it('runs backend place checks on every map click and ignores stale pin lookup results', async () => {
    const firstNearby = deferred<{ data: any[] }>();
    searchNearbyPlacesMock
      .mockReturnValueOnce(firstNearby.promise)
      .mockResolvedValueOnce({
        data: [{
          id: 'mapbox.second',
          latitude: 31.762,
          longitude: -106.485,
          placeName: 'Second Coffee',
          formattedAddress: '2 Mesa Street, El Paso, Texas 79901',
          address: '2 Mesa Street',
          city: 'El Paso',
          country: 'US',
          postalCode: '79901',
          providerPlaceId: 'mapbox.second',
          precision: 'poi',
          category: 'coffee',
          distanceKm: 0.01,
          source: 'mapbox',
        }],
      });

    const wrapper = mount(SpotForm, {
      props: {
        initialValue: validInput,
      },
    });

    await wrapper.get('[data-test="spot-map-picker"]').trigger('click');
    await wrapper.get('[data-test="spot-map-picker"]').trigger('click');
    await flushPromises();

    expect(reverseGeocodeMock).toHaveBeenCalledTimes(2);
    expect(searchNearbyPlacesMock).toHaveBeenCalledTimes(2);
    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Second Coffee');

    firstNearby.resolve({
      data: [{
        id: 'mapbox.first',
        latitude: 31.762,
        longitude: -106.485,
        placeName: 'First Coffee',
        formattedAddress: '1 Mesa Street, El Paso, Texas 79901',
        address: '1 Mesa Street',
        city: 'El Paso',
        country: 'US',
        postalCode: '79901',
        providerPlaceId: 'mapbox.first',
        precision: 'poi',
        category: 'coffee',
        distanceKm: 0.01,
        source: 'mapbox',
      }],
    });
    await flushPromises();

    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Second Coffee');
    expect((wrapper.get('input[name="address"]').element as HTMLInputElement).value).toBe('2 Mesa Street');
  });
});
