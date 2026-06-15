import {
  MAP_PROJECTION_MODE_STORAGE_KEY,
  MAP_STYLE_MODE_STORAGE_KEY,
  isMapPresentationMode,
  isMapProjectionMode,
  readMapProjectionModePreference,
  readMapStyleModePreference,
  writeMapProjectionModePreference,
  writeMapStyleModePreference,
} from '@/components/map/mapPreferences';

describe('mapPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validates persisted map projection and presentation modes', () => {
    expect(isMapProjectionMode('globe')).toBe(true);
    expect(isMapProjectionMode('mercator')).toBe(true);
    expect(isMapProjectionMode('flat')).toBe(false);
    expect(isMapPresentationMode('scope')).toBe(true);
    expect(isMapPresentationMode('native')).toBe(true);
    expect(isMapPresentationMode('satellite')).toBe(false);
  });

  it('reads and writes persisted map preferences only when enabled', () => {
    writeMapProjectionModePreference(false, 'mercator');
    writeMapStyleModePreference(false, 'native');

    expect(readMapProjectionModePreference(false)).toBeNull();
    expect(readMapStyleModePreference(false)).toBeNull();
    expect(window.localStorage.getItem(MAP_PROJECTION_MODE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(MAP_STYLE_MODE_STORAGE_KEY)).toBeNull();

    writeMapProjectionModePreference(true, 'mercator');
    writeMapStyleModePreference(true, 'native');

    expect(readMapProjectionModePreference(true)).toBe('mercator');
    expect(readMapStyleModePreference(true)).toBe('native');
  });

  it('ignores invalid stored map preferences', () => {
    window.localStorage.setItem(MAP_PROJECTION_MODE_STORAGE_KEY, 'flat');
    window.localStorage.setItem(MAP_STYLE_MODE_STORAGE_KEY, 'satellite');

    expect(readMapProjectionModePreference(true)).toBeNull();
    expect(readMapStyleModePreference(true)).toBeNull();
  });
});
