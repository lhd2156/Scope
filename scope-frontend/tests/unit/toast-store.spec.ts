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
