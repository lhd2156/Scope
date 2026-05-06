type TrustedScriptUrlLike = {
  readonly __scopeTrustedScriptUrlBrand?: unique symbol;
};

type TrustedTypesPolicyLike = {
  createScriptURL: (value: string) => TrustedScriptUrlLike;
};

type TrustedTypesWindowLike = Window & {
  trustedTypes?: {
    createPolicy: (
      name: string,
      rules: {
        createScriptURL: (value: string) => string;
      },
    ) => TrustedTypesPolicyLike;
  };
};

type ServiceWorkerScriptUrl = string | TrustedScriptUrlLike;

interface ServiceWorkerContainerLike {
  register: (scriptUrl: ServiceWorkerScriptUrl, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>;
}

interface RegisterAppServiceWorkerOptions {
  isProduction?: boolean;
  serviceWorkerContainer?: ServiceWorkerContainerLike;
}

let serviceWorkerTrustedTypesPolicy: TrustedTypesPolicyLike | null = null;

function resolveServiceWorkerScriptUrl(): ServiceWorkerScriptUrl {
  if (typeof window === 'undefined') {
    return '/sw.js';
  }

  const trustedTypes = (window as TrustedTypesWindowLike).trustedTypes;

  if (!trustedTypes) {
    return '/sw.js';
  }

  try {
    serviceWorkerTrustedTypesPolicy ??= trustedTypes.createPolicy('scope-pwa', {
      createScriptURL: (value) => value,
    });

    return serviceWorkerTrustedTypesPolicy.createScriptURL('/sw.js');
  } catch {
    return '/sw.js';
  }
}

export async function registerAppServiceWorker(options: RegisterAppServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | null> {
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  const browserServiceWorkerContainer =
    typeof navigator !== 'undefined' ? (navigator.serviceWorker as ServiceWorkerContainerLike | undefined) : undefined;
  const serviceWorkerContainer = options.serviceWorkerContainer ?? browserServiceWorkerContainer;
  const serviceWorkerDisabled = import.meta.env.VITE_DISABLE_SERVICE_WORKER === 'true';

  if (!isProduction || !serviceWorkerContainer || serviceWorkerDisabled) {
    return null;
  }

  try {
    return await serviceWorkerContainer.register(resolveServiceWorkerScriptUrl(), { scope: '/' });
  } catch {
    return null;
  }
}
