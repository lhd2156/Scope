# Scope frontend WASM scaffold

This directory hosts the Emscripten build for Scope client-side spatial algorithms.

## Local prerequisites

1. Clone and install the Emscripten SDK into `scope-frontend/emsdk/`.
2. The `npm run wasm:build` script activates the local SDK for the command it runs.

## Build

```powershell
npm run wasm:build
```

The build emits `wasm/dist/scope_wasm.js` and `wasm/dist/scope_wasm.wasm`.
It compiles with dynamic JavaScript execution disabled so the module remains
compatible with the production Content Security Policy. Run `npm run wasm:test`
after building to verify both the native Scope AI lexer corpus and the CSP-safe
JavaScript glue.

## Exported API

Current embind exports:

- `ping()`
- `getModuleInfo()`
- `calculateHaversineDistance(from, to)`
- `clusterViewportPoints(points, viewport, options)`
- `buildViewportConvexHull(points, viewport)`
- `lexScopeAiCommandText(input)`

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

### `lexScopeAiCommandText(input)`

Accepts a normalized Scope AI command string and returns compiler-style tokens for app-owned planner commands:
map controls, zoom direction, document actions, visibility, sharing, invite recipients, endpoint keywords, roles, email/handle tokens, and place-like spans. TypeScript remains the semantic parser and safety/action layer.
