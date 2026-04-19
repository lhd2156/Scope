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

## Exported API

Current embind exports:

- `ping()`
- `getModuleInfo()`
- `clusterViewportPoints(points, viewport, options)`

`clusterViewportPoints` accepts a plain JS array of point objects (`id`, `latitude`/`lat`, `longitude`/`lng`) plus a viewport object (`west`, `south`, `east`, `north`, `width`, `height`, `zoom`) and optional clustering options (`radiusPx`, `minPoints`, `includeSingles`). It returns plain JS objects representing either clustered marker groups or visible singleton points with screen-space coordinates and member ids.
