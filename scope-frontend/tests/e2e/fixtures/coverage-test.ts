import { expect, test as base, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import coverageLibrary, { type CoverageMapData } from 'istanbul-lib-coverage';

const { createCoverageMap } = coverageLibrary;

const COVERAGE_CAPTURE_INTERVAL_MS = Number.parseInt(
  process.env.PLAYWRIGHT_COVERAGE_CAPTURE_INTERVAL_MS ?? '120000',
  10,
);
const COVERAGE_OUTPUT_DIRECTORY = resolve(process.cwd(), 'test-results', 'e2e-coverage');

type CoverageGlobal = typeof globalThis & {
  __coverage__?: CoverageMapData;
  __scopePublishCoverage?: (coverage: CoverageMapData) => Promise<void>;
};

function coverageFileName(testInfo: TestInfo): string {
  const stableId = `${testInfo.project.name}-${testInfo.testId}-${testInfo.retry}`;
  return `${stableId.replace(/[^A-Za-z0-9_.-]+/g, '-')}.json`;
}

export const test = base.extend<{ browserCoverage: void }>({
  browserCoverage: [async ({ page }, use, testInfo) => {
    if (process.env.PLAYWRIGHT_COVERAGE !== 'true') {
      await use();
      return;
    }

    const coverageMap = createCoverageMap({});
    let captureInFlight = false;

    const mergeCoverage = (coverage: CoverageMapData | null | undefined): void => {
      if (coverage) {
        coverageMap.merge(coverage);
      }
    };

    const captureCoverage = async (): Promise<void> => {
      if (captureInFlight || page.isClosed()) {
        return;
      }

      captureInFlight = true;
      try {
        const coverage = await page.evaluate(
          () => (globalThis as CoverageGlobal).__coverage__ ?? null,
        );
        mergeCoverage(coverage);
      } catch {
        // A navigation may destroy the execution context while a snapshot is in flight.
      } finally {
        captureInFlight = false;
      }
    };

    await page.exposeFunction('__scopePublishCoverage', async (coverage: CoverageMapData) => {
      mergeCoverage(coverage);
    });
    await page.addInitScript(() => {
      const publishCoverage = (): void => {
        const coverageGlobal = globalThis as CoverageGlobal;
        if (coverageGlobal.__coverage__ && coverageGlobal.__scopePublishCoverage) {
          void coverageGlobal.__scopePublishCoverage(coverageGlobal.__coverage__);
        }
      };

      globalThis.addEventListener('pagehide', publishCoverage);
      globalThis.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          publishCoverage();
        }
      });
    });

    const captureTimer = Number.isFinite(COVERAGE_CAPTURE_INTERVAL_MS) && COVERAGE_CAPTURE_INTERVAL_MS > 0
      ? setInterval(() => {
        void captureCoverage();
      }, COVERAGE_CAPTURE_INTERVAL_MS)
      : null;

    try {
      await use();
    } finally {
      if (captureTimer) {
        clearInterval(captureTimer);
      }
      await captureCoverage();

      if (coverageMap.files().length > 0) {
        await mkdir(COVERAGE_OUTPUT_DIRECTORY, { recursive: true });
        await writeFile(
          resolve(COVERAGE_OUTPUT_DIRECTORY, coverageFileName(testInfo)),
          JSON.stringify(coverageMap.toJSON()),
          'utf8',
        );
      }
    }
  }, { auto: true }],
});

export { expect };
