import * as Sentry from '@sentry/vue';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import { router } from '@/router';
import { installAuthUnauthorizedListener } from '@/stores/authStore';
import { parseSentrySampleRate, sanitizeSentryEvent } from '@/utils/sentry';
import '@/index.css';

const app = createApp(App);

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: parseSentrySampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    beforeSend: sanitizeSentryEvent,
  });
}

app.use(createPinia());
app.use(router);
installAuthUnauthorizedListener();

app.mount('#root');
