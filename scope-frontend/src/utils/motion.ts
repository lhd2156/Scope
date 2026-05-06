import { readonly, ref } from 'vue';

const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';
const reducedMotion = ref(false);

let mediaQueryList: MediaQueryList | null = null;
let hasAttachedListener = false;

function syncReducedMotionPreference(matches: boolean): void {
  reducedMotion.value = matches;

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-reduced-motion', matches ? 'reduce' : 'no-preference');
  }
}

function handleReducedMotionChange(event: MediaQueryList | MediaQueryListEvent): void {
  syncReducedMotionPreference(event.matches);
}

export function initializeMotionPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    syncReducedMotionPreference(false);
    return reducedMotion.value;
  }

  mediaQueryList ??= window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  syncReducedMotionPreference(mediaQueryList.matches);

  if (!hasAttachedListener) {
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleReducedMotionChange);
    } else if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handleReducedMotionChange);
    }

    hasAttachedListener = true;
  }

  return reducedMotion.value;
}

export function useReducedMotion() {
  return readonly(reducedMotion);
}
