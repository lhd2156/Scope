import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const env = { ...process.env, NODE_ENV: 'production' };

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

run(new URL('../node_modules/vue-tsc/bin/vue-tsc.js', import.meta.url), ['--noEmit']);
run(new URL('../node_modules/vite/bin/vite.js', import.meta.url), ['build', '--configLoader', 'runner']);
