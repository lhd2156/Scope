import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const vueTscCliPath = resolve(workspaceRoot, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js');
const viteCliPath = resolve(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');

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

  const buildResult = await runNodeCommand(viteCliPath, ['build']);

  if (buildResult.code !== 0) {
    process.exit(buildResult.code);
  }
}

function startPreviewServer() {
  const previewProcess = spawn(process.execPath, [viteCliPath, 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!previewProcess.killed) {
      previewProcess.kill(signal);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => forwardSignal(signal));
  }

  return new Promise((resolveExit, reject) => {
    previewProcess.on('exit', (code, signal) => {
      resolveExit({ code: signal ? 1 : code ?? 1, signal });
    });

    previewProcess.on('error', reject);
  });
}

await runBuildStep();
const previewResult = await startPreviewServer();

if (previewResult.signal) {
  process.kill(process.pid, previewResult.signal);
}

process.exit(previewResult.code);
