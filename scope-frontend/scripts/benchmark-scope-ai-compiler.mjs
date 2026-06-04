import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmJsPath = resolve(frontendRoot, 'wasm/dist/scope_wasm.js');
const wasmBinaryPath = resolve(frontendRoot, 'wasm/dist/scope_wasm.wasm');

const corpus = [
  ['map dallas tx zoom in', [['map_keyword', 'map'], ['zoom_direction', 'in'], ['place_span', 'dallas tx']]],
  ['zoom into Dallas Texas', [['zoom_keyword', 'zoom'], ['zoom_direction', 'in'], ['place_span', 'dallas texas']]],
  ['zoomigng into dallas tx', [['zoom_keyword', 'zooming'], ['place_span', 'dallas tx']]],
  ['center map on Tokyo Japan', [['map_control', 'center'], ['map_keyword', 'map'], ['place_span', 'tokyo japan']]],
  ['show Japan on map', [['map_control', 'show'], ['word', 'japan'], ['map_keyword', 'map']]],
  ['map Paris France zoom in', [['map_keyword', 'map'], ['place_span', 'paris france']]],
  ['zoom out', [['zoom_keyword', 'zoom'], ['zoom_direction', 'out']]],
  ['reset map', [['map_control', 'reset'], ['map_keyword', 'map']]],
  ['fit route', [['map_control', 'fit']]],
  ['zoom to route', [['zoom_keyword', 'zoom'], ['word', 'route']]],
  ['show route on map', [['map_control', 'show'], ['word', 'route'], ['map_keyword', 'map']]],
  ['mpa route fitt', [['map_keyword', 'map'], ['word', 'route'], ['map_control', 'fit']]],
  ['locate me', [['map_control', 'locate']]],
  ['switch map dark', [['map_control', 'switch'], ['map_keyword', 'map'], ['map_style', 'dark']]],
  ['swtich map drak', [['map_control', 'switch'], ['map_keyword', 'map'], ['map_style', 'dark']]],
  ['toggel map lite', [['map_control', 'toggle'], ['map_keyword', 'map'], ['map_style', 'light']]],
  ['make map light', [['map_keyword', 'map'], ['map_style', 'light']]],
  ['save this trip', [['document_action', 'save']]],
  ['share with john@example.com viewer', [['document_action', 'share'], ['email', 'john@example.com'], ['role', 'viewer']]],
  ['sahre with john@example.com viewer', [['document_action', 'share'], ['email', 'john@example.com'], ['role', 'viewer']]],
  ['invite @maya editor', [['document_action', 'invite'], ['handle', '@maya'], ['role', 'editor']]],
  ['make this public', [['document_action', 'public']]],
  ['make it privte', [['document_action', 'private']]],
  ['shre with @maya viewer and make it brite map', [['document_action', 'share'], ['handle', '@maya'], ['role', 'viewer'], ['map_style', 'bright'], ['map_keyword', 'map']]],
  ['shre with @maya viwer and make it brite map', [['document_action', 'share'], ['handle', '@maya'], ['role', 'viewer'], ['map_style', 'bright'], ['map_keyword', 'map']]],
  ['invite @maya edtor then publsh it', [['document_action', 'invite'], ['handle', '@maya'], ['role', 'editor'], ['document_action', 'publish']]],
  ['rename this trip to Tokyo food crawl', [['document_action', 'rename'], ['place_span', 'tokyo food crawl']]],
  ['call it Tokyo food crawl', [['document_action', 'call'], ['place_span', 'tokyo food crawl']]],
  ['delete trip', [['document_action', 'delete']]],
  ['confirm delete', [['document_action', 'confirm'], ['document_action', 'delete']]],
  ['cnfirm delte', [['document_action', 'confirm'], ['document_action', 'delete']]],
  ['delete destination', [['document_action', 'delete'], ['endpoint_keyword', 'destination']]],
  ['clear route', [['document_action', 'clear'], ['word', 'route']]],
  ['nvm remove start', [['document_action', 'remove'], ['endpoint_keyword', 'start']]],
  ['remvoe strt', [['document_action', 'remove'], ['endpoint_keyword', 'start']]],
];

