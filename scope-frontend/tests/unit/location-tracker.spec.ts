const { geolocationMocks } = vi.hoisted(() => ({
  geolocationMocks: {
    isGeolocationSupported: vi.fn(() => true),
    startLocationWatch: vi.fn(),
    stopLocationWatch: vi.fn(),
  },
}));

vi.mock('@/utils/geolocation', () => geolocationMocks);

import { mount } from '@vue/test-utils';
import LocationTracker from '@/components/map/LocationTracker.vue';

describe('LocationTracker', () => {
  beforeEach(() => {
    geolocationMocks.isGeolocationSupported.mockReturnValue(true);
    geolocationMocks.startLocationWatch.mockReset();
    geolocationMocks.stopLocationWatch.mockReset();
  });

  it('starts tracking automatically and emits live location updates', async () => {
    geolocationMocks.startLocationWatch.mockImplementation((onSuccess: (location: any) => void) => {
      onSuccess({ latitude: 32.7555, longitude: -97.3308, accuracy: 12, timestamp: Date.now() });
      return 41;
    });

    const wrapper = mount(LocationTracker);

    expect(geolocationMocks.startLocationWatch).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Location on');
    expect(wrapper.text()).toContain('Precision 12 m');
    expect(wrapper.emitted('update:location')?.[0]?.[0]).toMatchObject({ latitude: 32.7555, longitude: -97.3308 });
    expect(wrapper.emitted('tracking-state')?.at(-1)).toEqual(['tracking']);

    await wrapper.trigger('click');

    expect(wrapper.attributes('role')).toBe('button');
    expect(wrapper.emitted('activate')?.[0]?.[0]).toMatchObject({ latitude: 32.7555, longitude: -97.3308 });
  });

  it('surfaces permission denial when the watch callback errors', () => {
    geolocationMocks.startLocationWatch.mockImplementation((_onSuccess: unknown, onError: (error: { code: number }) => void) => {
      onError({ code: 1 });
      return 42;
    });

    const wrapper = mount(LocationTracker);

    expect(wrapper.text()).toContain('Location permission blocked');
    expect(wrapper.text()).toContain('Allow location access');
    expect(geolocationMocks.stopLocationWatch).toHaveBeenCalled();
  });

  it('stays inert when geolocation is unsupported', async () => {
    geolocationMocks.isGeolocationSupported.mockReturnValue(false);

    const wrapper = mount(LocationTracker);

    expect(wrapper.text()).toContain('Location unavailable');
    expect(wrapper.text()).toContain('This browser cannot provide real-time location updates.');
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(geolocationMocks.startLocationWatch).not.toHaveBeenCalled();

    await wrapper.trigger('click');

    expect(wrapper.emitted('activate')).toBeUndefined();
    expect(wrapper.emitted('tracking-state')?.at(-1)).toEqual(['unsupported']);
  });

  it('reports transient GPS errors and null watch handles as unavailable states', () => {
    geolocationMocks.startLocationWatch.mockImplementationOnce((_onSuccess: unknown, onError: (error: { code: number }) => void) => {
      onError({ code: 2 });
      return 43;
    });

    const errorWrapper = mount(LocationTracker);

    expect(errorWrapper.text()).toContain('GPS temporarily unavailable');
    expect(errorWrapper.text()).toContain('Scope could not read your position.');
    expect(errorWrapper.emitted('tracking-state')?.at(-1)).toEqual(['error']);

    geolocationMocks.startLocationWatch.mockReturnValueOnce(null);
    const unsupportedWrapper = mount(LocationTracker);

    expect(unsupportedWrapper.text()).toContain('Location unavailable');
    expect(unsupportedWrapper.emitted('tracking-state')?.at(-1)).toEqual(['unsupported']);
  });
});
