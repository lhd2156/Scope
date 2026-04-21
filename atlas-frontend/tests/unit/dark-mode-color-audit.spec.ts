import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const testsDirectory = dirname(currentFilePath);
const frontendRoot = resolve(testsDirectory, '..', '..');
const srcRoot = resolve(frontendRoot, 'src');
const auditedExtensions = new Set(['.css', '.svg', '.ts', '.vue']);
const hardcodedHexPattern = /#[0-9A-Fa-f]{3,8}\b/g;

function listAuditedFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = resolve(directoryPath, entryName);
    const entryStats = statSync(entryPath);

    if (entryStats.isDirectory()) {
      return listAuditedFiles(entryPath);
    }

    return auditedExtensions.has(extname(entryPath)) ? [entryPath] : [];
  });
}

describe('dark mode color audit', () => {
  it('keeps hardcoded hex values out of atlas-frontend/src', () => {
    const filesWithHardcodedHex = listAuditedFiles(srcRoot)
      .map((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        const matches = source.match(hardcodedHexPattern) ?? [];
        return matches.length
          ? {
              filePath: relative(frontendRoot, filePath).replace(/\\/g, '/'),
              matches,
            }
          : null;
      })
      .filter((entry): entry is { filePath: string; matches: string[] } => entry !== null);

    expect(filesWithHardcodedHex).toEqual([]);
  });

  it('loads palette tokens from the shared design-tokens source of truth', () => {
    const runtimeTokens = readFileSync(resolve(srcRoot, 'assets/tokens.css'), 'utf8');
    const seoUtils = readFileSync(resolve(srcRoot, 'utils/seo.ts'), 'utf8');

    expect(runtimeTokens).toContain("@import '../../../atlas-assets/design-tokens.css';");
    expect(seoUtils).toContain("const THEME_COLOR_VARIABLE = '--bg-primary';");
    expect(seoUtils).toContain("getComputedStyle(document.documentElement)");
    expect(seoUtils).not.toMatch(hardcodedHexPattern);
  });
});