if (!existsSync(wasmJsPath) || !existsSync(wasmBinaryPath)) {
  console.error('Compiled Scope WASM artifacts are missing. Run `npm run wasm:build` first.');
  process.exit(1);
}

const moduleFactory = await import(pathToFileURL(wasmJsPath).href).then((module) => module.default ?? module.createScopeWasmModule);
if (typeof moduleFactory !== 'function') {
  console.error('Scope WASM module did not expose an Emscripten factory.');
  process.exit(1);
}

const scopeWasm = await moduleFactory({
  locateFile(path) {
    return pathToFileURL(resolve(frontendRoot, 'wasm/dist', path)).href;
  },
});

const minAccuracyPercent = Number(process.env.SCOPE_AI_COMPILER_MIN_ACCURACY || 98);
const minCommandsPerSecond = Number(process.env.SCOPE_AI_COMPILER_MIN_COMMANDS_PER_SECOND || 20000);
let verifiedExpectations = 0;
let matchedExpectations = 0;
const failures = [];
for (const [input, expectedTokens] of corpus) {
  const tokens = Array.from(scopeWasm.lexScopeAiCommandText(input), (token) => [token.type, token.normalized]);
  for (const expectedToken of expectedTokens) {
    verifiedExpectations += 1;
    if (tokens.some(([type, normalized]) => type === expectedToken[0] && normalized === expectedToken[1])) {
      matchedExpectations += 1;
    } else {
      failures.push({
        input,
        expected: `${expectedToken[0]}:${expectedToken[1]}`,
        tokens,
      });
    }
  }
}

const iterations = 2500;
const startedAt = performance.now();
let tokenCount = 0;

for (let iteration = 0; iteration < iterations; iteration += 1) {
  for (const [input] of corpus) {
    tokenCount += Array.from(scopeWasm.lexScopeAiCommandText(input)).length;
  }
}

const elapsedMs = Math.max(1, performance.now() - startedAt);
const commandCount = corpus.length * iterations;
const commandsPerSecond = Math.round((commandCount / elapsedMs) * 1000);
const tokensPerSecond = Math.round((tokenCount / elapsedMs) * 1000);
const accuracyPercent = Number(((matchedExpectations / verifiedExpectations) * 100).toFixed(2));
const failedBudgets = [
  accuracyPercent < minAccuracyPercent
    ? `accuracy ${accuracyPercent}% is below ${minAccuracyPercent}%`
    : null,
  commandsPerSecond < minCommandsPerSecond
    ? `throughput ${commandsPerSecond.toLocaleString('en-US')} commands/sec is below ${minCommandsPerSecond.toLocaleString('en-US')}`
    : null,
].filter(Boolean);

console.log([
  failedBudgets.length ? 'Scope AI compiler benchmark failed.' : 'Scope AI compiler benchmark passed.',
  `Fixtures: ${corpus.length}`,
  `Expectations: ${matchedExpectations}/${verifiedExpectations}`,
  `Accuracy: ${accuracyPercent}% (minimum ${minAccuracyPercent}%)`,
  `Commands: ${commandCount.toLocaleString('en-US')}`,
  `Throughput: ${commandsPerSecond.toLocaleString('en-US')} commands/sec, ${tokensPerSecond.toLocaleString('en-US')} tokens/sec (minimum ${minCommandsPerSecond.toLocaleString('en-US')} commands/sec)`,
].join('\n'));

if (failures.length) {
  console.error('Missing expected tokens:');
  for (const failure of failures) {
    console.error(`- ${failure.expected} for "${failure.input}"`);
    console.error(JSON.stringify(failure.tokens, null, 2));
  }
}

if (failedBudgets.length) {
  console.error(failedBudgets.join('\n'));
  process.exit(1);
}
