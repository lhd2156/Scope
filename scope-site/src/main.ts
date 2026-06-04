import * as Sentry from "@sentry/vue";
import { createApp } from "vue";
import App from "@/App.vue";
import { router } from "@/router";
import "@/style.css";

const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.1;

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

const app = createApp(App);

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: parseSentrySampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
  });
}

app.use(router).mount("#app");
