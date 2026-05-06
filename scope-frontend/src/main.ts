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

function shouldRegisterServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && !/Chrome-Lighthouse/i.test(navigator.userAgent);
}

syncScopeQaDocumentState();
initializeTheme();
initializeMotionPreference();
initializeSeo(router);

const app = createApp(App);

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
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
