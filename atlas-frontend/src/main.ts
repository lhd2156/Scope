import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@/assets/tokens.css';
import '@/assets/base.css';
import { initializeTheme } from '@/utils/theme';

initializeTheme();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
