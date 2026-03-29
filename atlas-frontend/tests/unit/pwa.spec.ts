import { registerAppServiceWorker } from '@/utils/pwa';

describe('registerAppServiceWorker', () => {
  it('skips registration outside production builds', async () => {
    const register = vi.fn();

    await expect(
      registerAppServiceWorker({
        isProduction: false,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBeNull();

    expect(register).not.toHaveBeenCalled();
  });

  it('registers the shell service worker in production', async () => {
    const registration = { scope: '/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('returns null when registration fails', async () => {
    const register = vi.fn().mockRejectedValue(new Error('registration failed'));

    await expect(
      registerAppServiceWorker({
        isProduction: true,
        serviceWorkerContainer: { register },
      }),
    ).resolves.toBeNull();
  });
});
