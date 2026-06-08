import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmRoot = resolve(frontendRoot, 'wasm');
const wasmDistRoot = resolve(wasmRoot, 'dist');
const emscriptenTempRoot = resolve(frontendRoot, '.tmp/emscripten');
const emsdkRoot = resolve(frontendRoot, 'emsdk');
const isWindows = process.platform === 'win32';
const emsdkEnv = resolve(emsdkRoot, isWindows ? 'emsdk_env.bat' : 'emsdk_env.sh');

const hasLocalEmsdk = existsSync(emsdkEnv);

mkdirSync(wasmDistRoot, { recursive: true });
mkdirSync(emscriptenTempRoot, { recursive: true });

const sourcePath = resolve(wasmRoot, 'src/scope_wasm.cpp');
const primaryOutputPath = resolve(wasmDistRoot, 'scope_wasm.js');
const fallbackOutputPath = resolve(wasmDistRoot, 'scope_wasm.generated.js');
const canOverwriteOutput = (filePath) => {
  if (!existsSync(filePath)) {
    return true;
  }

  try {
    const descriptor = openSync(filePath, 'r+');
    closeSync(descriptor);
    return true;
  } catch {
    return false;
  }
};
const outputPath = canOverwriteOutput(primaryOutputPath) ? primaryOutputPath : fallbackOutputPath;
if (outputPath !== primaryOutputPath) {
  console.warn(`Primary Scope WASM artifact is not writable; writing ${outputPath} instead.`);
}
const commandPath = (value) => isWindows ? value : `"${value}"`;
const compileCommand = [
  'em++',
  commandPath(sourcePath),
  '-O3',
  '-Wall',
  '-Wextra',
  '-Wpedantic',
  '-std=c++20',
  '--bind',
  '-sWASM=1',
  '-sMODULARIZE=1',
  '-sEXPORT_ES6=1',
  '-sEXPORT_NAME=createScopeWasmModule',
  '-sENVIRONMENT=web,worker,node',
  '-sALLOW_MEMORY_GROWTH=1',
  '-sDYNAMIC_EXECUTION=0',
  '-sFILESYSTEM=0',
  '-sINITIAL_MEMORY=16777216',
  '-sASSERTIONS=1',
  '-sEXPORTED_RUNTIME_METHODS=[]',
  '-o',
  commandPath(outputPath),
].join(' ');
const chainedCommand = hasLocalEmsdk
  ? (
      isWindows
        ? `set "EMSDK_QUIET=1" && call ${emsdkEnv} >nul && ${compileCommand}`
        : `export EMSDK_QUIET=1 && . "${emsdkEnv}" >/dev/null && ${compileCommand}`
    )
  : compileCommand;

const result = spawnSync(isWindows ? 'cmd.exe' : 'bash', isWindows ? ['/d', '/c', chainedCommand] : ['-lc', chainedCommand], {
  cwd: frontendRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    EM_NODE_JS: process.env.EM_NODE_JS || process.execPath,
    EMCC_TEMP_DIR: process.env.EMCC_TEMP_DIR || emscriptenTempRoot,
  },
});

process.exit(result.status ?? 1);
