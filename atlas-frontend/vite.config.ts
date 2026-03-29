import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('/node_modules/mapbox-gl/dist/esm-min/worker.js')) {
            return 'mapbox-gl-worker';
          }

          if (normalizedId.includes('/node_modules/mapbox-gl/dist/esm-min/shared.js')) {
            return 'mapbox-gl-shared';
          }

          if (normalizedId.includes('/node_modules/mapbox-gl/dist/esm-min/mapbox-gl.js')) {
            return 'mapbox-gl-core';
          }

          if (normalizedId.includes('/node_modules/@microsoft/signalr/')) {
            return 'signalr';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
  },
});
