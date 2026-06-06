import { createPinia, setActivePinia } from 'pinia';
import { useToastStore } from '@/stores/toasts';

describe('toast store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds toast items with normalized defaults and convenience helpers', () => {
    const store = useToastStore();

    const toastId = store.showSuccess({
      title: '  Saved  ',
      message: '  Spot saved to Scope.  ',
    });

    expect(toastId).toBeTruthy();
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({
      id: toastId,
      title: 'Saved',
      message: 'Spot saved to Scope.',
      tone: 'success',
      autoHideMs: 4000,
    });
  });

  it('dismisses toasts without firing close callbacks when explicitly skipped', () => {
    const store = useToastStore();
    const onClose = vi.fn();

    const toastId = store.showError({
      title: 'Session expired',
      message: 'Sign in again.',
      autoHideMs: 0,
      onClose,
    });

    store.dismissToast(toastId, { invokeOnClose: false });

    expect(store.items).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles missing dismissals and invokes close callbacks by default', () => {
    const store = useToastStore();
    const onClose = vi.fn();

    store.dismissToast('toast-missing');

    const toastId = store.showInfo({
      title: 'Sync complete',
      message: 'Latest changes are available.',
      onClose,
    });

    store.dismissToast(toastId);

    expect(store.items).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears all toasts, applies copy fallbacks, and invokes close callbacks', () => {
    const store = useToastStore();
    const firstClose = vi.fn();
    const secondClose = vi.fn();

    store.pushToast({
      title: '   ',
      message: '   ',
      autoHideMs: Number.NaN,
      onClose: firstClose,
    });
    store.pushToast({
      title: 'Ready',
      message: 'Production gates finished.',
      autoHideMs: -100,
      onClose: secondClose,
    });

    expect(store.items[1]).toMatchObject({
      title: 'Scope update',
      message: 'Your latest Scope update is ready.',
      tone: 'info',
      autoHideMs: 4000,
    });
    expect(store.items[0].autoHideMs).toBe(0);

    store.clearToasts();

    expect(store.hasToasts).toBe(false);
    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
  });

  it('keeps only the newest four toasts visible', () => {
    const store = useToastStore();

    for (let index = 1; index <= 5; index += 1) {
      store.showInfo({
        title: `Toast ${index}`,
        message: `Message ${index}`,
      });
    }

    expect(store.items).toHaveLength(4);
    expect(store.items.map((toast) => toast.title)).toEqual(['Toast 5', 'Toast 4', 'Toast 3', 'Toast 2']);
  });
});
