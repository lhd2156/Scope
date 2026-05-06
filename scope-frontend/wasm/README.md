# Scope frontend WASM scaffold

This directory hosts the Emscripten build for Scope client-side spatial algorithms.

## Local prerequisites

1. Clone and install the Emscripten SDK into `scope-frontend/emsdk/`.
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

The build emits `dist/scope_wasm.js` and `dist/scope_wasm.wasm` for the upcoming typed loader in Phase 23.4.

## Exported API

Current embind exports:

- `ping()`
- `getModuleInfo()`
- `calculateHaversineDistance(from, to)`
- `clusterViewportPoints(points, viewport, options)`
- `buildViewportConvexHull(points, viewport)`

### `calculateHaversineDistance(from, to)`

Accepts two plain JS coordinate objects (`id`, `latitude`/`lat`, `longitude`/`lng`) and returns `{ valid, fromId, toId, kilometers, miles, meters }` for map-side distance labels.

### `clusterViewportPoints(points, viewport, options)`

Accepts a plain JS array of point objects (`id`, `latitude`/`lat`, `longitude`/`lng`) plus a viewport object (`west`, `south`, `east`, `north`, `width`, `height`, `zoom`) and optional clustering options (`radiusPx`, `minPoints`, `includeSingles`). It returns plain JS objects representing either clustered marker groups or visible singleton points with screen-space coordinates and member ids.

### `buildViewportConvexHull(points, viewport)`

Accepts the same point array + viewport object as the clustering helper, projects only the visible points into screen space, and returns a hull summary with:

- `valid`, `pointCount`, `hullPointCount`
- centroid anchor fields (`latitude`, `longitude`, `screenX`, `screenY`)
- visible bounds (`minScreenX`, `minScreenY`, `maxScreenX`, `maxScreenY`)
- `areaSquarePx`, `perimeterPx`
- `pointIds`, `hullPointIds`, and `hull` vertex objects for future map label surfaces
