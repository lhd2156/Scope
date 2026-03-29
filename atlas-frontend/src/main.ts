import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/tokens.css';
import '@/assets/base.css';
import { initializeMotionPreference } from '@/utils/motion';
import { initializeTheme } from '@/utils/theme';

initializeTheme();
initializeMotionPreference();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
