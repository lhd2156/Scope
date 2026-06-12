import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const playwrightCliPath = resolve(workspaceRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const managedPreviewScriptPath = resolve(workspaceRoot, 'scripts', 'run-playwright-managed-preview.mjs');
const currentScriptPath = resolve(workspaceRoot, 'scripts', 'run-playwright-with-report.mjs');
const htmlReportEntryPath = resolve(workspaceRoot, 'test-results', 'html-report', 'index.html');
const stableReportPath = resolve(workspaceRoot, 'test-results', 'report.html');
const defaultGlobalTimeoutMs = 20 * 60 * 1000;
const globalTimeoutMs = Number.parseInt(
  process.env.PLAYWRIGHT_E2E_GLOBAL_TIMEOUT_MS ?? String(defaultGlobalTimeoutMs),
  10,
);

function hasOption(args, optionName) {
  return args.some((argument) => argument === optionName || argument.startsWith(`${optionName}=`));
}

function runPlaywright(argumentsToForward) {
  return new Promise((resolveExit) => {
    const normalizedArguments = [...argumentsToForward];
    if (!hasOption(normalizedArguments, '--global-timeout') && Number.isFinite(globalTimeoutMs) && globalTimeoutMs > 0) {
      normalizedArguments.push(`--global-timeout=${globalTimeoutMs}`);
    }

    const childProcess = spawn(process.execPath, [playwrightCliPath, 'test', ...normalizedArguments], {
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

function runManagedPreview(argumentsToForward) {
  return new Promise((resolveExit) => {
    const childProcess = spawn(
      process.execPath,
      [managedPreviewScriptPath, currentScriptPath, ...argumentsToForward],
      {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PLAYWRIGHT_MANAGED_PREVIEW: 'false',
        },
        stdio: 'inherit',
      },
    );

    childProcess.on('exit', (code, signal) => {
      resolveExit({ code, signal });
    });

    childProcess.on('error', (error) => {
      console.error(error);
      resolveExit({ code: 1, signal: null });
    });
  });
}

function shouldUseManagedPreview() {
  if (process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' || process.env.PLAYWRIGHT_MANAGED_PREVIEW === 'false') {
    return false;
  }

  const rawBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (!rawBaseUrl) {
    return true;
  }

  try {
    const { hostname } = new URL(rawBaseUrl);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return true;
  }
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
    <title>Scope Playwright HTML Report</title>
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
      <p>Redirecting to the Scope Playwright HTML report...</p>
      <p><a href="${relativeReportHref}">Open the report</a></p>
    </main>
  </body>
</html>
`;

  await writeFile(stableReportPath, redirectDocument, 'utf8');
}

const forwardedArguments = process.argv.slice(2);
if (shouldUseManagedPreview()) {
  const { code } = await runManagedPreview(forwardedArguments);
  process.exit(code ?? 1);
}

const { code, signal } = await runPlaywright(forwardedArguments);
await publishStableReportEntrypoint();

if (signal) {
  process.kill(process.pid, signal);
}

process.exit(code ?? 1);
