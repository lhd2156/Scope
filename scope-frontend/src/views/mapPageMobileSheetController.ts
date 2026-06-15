import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

type MobileSheetState = 'peek' | 'mid' | 'full';

const MOBILE_MAP_BREAKPOINT = 640;
const MOBILE_SHEET_DRAG_LIMIT = 280;
const MOBILE_SHEET_DRAG_THRESHOLD = 72;
const MOBILE_SHEET_STATES: MobileSheetState[] = ['peek', 'mid', 'full'];

type CssVars = Record<string, string>;
type BooleanRef = Readonly<Pick<Ref<boolean>, 'value'>>;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveIsMobileMapLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= MOBILE_MAP_BREAKPOINT;
}

export function useMapPageMobileSheetController(isMapOnboardingStepActive: BooleanRef) {
  const isMobileMapLayout = ref(false);
  const mapSidebarRef = ref<HTMLElement | null>(null);
  const isMapSidebarScrolled = ref(false);
  const mobileSheetState = ref<MobileSheetState>('peek');
  const isDraggingMobileSheet = ref(false);
  const mobileSheetDragStartY = ref(0);
  const mobileSheetDragOffset = ref(0);
  const ignoreNextMobileSheetClick = ref(false);

  const nextMobileSheetState = computed<MobileSheetState>(() => {
    switch (mobileSheetState.value) {
      case 'peek':
        return 'mid';
      case 'mid':
        return 'full';
      default:
        return 'peek';
    }
  });

  const mobileSheetVisibleHeight = computed(() => {
    switch (mobileSheetState.value) {
      case 'peek':
        return '9.5rem';
      case 'mid':
        return 'clamp(24rem, 58dvh, 34rem)';
      default:
        return '100%';
    }
  });

  const mobileSheetStyle = computed<CssVars | undefined>(() => {
    if (!isMobileMapLayout.value) {
      return undefined;
    }

    return {
      '--scope-mobile-sheet-visible': mobileSheetVisibleHeight.value,
      '--scope-mobile-sheet-drag-offset': `${mobileSheetDragOffset.value}px`,
    };
  });

  const mapViewStyle = computed<CssVars | undefined>(() => {
    if (!isMobileMapLayout.value) {
      return undefined;
    }

    return {
      '--scope-mobile-sheet-visible': mobileSheetVisibleHeight.value,
      '--scope-map-controls-top': 'calc(var(--space-3) + 4.75rem)',
      '--scope-map-controls-right': 'var(--space-3)',
      '--scope-map-controls-bottom': 'calc(var(--scope-mobile-sheet-visible) + var(--space-4))',
      '--scope-map-controls-left': 'auto',
      '--scope-map-controls-panel-top': 'var(--space-3)',
      '--scope-map-controls-panel-right': 'var(--space-3)',
      '--scope-map-controls-panel-bottom': 'auto',
      '--scope-map-controls-panel-left': 'auto',
    };
  });

  function syncMapSidebarScrollState() {
    isMapSidebarScrolled.value = !isMobileMapLayout.value && (mapSidebarRef.value?.scrollTop ?? 0) > 8;
  }

  function syncMobileMapLayout() {
    isMobileMapLayout.value = resolveIsMobileMapLayout();
    syncMapSidebarScrollState();
  }

  function setMobileSheetState(nextState: MobileSheetState) {
    mobileSheetState.value = nextState;
  }

  function getAdjacentMobileSheetState(direction: -1 | 1): MobileSheetState {
    const currentIndex = MOBILE_SHEET_STATES.indexOf(mobileSheetState.value);
    const nextIndex = clampNumber(currentIndex + direction, 0, MOBILE_SHEET_STATES.length - 1);
    return MOBILE_SHEET_STATES[nextIndex];
  }

  function removeMobileSheetPointerListeners() {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('pointermove', handleMobileSheetDrag);
    window.removeEventListener('pointerup', finishMobileSheetDrag);
    window.removeEventListener('pointercancel', cancelMobileSheetDrag);
  }

  function cancelMobileSheetDrag() {
    isDraggingMobileSheet.value = false;
    mobileSheetDragOffset.value = 0;
    removeMobileSheetPointerListeners();
  }

  function handleMobileSheetDrag(event: PointerEvent) {
    if (!isDraggingMobileSheet.value) {
      return;
    }

    mobileSheetDragOffset.value = clampNumber(
      event.clientY - mobileSheetDragStartY.value,
      -MOBILE_SHEET_DRAG_LIMIT,
      MOBILE_SHEET_DRAG_LIMIT,
    );
  }

  function finishMobileSheetDrag() {
    if (!isDraggingMobileSheet.value) {
      return;
    }

    const dragDelta = mobileSheetDragOffset.value;
    const hasMeaningfulDrag = Math.abs(dragDelta) > 10;

    cancelMobileSheetDrag();

    if (hasMeaningfulDrag) {
      ignoreNextMobileSheetClick.value = true;
    }

    if (dragDelta <= -MOBILE_SHEET_DRAG_THRESHOLD) {
      setMobileSheetState(getAdjacentMobileSheetState(1));
      return;
    }

    if (dragDelta >= MOBILE_SHEET_DRAG_THRESHOLD) {
      setMobileSheetState(getAdjacentMobileSheetState(-1));
    }
  }

  function startMobileSheetDrag(event: PointerEvent) {
    if (!isMobileMapLayout.value) {
      return;
    }

    const currentTarget = event.currentTarget;
    if (currentTarget instanceof HTMLElement && typeof currentTarget.setPointerCapture === 'function') {
      try {
        currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional for the drag affordance.
      }
    }

    mobileSheetDragStartY.value = event.clientY;
    mobileSheetDragOffset.value = 0;
    isDraggingMobileSheet.value = true;
    ignoreNextMobileSheetClick.value = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', handleMobileSheetDrag);
      window.addEventListener('pointerup', finishMobileSheetDrag);
      window.addEventListener('pointercancel', cancelMobileSheetDrag);
    }
  }

  function handleMobileSheetToggle() {
    if (!isMobileMapLayout.value) {
      return;
    }

    if (ignoreNextMobileSheetClick.value) {
      ignoreNextMobileSheetClick.value = false;
      return;
    }

    setMobileSheetState(nextMobileSheetState.value);
  }

  function revealMobileSheet() {
    if (!isMobileMapLayout.value || mobileSheetState.value !== 'peek') {
      return;
    }

    setMobileSheetState('mid');
  }

  function handleSidebarKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isMobileMapLayout.value && mobileSheetState.value !== 'peek') {
      setMobileSheetState('peek');
    }
  }

  watch(
    [isMobileMapLayout, () => isMapOnboardingStepActive.value],
    ([isMobile, isMapOnboardingStep]) => {
      if (!isMobile) {
        cancelMobileSheetDrag();
        ignoreNextMobileSheetClick.value = false;
        mobileSheetState.value = 'peek';
        return;
      }

      ignoreNextMobileSheetClick.value = false;
      mobileSheetState.value = isMapOnboardingStep ? 'full' : 'peek';
    },
    { immediate: true },
  );

  onMounted(() => {
    syncMobileMapLayout();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncMobileMapLayout);
    }
  });

  onBeforeUnmount(() => {
    cancelMobileSheetDrag();

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', syncMobileMapLayout);
    }
  });

  return {
    isMobileMapLayout,
    mapSidebarRef,
    isMapSidebarScrolled,
    mobileSheetState,
    isDraggingMobileSheet,
    nextMobileSheetState,
    mobileSheetStyle,
    mapViewStyle,
    syncMapSidebarScrollState,
    startMobileSheetDrag,
    handleMobileSheetToggle,
    revealMobileSheet,
    handleSidebarKeydown,
  };
}
