import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/tokens.css';
import '@/assets/base.css';
import { initializeMotionPreference } from '@/utils/motion';
import { registerAppServiceWorker } from '@/utils/pwa';
import { initializeSeo } from '@/utils/seo';
import { initializeTheme } from '@/utils/theme';

initializeTheme();
initializeMotionPreference();
initializeSeo(router);
void registerAppServiceWorker();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
