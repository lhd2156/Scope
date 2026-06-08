import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import coverageLibrary from 'istanbul-lib-coverage';
import reportLibrary from 'istanbul-lib-report';
import sourceMapLibrary from 'istanbul-lib-source-maps';
import reports from 'istanbul-reports';

const { createCoverageMap } = coverageLibrary;
const { createContext } = reportLibrary;
const { createSourceMapStore } = sourceMapLibrary;
const workspaceRoot = resolve(import.meta.dirname, '..');
const unitCoveragePath = resolve(workspaceRoot, 'coverage', 'coverage-final.json');
const e2eCoverageDirectory = resolve(workspaceRoot, 'test-results', 'e2e-coverage');
const outputDirectory = resolve(workspaceRoot, 'coverage', 'merged');
const requiredCoveragePercent = 95;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function coverageInputPaths() {
  await access(unitCoveragePath, constants.R_OK);
  const paths = [unitCoveragePath];

  try {
    const entries = await readdir(e2eCoverageDirectory, { withFileTypes: true });
    paths.push(
      ...entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => resolve(e2eCoverageDirectory, entry.name)),
    );
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (paths.length === 1) {
    throw new Error('No Playwright coverage files were found.');
  }

  return paths;
}

function normalizeCoveragePaths(inputCoverageMap) {
  const normalizedCoverageMap = createCoverageMap({});

  for (const file of inputCoverageMap.files()) {
    const fileCoverage = inputCoverageMap.fileCoverageFor(file).toJSON();
    fileCoverage.path = fileCoverage.path.replaceAll('\\', '/');
    normalizedCoverageMap.addFileCoverage(fileCoverage);
  }

  return normalizedCoverageMap;
}

function startPosition(location) {
  return `${location.start.line}:${location.start.column}`;
}

function branchPosition(branch) {
  return [
    branch.type,
    startPosition(branch.loc),
    branch.locations.map(startPosition).join(','),
  ].join('|');
}

function overlayBrowserCoverage(canonicalCoverageMap, browserCoverageMap) {
  const canonicalFiles = new Set(canonicalCoverageMap.files());
  const mapping = {
    statements: { covered: 0, matched: 0 },
    branches: { covered: 0, matched: 0 },
    functions: { covered: 0, matched: 0 },
  };

  for (const file of browserCoverageMap.files()) {
    if (!canonicalFiles.has(file)) {
      continue;
    }

    const canonical = canonicalCoverageMap.fileCoverageFor(file);
    const browser = browserCoverageMap.fileCoverageFor(file);
    const statementByPosition = new Map(
      Object.entries(canonical.statementMap).map(([id, location]) => [
        startPosition(location),
        id,
      ]),
    );
    const functionByPosition = new Map(
      Object.entries(canonical.fnMap).map(([id, metadata]) => [
        startPosition(metadata.loc),
        id,
      ]),
    );
    const branchByPosition = new Map(
      Object.entries(canonical.branchMap).map(([id, metadata]) => [
        branchPosition(metadata),
        id,
      ]),
    );

    for (const [browserId, hits] of Object.entries(browser.s)) {
      if (hits <= 0) {
        continue;
      }

      mapping.statements.covered += 1;
      const canonicalId = statementByPosition.get(
        startPosition(browser.statementMap[browserId]),
      );
      if (canonicalId !== undefined) {
        mapping.statements.matched += 1;
        canonical.s[canonicalId] += hits;
      }
    }

    for (const [browserId, hits] of Object.entries(browser.f)) {
      if (hits <= 0) {
        continue;
      }

      mapping.functions.covered += 1;
      const canonicalId = functionByPosition.get(
        startPosition(browser.fnMap[browserId].loc),
      );
      if (canonicalId !== undefined) {
        mapping.functions.matched += 1;
        canonical.f[canonicalId] += hits;
      }
    }

    for (const [browserId, branchHits] of Object.entries(browser.b)) {
      const canonicalId = branchByPosition.get(
        branchPosition(browser.branchMap[browserId]),
      );

      for (const [branchIndex, hits] of branchHits.entries()) {
        if (hits <= 0) {
          continue;
        }

        mapping.branches.covered += 1;
        if (canonicalId !== undefined) {
          mapping.branches.matched += 1;
          canonical.b[canonicalId][branchIndex] += hits;
        }
      }
    }
  }

  for (const [metric, counts] of Object.entries(mapping)) {
    const matchRate = counts.covered === 0 ? 1 : counts.matched / counts.covered;
    if (matchRate < 0.99) {
      throw new Error(
        `Browser ${metric} source-map match rate was ${(matchRate * 100).toFixed(2)}%.`,
      );
    }
  }

  return mapping;
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const [unitPath, ...browserPaths] = await coverageInputPaths();
const coverageMap = normalizeCoveragePaths(createCoverageMap(await readJson(unitPath)));
const rawBrowserCoverageMap = createCoverageMap({});

for (const path of browserPaths) {
  rawBrowserCoverageMap.merge(await readJson(path));
}

const sourceMapStore = createSourceMapStore();
const browserCoverageMap = normalizeCoveragePaths(
  await sourceMapStore.transformCoverage(rawBrowserCoverageMap),
);
sourceMapStore.dispose();
const browserMapping = overlayBrowserCoverage(coverageMap, browserCoverageMap);
console.log('Browser coverage mapping:', browserMapping);

await writeFile(
  resolve(outputDirectory, 'coverage-final.json'),
  JSON.stringify(coverageMap.toJSON()),
  'utf8',
);

const reportContext = createContext({
  dir: outputDirectory,
  coverageMap,
});

for (const reporter of ['text-summary', 'html', 'json-summary', 'lcovonly']) {
  reports.create(reporter).execute(reportContext);
}

const summary = coverageMap.getCoverageSummary().toJSON();
const failedMetrics = [];

for (const metric of ['statements', 'branches', 'functions', 'lines']) {
  const percent = summary[metric].pct;
  if (percent < requiredCoveragePercent) {
    failedMetrics.push(`${metric}=${percent}%`);
  }
}

if (failedMetrics.length > 0) {
  throw new Error(
    `Merged coverage is below ${requiredCoveragePercent}%: ${failedMetrics.join(', ')}`,
  );
}
