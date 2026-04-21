interface ServiceWorkerContainerLike {
  register: (scriptUrl: string, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>;
}

interface RegisterAppServiceWorkerOptions {
  isProduction?: boolean;
  serviceWorkerContainer?: ServiceWorkerContainerLike;
}

export async function registerAppServiceWorker(options: RegisterAppServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | null> {
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  const serviceWorkerContainer = options.serviceWorkerContainer ?? (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  const serviceWorkerDisabled = import.meta.env.VITE_DISABLE_SERVICE_WORKER === 'true';

  if (!isProduction || !serviceWorkerContainer || serviceWorkerDisabled) {
    return null;
  }

  try {
    return await serviceWorkerContainer.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}
