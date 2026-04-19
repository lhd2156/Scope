# Atlas frontend WASM scaffold

This directory hosts the Emscripten build for Atlas client-side spatial algorithms.

## Local prerequisites

1. Clone and install the Emscripten SDK into `atlas-frontend/emsdk/`.
2. Activate the SDK before building:

```powershell
Set-Location ..\emsdk
.\emsdk_env.ps1
Set-Location ..\wasm
```

## Build

```powershell
emcmake cmake .
emmake make
```

The build emits `dist/atlas_wasm.js` and `dist/atlas_wasm.wasm` for the upcoming typed loader in Phase 23.4.
