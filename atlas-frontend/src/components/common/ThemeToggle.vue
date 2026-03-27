<template>
  <button class="theme-toggle" @click="toggleTheme">{{ theme === 'dark' ? '☀️' : '🌙' }}</button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ThemeMode } from '@/types';
import { applyTheme, getStoredTheme } from '@/utils/theme';

const theme = ref<ThemeMode>(getStoredTheme());
applyTheme(theme.value);
const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  applyTheme(theme.value);
};
</script>

<style scoped>
.theme-toggle{width:2.75rem;height:2.75rem;border-radius:var(--radius-full);border:1px solid var(--border);background:var(--glass-bg);color:var(--text-primary);cursor:pointer}
</style>
