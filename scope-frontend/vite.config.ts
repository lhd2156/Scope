import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import fs from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';

function copyOptionalWasmArtifacts() {
  return {
    name: 'scope-copy-optional-wasm-artifacts',
    apply: 'build' as const,
    async closeBundle() {
      const sourceDirectory = path.resolve(__dirname, 'wasm/dist');
      if (!fs.existsSync(sourceDirectory)) {
        return;
      }

      const targetDirectory = path.resolve(__dirname, 'dist/wasm/dist');
      await mkdir(targetDirectory, { recursive: true });
      await cp(sourceDirectory, targetDirectory, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [vue(), copyOptionalWasmArtifacts()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/emsdk/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        ws: true,
      },
      '/media': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // mapbox-gl is intentionally isolated and lazy-loaded by the map service.
    // Keep the warning threshold just above that known vendor payload so any
    // future accidental mega-chunk still shows up during production builds.
    chunkSizeWarningLimit: 1_800,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        const warningId = 'id' in warning && typeof warning.id === 'string' ? warning.id.replace(/\\/g, '/') : '';

        if (
          warning.code === 'INVALID_ANNOTATION' &&
          warningId.includes('/node_modules/@microsoft/signalr/') &&
          warning.message.includes('#__PURE__')
        ) {
          return;
        }

        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          // Heavy map bundle is its own chunk so only map-bearing routes pay
          // the cost; other routes never download it.
          if (normalizedId.includes('/node_modules/mapbox-gl/')) {
            return 'mapbox-gl';
          }

          // SignalR is only used by authenticated realtime surfaces. Keep it
          // isolated so the unauthenticated shell never downloads it.
          if (normalizedId.includes('/node_modules/@microsoft/signalr/')) {
            return 'signalr';
          }

          // Framework vendor chunk: vue + vue-router + pinia + @vueuse are
          // imported by essentially every route, so splitting them into a
          // dedicated chunk lets the browser long-term-cache ~130 KB across
          // every app-code deploy. Without this, changes to app code bust the
          // cache for a file that also contains vendor JS that never changed.
          if (
            normalizedId.includes('/node_modules/vue/') ||
            normalizedId.includes('/node_modules/@vue/') ||
            normalizedId.includes('/node_modules/vue-router/') ||
            normalizedId.includes('/node_modules/pinia/') ||
            normalizedId.includes('/node_modules/@vueuse/')
          ) {
            return 'vue-vendor';
          }

          // Axios is used on almost every page for API calls; pin it to its
          // own chunk so a vue upgrade doesn't also bust the HTTP client cache.
          if (normalizedId.includes('/node_modules/axios/')) {
            return 'http-vendor';
          }

          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
  },
});
