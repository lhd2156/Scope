import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const playwrightCliPath = resolve(workspaceRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const htmlReportEntryPath = resolve(workspaceRoot, 'test-results', 'html-report', 'index.html');
const stableReportPath = resolve(workspaceRoot, 'test-results', 'report.html');

function runPlaywright(argumentsToForward) {
  return new Promise((resolveExit) => {
    const childProcess = spawn(process.execPath, [playwrightCliPath, 'test', ...argumentsToForward], {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
    });

    childProcess.on('exit', (code, signal) => {
      resolveExit({ code, signal });
    });

    childProcess.on('error', (error) => {
      console.error(error);
      resolveExit({ code: 1, signal: null });
    });
  });
}

async function publishStableReportEntrypoint() {
  await mkdir(resolve(workspaceRoot, 'test-results'), { recursive: true });

  try {
    await access(htmlReportEntryPath, constants.F_OK);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      await rm(stableReportPath, { force: true });
      return;
    }

    throw error;
  }

  const relativeReportHref = './html-report/index.html';
  const redirectDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${relativeReportHref}" />
    <title>Atlas Playwright HTML Report</title>
    <style>
      :root {
        color-scheme: dark light;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Inter, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Redirecting to the Atlas Playwright HTML report…</p>
      <p><a href="${relativeReportHref}">Open the report</a></p>
    </main>
  </body>
</html>
`;

  await writeFile(stableReportPath, redirectDocument, 'utf8');
}

const forwardedArguments = process.argv.slice(2);
const { code, signal } = await runPlaywright(forwardedArguments);
await publishStableReportEntrypoint();

if (signal) {
  process.kill(process.pid, signal);
}

process.exit(code ?? 1);
