import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const vueTscCliPath = resolve(workspaceRoot, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js');
const viteCliPath = resolve(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
process.env.VITE_SKIP_OPTIONAL_WASM_COPY = process.env.VITE_SKIP_OPTIONAL_WASM_COPY ?? 'true';

function runNodeCommand(scriptPath, argumentsToForward) {
  return new Promise((resolveExit, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath, ...argumentsToForward], {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
    });

    childProcess.on('exit', (code, signal) => {
      resolveExit({ code: signal ? 1 : code ?? 1, signal });
    });

    childProcess.on('error', reject);
  });
}

async function runBuildStep() {
  const typecheckResult = await runNodeCommand(vueTscCliPath, ['--noEmit']);

  if (typecheckResult.code !== 0) {
    process.exit(typecheckResult.code);
  }

  const buildResult = await runNodeCommand(viteCliPath, ['build', '--configLoader', 'runner']);

  if (buildResult.code !== 0) {
    process.exit(buildResult.code);
  }
}

function startPreviewServer() {
  const previewPort = process.env.PLAYWRIGHT_BASE_URL
    ? new URL(process.env.PLAYWRIGHT_BASE_URL).port || '4173'
    : '4173';
  const previewProcess = spawn(process.execPath, [viteCliPath, 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', previewPort], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });

  let shutdownSignal = null;
  const forwardSignal = (signal) => {
    shutdownSignal = signal;
    if (!previewProcess.killed) {
      previewProcess.kill(signal);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => forwardSignal(signal));
  }

  return new Promise((resolveExit, reject) => {
    previewProcess.on('exit', (code, signal) => {
      resolveExit({ code: shutdownSignal ? 0 : signal ? 1 : code ?? 1, signal: shutdownSignal ?? signal });
    });

    previewProcess.on('error', reject);
  });
}

await runBuildStep();
const previewResult = await startPreviewServer();

process.exit(previewResult.code);
