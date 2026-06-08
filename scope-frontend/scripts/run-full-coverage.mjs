import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const nodeScripts = [
  [
    resolve(workspaceRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    '--pool',
    'forks',
    '--maxWorkers=1',
    '--coverage',
    '--configLoader',
    'runner',
  ],
  [resolve(workspaceRoot, 'scripts', 'run-playwright-coverage.mjs')],
  [resolve(workspaceRoot, 'scripts', 'merge-test-coverage.mjs')],
];

for (const [scriptPath, ...argumentsToForward] of nodeScripts) {
  const exitCode = await new Promise((resolveExit, reject) => {
    const childProcess = spawn(
      process.execPath,
      [scriptPath, ...argumentsToForward],
      {
        cwd: workspaceRoot,
        env: process.env,
        stdio: 'inherit',
      },
    );

    childProcess.on('exit', (code, signal) => resolveExit(signal ? 1 : code ?? 1));
    childProcess.on('error', reject);
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
