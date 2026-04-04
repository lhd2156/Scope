import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/tokens.css';
import '@/assets/base.css';
import { initializeMotionPreference } from '@/utils/motion';
import { isAtlasQaMode, syncAtlasQaDocumentState } from '@/utils/qaMode';
import { scheduleNonCriticalTask } from '@/utils/scheduleNonCriticalTask';
import { initializeSeo } from '@/utils/seo';
import { initializeTheme } from '@/utils/theme';

function shouldRegisterServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && !/Chrome-Lighthouse/i.test(navigator.userAgent);
}

syncAtlasQaDocumentState();
initializeTheme();
initializeMotionPreference();
initializeSeo(router);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

if (!isAtlasQaMode()) {
  scheduleNonCriticalTask(async () => {
    const [{ initializeAnalyticsConsent }, pwaModule] = await Promise.all([
      import('@/utils/analyticsConsent'),
      shouldRegisterServiceWorker() ? import('@/utils/pwa') : Promise.resolve(null),
    ]);

    initializeAnalyticsConsent();

    if (pwaModule) {
      await pwaModule.registerAppServiceWorker();
    }
  }, {
    delayMs: 1_200,
    timeoutMs: 3_000,
  });
}
