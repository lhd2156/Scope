import { beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  history.pushState({}, '', '/admin/login');
});
