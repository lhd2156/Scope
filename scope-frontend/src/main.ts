import * as Sentry from '@sentry/vue';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/tokens.css';
import '@/assets/base.css';
import { initializeMotionPreference } from '@/utils/motion';
import { initializeAnalyticsConsent } from '@/utils/analyticsConsent';
import { isScopeQaMode, syncScopeQaDocumentState } from '@/utils/qaMode';
import { scheduleNonCriticalTask } from '@/utils/scheduleNonCriticalTask';
import { initializeSeo } from '@/utils/seo';
import { initializeTheme } from '@/utils/theme';
import { installTrustedTypesDefaultPolicy } from '@/utils/trustedHtml';

const DEV_SERVICE_WORKER_CLEANUP_KEY = 'scope-dev-service-worker-cleanup-v1';
const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.1;
const REDACTED_ROUTE_VALUE = '[redacted]';
const SHARE_ROUTE_TOKEN_PATTERN = /(\/trips\/shared\/)[^/?#\s]+/gi;
const SHARE_TOKEN_QUERY_PATTERN = /([?&](?:token|shareToken|share_token)=)[^&#\s]+/gi;
const SENSITIVE_QUERY_KEYS = new Set(['token', 'sharetoken', 'share_token']);

type SentryRequestData = NonNullable<Sentry.ErrorEvent['request']>;
type SentryQueryParams = SentryRequestData['query_string'];

function parseSentrySampleRate(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
  }

  return parsed;
}

function scrubSensitiveRouteValues(value: string): string {
  return value
    .replace(SHARE_ROUTE_TOKEN_PATTERN, `$1${REDACTED_ROUTE_VALUE}`)
    .replace(SHARE_TOKEN_QUERY_PATTERN, `$1${REDACTED_ROUTE_VALUE}`);
}

function shouldScrubQueryKey(key: string): boolean {
  return SENSITIVE_QUERY_KEYS.has(key.toLowerCase());
}

function scrubQueryParams(queryParams: SentryQueryParams): SentryQueryParams {
  if (typeof queryParams === 'string') {
    return scrubSensitiveRouteValues(queryParams);
  }

  if (Array.isArray(queryParams)) {
    let changed = false;
    const nextQueryParams = queryParams.map(([key, value]) => {
      if (shouldScrubQueryKey(key)) {
        changed = true;
        return [key, REDACTED_ROUTE_VALUE] as [string, string];
      }

      const scrubbedValue = scrubSensitiveRouteValues(value);
      changed = changed || scrubbedValue !== value;
      return [key, scrubbedValue] as [string, string];
    });

    return changed ? nextQueryParams : queryParams;
  }

  if (queryParams && typeof queryParams === 'object') {
    let changed = false;
    const nextQueryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (shouldScrubQueryKey(key)) {
        changed = true;
        nextQueryParams[key] = REDACTED_ROUTE_VALUE;
        continue;
      }

      const scrubbedValue = scrubSensitiveRouteValues(value);
      changed = changed || scrubbedValue !== value;
      nextQueryParams[key] = scrubbedValue;
    }

    return changed ? nextQueryParams : queryParams;
  }

  return queryParams;
}

function scrubStringRecord(values: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!values) {
    return values;
  }

  let changed = false;
  const nextValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const scrubbedValue = scrubSensitiveRouteValues(value);
    changed = changed || scrubbedValue !== value;
    nextValues[key] = scrubbedValue;
  }

  return changed ? nextValues : values;
}

function scrubBreadcrumbData(data: Sentry.Breadcrumb['data']): Sentry.Breadcrumb['data'] {
  if (!data) {
    return data;
  }

  let changed = false;
  const nextData: Sentry.Breadcrumb['data'] = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const scrubbedValue = scrubSensitiveRouteValues(value);
      changed = changed || scrubbedValue !== value;
      nextData[key] = scrubbedValue;
      continue;
    }

    nextData[key] = value;
  }

  return changed ? nextData : data;
}

function sanitizeSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = scrubSensitiveRouteValues(event.message);
  }
  if (event.logentry?.message) {
    event.logentry.message = scrubSensitiveRouteValues(event.logentry.message);
  }
  if (event.transaction) {
    event.transaction = scrubSensitiveRouteValues(event.transaction);
  }
  if (event.request?.url) {
    event.request.url = scrubSensitiveRouteValues(event.request.url);
  }
  if (event.request) {
    event.request.headers = scrubStringRecord(event.request.headers);
    event.request.query_string = scrubQueryParams(event.request.query_string);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      category: breadcrumb.category ? scrubSensitiveRouteValues(breadcrumb.category) : breadcrumb.category,
      message: breadcrumb.message ? scrubSensitiveRouteValues(breadcrumb.message) : breadcrumb.message,
      data: scrubBreadcrumbData(breadcrumb.data),
    }));
  }

  return event;
}

function shouldRegisterServiceWorker(): boolean {
  return (
    import.meta.env.VITE_DISABLE_SERVICE_WORKER !== 'true' &&
    typeof navigator !== 'undefined' &&
    !/Chrome-Lighthouse/i.test(navigator.userAgent)
  );
}

async function cleanupDevelopmentServiceWorkerState(): Promise<boolean> {
  if (import.meta.env.PROD || typeof window === 'undefined') {
    return false;
  }

  const serviceWorkerContainer = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  const cacheStorage = 'caches' in window ? window.caches : null;
  const registrations = serviceWorkerContainer ? await serviceWorkerContainer.getRegistrations().catch(() => []) : [];
  const cacheNames = cacheStorage ? await cacheStorage.keys().catch(() => []) : [];
  const scopeCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith('scope-'));
  const hadActiveScopeWorker = Boolean(serviceWorkerContainer?.controller) || registrations.length > 0;

  await Promise.all([
    ...registrations.map((registration) => registration.unregister().catch(() => false)),
    ...scopeCacheNames.map((cacheName) => cacheStorage?.delete(cacheName).catch(() => false)),
  ]);

  if (!hadActiveScopeWorker && !scopeCacheNames.length) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(DEV_SERVICE_WORKER_CLEANUP_KEY) === 'reloaded') {
      return false;
    }
    window.sessionStorage.setItem(DEV_SERVICE_WORKER_CLEANUP_KEY, 'reloaded');
  } catch {
    // Session storage can be blocked. Clearing the worker/cache is still useful.
  }

  window.location.reload();
  return true;
}

async function bootstrapApp(): Promise<void> {
  const reloadRequested = await cleanupDevelopmentServiceWorkerState();
  if (reloadRequested) {
    return;
  }

  syncScopeQaDocumentState();
  installTrustedTypesDefaultPolicy();
  initializeTheme();
  initializeMotionPreference();
  initializeSeo(router);

  const app = createApp(App);

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      app,
      dsn: sentryDsn,
      tracesSampleRate: parseSentrySampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      beforeSend: sanitizeSentryEvent,
    });
  }

  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  if (!isScopeQaMode()) {
    scheduleNonCriticalTask(async () => {
      const pwaModule = await (shouldRegisterServiceWorker() ? import('@/utils/pwa') : Promise.resolve(null));

      initializeAnalyticsConsent();

      if (pwaModule) {
        await pwaModule.registerAppServiceWorker();
      }
    }, {
      delayMs: 1_200,
      timeoutMs: 3_000,
    });
  }
}

void bootstrapApp();
