export type MapPresentationMode = 'scope' | 'native';
export type MapProjectionName = 'globe' | 'mercator';

export const MAP_STYLE_MODE_STORAGE_KEY = 'scope.tripPlanner.mapStyleMode';
export const MAP_PROJECTION_MODE_STORAGE_KEY = 'scope.map.projectionMode';

export function isMapProjectionMode(value: string | null | undefined): value is MapProjectionName {
  return value === 'globe' || value === 'mercator';
}

export function isMapPresentationMode(value: string | null | undefined): value is MapPresentationMode {
  return value === 'scope' || value === 'native';
}

export function readMapProjectionModePreference(persistMapPreferences: boolean): MapProjectionName | null {
  if (!persistMapPreferences || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedMode = window.localStorage.getItem(MAP_PROJECTION_MODE_STORAGE_KEY);
    return isMapProjectionMode(storedMode) ? storedMode : null;
  } catch {
    return null;
  }
}

export function writeMapProjectionModePreference(persistMapPreferences: boolean, mode: MapProjectionName): void {
  if (!persistMapPreferences || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(MAP_PROJECTION_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private contexts; the in-session mode still works.
  }
}

export function readMapStyleModePreference(persistMapPreferences: boolean): MapPresentationMode | null {
  if (!persistMapPreferences || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedMode = window.localStorage.getItem(MAP_STYLE_MODE_STORAGE_KEY);
    return isMapPresentationMode(storedMode) ? storedMode : null;
  } catch {
    return null;
  }
}

export function writeMapStyleModePreference(persistMapPreferences: boolean, mode: MapPresentationMode): void {
  if (!persistMapPreferences || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(MAP_STYLE_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private contexts; the in-session mode still works.
  }
}
