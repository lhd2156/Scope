import { rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const playwrightCliPath = resolve(workspaceRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const e2eDirectory = resolve(workspaceRoot, 'tests', 'e2e');
const e2eCoverageDirectory = resolve(workspaceRoot, 'test-results', 'e2e-coverage');
const coverageArtifactDirectory = resolve(workspaceRoot, 'test-results', 'playwright-coverage-artifacts');
const forwardedArguments = process.argv.slice(2);
const defaultSpecTimeoutMs = 20 * 60 * 1000;
const specTimeoutMs = Number.parseInt(
  process.env.PLAYWRIGHT_COVERAGE_SPEC_TIMEOUT_MS ?? String(defaultSpecTimeoutMs),
  10,
);
const preserveExistingCoverage = process.env.PLAYWRIGHT_COVERAGE_PRESERVE === 'true';

async function defaultTestFiles() {
  const entries = await readdir(e2eDirectory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.spec.ts') &&
        entry.name !== 'live-production-sweep.spec.ts',
    )
    .map((entry) => `tests/e2e/${entry.name}`)
    .sort();
}

function hasOption(args, optionName) {
  return args.some((argument) => argument === optionName || argument.startsWith(`${optionName}=`));
}

function withCoverageDefaults(args) {
  const normalizedArgs = [...args];
  if (!hasOption(normalizedArgs, '--project')) {
    normalizedArgs.push('--project=chromium');
  }
  if (!hasOption(normalizedArgs, '--workers')) {
    normalizedArgs.push('--workers=1');
  }
  if (!hasOption(normalizedArgs, '--global-timeout')) {
    normalizedArgs.push(`--global-timeout=${specTimeoutMs}`);
  }
  return normalizedArgs;
}

function buildRunLabel(args) {
  const testFile = args.find((argument) => argument.endsWith('.spec.ts'));
  const source = testFile ?? `targeted-${Date.now()}`;
  return source
    .replace(/^tests[\\/]e2e[\\/]/, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '-');
}

async function runPlaywright(args) {
  const normalizedArgs = withCoverageDefaults(args);
  if (!hasOption(normalizedArgs, '--output')) {
    normalizedArgs.push(`--output=${resolve(coverageArtifactDirectory, buildRunLabel(normalizedArgs))}`);
  }

  const childProcess = spawn(
    process.execPath,
    [playwrightCliPath, 'test', ...normalizedArgs],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        VITE_COVERAGE: 'true',
        PLAYWRIGHT_COVERAGE: 'true',
      },
      stdio: 'inherit',
    },
  );

  return new Promise((resolveExit, reject) => {
    childProcess.on('exit', (code, signal) => resolveExit(signal ? 1 : code ?? 1));
    childProcess.on('error', reject);
  });
}

if (!preserveExistingCoverage) {
  await Promise.all([
    rm(e2eCoverageDirectory, { recursive: true, force: true }),
    rm(coverageArtifactDirectory, { recursive: true, force: true }),
  ]);
}

if (forwardedArguments.length > 0) {
  process.exit(await runPlaywright(forwardedArguments));
}

const failedSpecs = [];
for (const testFile of await defaultTestFiles()) {
  console.log(`\n[coverage] Running ${testFile}`);
  const exitCode = await runPlaywright([testFile]);
  if (exitCode !== 0) {
    failedSpecs.push(testFile);
  }
}

if (failedSpecs.length > 0) {
  console.error(`\n[coverage] ${failedSpecs.length} spec file(s) failed:`);
  for (const testFile of failedSpecs) {
    console.error(`- ${testFile}`);
  }
  process.exit(1);
}

console.log('\n[coverage] All instrumented E2E spec files passed.');
