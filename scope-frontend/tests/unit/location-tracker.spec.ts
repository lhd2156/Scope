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
    expect(wrapper.text()).toContain('Live GPS active');
    expect(wrapper.text()).toContain('Accuracy ±12m');
    expect(wrapper.emitted('update:location')?.[0]?.[0]).toMatchObject({ latitude: 32.7555, longitude: -97.3308 });
    expect(wrapper.emitted('tracking-state')?.at(-1)).toEqual(['tracking']);
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
});
