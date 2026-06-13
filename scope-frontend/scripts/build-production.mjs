import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim() || 'https://api.scopetrips.com';

const productionEnv = {
  VITE_API_BASE_URL: apiBaseUrl,
  VITE_DEMO_MODE: 'false',
  VITE_ENABLE_LOCAL_PREVIEW: 'false',
  VITE_LOCAL_PREVIEW_LOGIN_EMAIL: '',
  VITE_LOCAL_PREVIEW_LOGIN_PASSWORD: '',
  VITE_ENABLE_COGNITO_OAUTH: 'false',
  VITE_ENABLE_DEMO_WEATHER: 'false',
  VITE_ENABLE_CLIENT_WEATHER_FALLBACK: 'false',
  VITE_OPENWEATHERMAP_API_KEY: '',
  VITE_ENABLE_TRIP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_SPOT_MOCK_FALLBACK: 'false',
  VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_AGENT_LOCAL_FALLBACK: 'false',
  VITE_ENABLE_AUTH_MOCK_FALLBACK: 'false',
  VITE_ENABLE_USER_MOCK_FALLBACK: 'false',
  VITE_ENABLE_MAP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_FEED_MOCK_FALLBACK: 'false',
  VITE_ENABLE_NOTIFICATION_MOCK_FALLBACK: 'false',
  VITE_ENABLE_MAPBOX_IN_UI_TESTS:
    process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS === 'true' ? 'true' : 'false',
};

const env = { ...process.env, ...productionEnv, NODE_ENV: 'production' };

function run(scriptUrl, args) {
  const result = spawnSync(process.execPath, [fileURLToPath(scriptUrl), ...args], {
    env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(new URL('./verify-scope-wasm-lexer.mjs', import.meta.url), []);
run(new URL('../node_modules/vue-tsc/bin/vue-tsc.js', import.meta.url), ['--noEmit']);
run(new URL('../node_modules/vite/bin/vite.js', import.meta.url), ['build', '--configLoader', 'runner']);
