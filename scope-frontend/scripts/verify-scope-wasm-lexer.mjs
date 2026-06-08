import { closeSync, openSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmDistRoot = resolve(frontendRoot, 'wasm/dist');
const wasmArtifactCandidates = [
  ['scope_wasm.js', 'scope_wasm.wasm'],
  ['scope_wasm.generated.js', 'scope_wasm.generated.wasm'],
];

const corpus = [
  {
    input: 'map dallas tx zoom in',
    expected: [
      ['map_keyword', 'map'],
      ['zoom_keyword', 'zoom'],
      ['zoom_direction', 'in'],
      ['place_span', 'dallas tx'],
    ],
  },
  {
    input: 'switch map dark',
    expected: [
      ['map_control', 'switch'],
      ['map_keyword', 'map'],
      ['map_style', 'dark'],
    ],
  },
  {
    input: 'share with john@example.com viewer and delete destination',
    expected: [
      ['document_action', 'share'],
      ['email', 'john@example.com'],
      ['role', 'viewer'],
      ['document_action', 'delete'],
      ['endpoint_keyword', 'destination'],
    ],
  },
  {
    input: 'nvm remove start then invite @maya editor',
    expected: [
      ['document_action', 'remove'],
      ['endpoint_keyword', 'start'],
      ['document_action', 'invite'],
      ['handle', '@maya'],
      ['role', 'editor'],
    ],
  },
  {
    input: 'rename this trip to Tokyo food crawl',
    expected: [
      ['document_action', 'rename'],
      ['word', 'tokyo'],
      ['place_span', 'tokyo food crawl'],
    ],
  },
  {
    input: 'zoomigng into dallas tx and remvoe strt',
    expected: [
      ['zoom_keyword', 'zooming'],
      ['place_span', 'dallas tx'],
      ['document_action', 'remove'],
      ['endpoint_keyword', 'start'],
    ],
  },
  {
    input: 'map Paris France zoom in',
    expected: [
      ['map_keyword', 'map'],
      ['zoom_keyword', 'zoom'],
      ['zoom_direction', 'in'],
      ['place_span', 'paris france'],
    ],
  },
  {
    input: 'show Japan on map',
    expected: [
      ['map_control', 'show'],
      ['word', 'japan'],
      ['map_keyword', 'map'],
    ],
  },
  {
    input: 'sahre with john@example.com viewer then make it privte',
    expected: [
      ['document_action', 'share'],
      ['email', 'john@example.com'],
      ['role', 'viewer'],
      ['document_action', 'private'],
    ],
  },
  {
    input: 'delte destination but do not delete trip',
    expected: [
      ['document_action', 'delete'],
      ['endpoint_keyword', 'destination'],
    ],
  },
  {
    input: 'call it Tokyo food crawl',
    expected: [
      ['document_action', 'call'],
      ['word', 'tokyo'],
      ['place_span', 'tokyo food crawl'],
    ],
  },
  {
    input: 'fit route then lokate me',
    expected: [
      ['map_control', 'fit'],
      ['map_control', 'locate'],
    ],
  },
  {
    input: 'mpa route fitt then cnfirm delte',
    expected: [
      ['map_keyword', 'map'],
      ['word', 'route'],
      ['map_control', 'fit'],
      ['document_action', 'confirm'],
      ['document_action', 'delete'],
    ],
  },
  {
    input: 'shre with @maya viewer and make it brite map',
    expected: [
      ['document_action', 'share'],
      ['handle', '@maya'],
      ['role', 'viewer'],
      ['map_style', 'bright'],
      ['map_keyword', 'map'],
    ],
  },
  {
    input: 'swtich map drak and shre with @maya viwer',
    expected: [
      ['map_control', 'switch'],
      ['map_keyword', 'map'],
      ['map_style', 'dark'],
      ['document_action', 'share'],
      ['handle', '@maya'],
      ['role', 'viewer'],
    ],
  },
  {
    input: 'toggel map lite then invite @maya edtor',
    expected: [
      ['map_control', 'toggle'],
      ['map_keyword', 'map'],
      ['map_style', 'light'],
      ['document_action', 'invite'],
      ['handle', '@maya'],
      ['role', 'editor'],
    ],
  },
];

function isReadableFile(filePath) {
  try {
    const descriptor = openSync(filePath, 'r');
    closeSync(descriptor);
    return true;
  } catch {
    return false;
  }
}

const wasmArtifacts = wasmArtifactCandidates
  .map(([moduleFileName, binaryFileName]) => ({
    moduleFileName,
    modulePath: resolve(wasmDistRoot, moduleFileName),
    binaryPath: resolve(wasmDistRoot, binaryFileName),
  }))
  .find((candidate) => isReadableFile(candidate.modulePath) && isReadableFile(candidate.binaryPath));

if (!wasmArtifacts) {
  console.error('Compiled Scope WASM artifacts are missing. Run `npm run wasm:build` first.');
  process.exit(1);
}

const moduleSource = readFileSync(wasmArtifacts.modulePath, 'utf8');
if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(moduleSource)) {
  console.error('Scope WASM glue contains dynamic JavaScript execution and is not compatible with the production CSP.');
  process.exit(1);
}

const moduleFactory = await import(pathToFileURL(wasmArtifacts.modulePath).href).then((module) => module.default ?? module.createScopeWasmModule);
if (typeof moduleFactory !== 'function') {
  console.error('Scope WASM module did not expose an Emscripten factory.');
  process.exit(1);
}

const scopeWasm = await moduleFactory({
  locateFile(path) {
    return pathToFileURL(resolve(wasmDistRoot, path)).href;
  },
});

for (const { input, expected } of corpus) {
  const tokens = Array.from(scopeWasm.lexScopeAiCommandText(input), (token) => [token.type, token.normalized]);
  for (const expectedToken of expected) {
    if (!tokens.some(([type, normalized]) => type === expectedToken[0] && normalized === expectedToken[1])) {
      console.error(`Missing token ${expectedToken[0]}:${expectedToken[1]} for "${input}".`);
      console.error(JSON.stringify(tokens, null, 2));
      process.exit(1);
    }
  }
}

console.log(`Scope WASM lexer verified against ${corpus.length} command fixtures.`);
