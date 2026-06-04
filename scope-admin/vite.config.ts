/// <reference types="vitest" />
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type UserConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: process.env.VITE_ADMIN_BASE_PATH ?? '/admin/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/assets/**', 'src/main.ts', 'src/types/**'],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 80,
      },
    },
  },
} as unknown as UserConfig);
