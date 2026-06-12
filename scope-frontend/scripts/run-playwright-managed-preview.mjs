import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(workspaceRoot, '..');
const vueTscCliPath = resolve(workspaceRoot, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js');
const viteCliPath = resolve(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const localBrowsersPath = resolve(repositoryRoot, '.ms-playwright');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const previewUrl = new URL(baseURL);
const previewHost = previewUrl.hostname || '127.0.0.1';
const previewPort = previewUrl.port || '4173';
const [scriptArgument, ...scriptArguments] = process.argv.slice(2);
const defaultChildTimeoutMs = 45 * 60 * 1000;
const childTimeoutMs = Number.parseInt(
  process.env.PLAYWRIGHT_MANAGED_CHILD_TIMEOUT_MS ?? String(defaultChildTimeoutMs),
  10,
);

function loadPlaywrightEnvFile(path, override = false) {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    if (!override && process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

loadPlaywrightEnvFile(resolve(repositoryRoot, '.env'));
loadPlaywrightEnvFile(resolve(workspaceRoot, '.env.local'));

if (
  process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS === undefined &&
  String(process.env.VITE_MAPBOX_TOKEN ?? '').trim()
) {
  process.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS = 'true';
}

const noMockEnvDefaults = {
  VITE_DEMO_MODE: process.env.PLAYWRIGHT_DEMO_MODE ?? 'false',
  VITE_ENABLE_AUTH_MOCK_FALLBACK: 'false',
  VITE_ENABLE_TRIP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_SPOT_MOCK_FALLBACK: 'false',
  VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK: 'false',
  VITE_ENABLE_USER_MOCK_FALLBACK: 'false',
  VITE_ENABLE_SOCIAL_MOCK_FALLBACK: 'false',
  VITE_ENABLE_MAP_MOCK_FALLBACK: 'false',
  VITE_ENABLE_CLIENT_WEATHER_FALLBACK: 'false',
  VITE_ENABLE_DEMO_WEATHER: 'false',
  VITE_ENABLE_DEMO_FUEL_PRICES: 'false',
  VITE_ENABLE_AGENT_LOCAL_FALLBACK: 'false',
  VITE_ENABLE_INTEL_MOCK_FALLBACK: 'false',
  VITE_DISABLE_SERVICE_WORKER: 'true',
  VITE_SCOPE_AI_MIN_REPLY_MS: '',
};

function managedEnvironment(extraEnvironment = {}) {
  return {
    ...process.env,
    ...(existsSync(localBrowsersPath) && !process.env.PLAYWRIGHT_BROWSERS_PATH
      ? { PLAYWRIGHT_BROWSERS_PATH: localBrowsersPath }
      : {}),
    ...noMockEnvDefaults,
    VITE_API_BASE_URL: process.env.PLAYWRIGHT_FRONTEND_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? '/',
    VITE_CSRF_ENDPOINT: process.env.PLAYWRIGHT_FRONTEND_CSRF_ENDPOINT ?? process.env.VITE_CSRF_ENDPOINT ?? '',
    VITE_SKIP_OPTIONAL_WASM_COPY: 'true',
    PLAYWRIGHT_BASE_URL: baseURL,
    PLAYWRIGHT_SKIP_WEBSERVER: 'true',
    PLAYWRIGHT_MANAGED_PREVIEW: 'false',
    ...extraEnvironment,
  };
}

function runNodeScript(scriptPath, argumentsToForward, extraEnvironment = {}) {
  return new Promise((resolveExit, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath, ...argumentsToForward], {
      cwd: workspaceRoot,
      env: managedEnvironment(extraEnvironment),
      stdio: 'inherit',
    });
    let timedOut = false;
    const timeout = Number.isFinite(childTimeoutMs) && childTimeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        console.error(`Managed Playwright child exceeded ${childTimeoutMs}ms and will be stopped.`);
        childProcess.kill('SIGTERM');
        setTimeout(() => {
          if (childProcess.exitCode === null && childProcess.signalCode === null) {
            childProcess.kill('SIGKILL');
          }
        }, 2_000).unref();
      }, childTimeoutMs)
      : null;

    timeout?.unref();

    childProcess.on('exit', (code, signal) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolveExit(timedOut || signal ? 1 : code ?? 1);
    });
    childProcess.on('error', (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });
  });
}

async function runBuildStep() {
  let exitCode = await runNodeScript(vueTscCliPath, ['--noEmit']);

  if (exitCode !== 0) {
    return exitCode;
  }

  exitCode = await runNodeScript(viteCliPath, ['build', '--configLoader', 'runner']);
  return exitCode;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

function startPreviewServer() {
  const previewProcess = spawn(
    process.execPath,
    [
      viteCliPath,
      'preview',
      '--configLoader',
      'runner',
      '--host',
      previewHost,
      '--port',
      previewPort,
      '--strictPort',
    ],
    {
      cwd: workspaceRoot,
      env: managedEnvironment(),
      stdio: 'inherit',
    },
  );

  const exited = new Promise((resolveExit) => {
    previewProcess.on('exit', (code, signal) => {
      resolveExit({ code: signal ? 1 : code ?? 1, signal });
    });
  });

  return { previewProcess, exited };
}

async function waitForPreview(exited) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const earlyExit = await Promise.race([
      exited,
      delay(1).then(() => null),
    ]);

    if (earlyExit) {
      throw new Error(`Preview server exited before it was ready with code ${earlyExit.code}.`);
    }

    try {
      const response = await fetch(baseURL, { method: 'HEAD' });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Vite is still starting.
    }

    await delay(500);
  }

  throw new Error(`Preview server did not become ready at ${baseURL}.`);
}

async function stopPreview(previewProcess, exited) {
  if (previewProcess.exitCode !== null || previewProcess.signalCode !== null) {
    return;
  }

  previewProcess.kill('SIGTERM');
  const gracefulExit = await Promise.race([
    exited.then(() => true),
    delay(2_000).then(() => false),
  ]);

  if (!gracefulExit && previewProcess.exitCode === null && previewProcess.signalCode === null) {
    previewProcess.kill('SIGKILL');
    await Promise.race([
      exited,
      delay(2_000),
    ]);
  }
}

if (!scriptArgument) {
  console.error('Usage: node scripts/run-playwright-managed-preview.mjs <script> [...args]');
  process.exit(1);
}

const childScriptPath = isAbsolute(scriptArgument)
  ? scriptArgument
  : resolve(workspaceRoot, scriptArgument);

const buildExitCode = await runBuildStep();
if (buildExitCode !== 0) {
  process.exit(buildExitCode);
}

const { previewProcess, exited } = startPreviewServer();
let exitCode = 1;

try {
  await waitForPreview(exited);
  exitCode = await runNodeScript(childScriptPath, scriptArguments);
} finally {
  await stopPreview(previewProcess, exited);
}

process.exit(exitCode);
