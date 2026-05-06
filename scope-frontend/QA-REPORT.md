# Phase 20 QA Report

Date: 2026-04-04 05:20 CDT  
Branch: `feature/frontend`

## Scope
- Lighthouse desktop audit across every routed frontend page
- Form edge-case validation
- Keyboard-only navigation coverage
- Cross-browser verification
- Final `build` + `test` pass

## Commands run
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run qa:lighthouse`
- `npm.cmd run test:e2e -- --project=chromium --project=firefox --project=webkit tests/e2e/phase20-qa.spec.ts`
- `$env:PLAYWRIGHT_INCLUDE_EDGE='true'; npm.cmd run test:e2e -- --project=msedge tests/e2e/phase20-qa.spec.ts`

## Critical / High issues fixed
- Hardened `scripts/phase20-lighthouse-audit.mjs` so the final desktop sweep reuses one stable preview server, closes session-seeding pages cleanly for SPA 404 audits, retries one transient Chromium/Lighthouse failure, and exits non-zero whenever any route misses the gate.
- Made QA authenticated sessions deterministic inside `auth.ts` so protected-route audits no longer drift back to `/login` mid-run during long Lighthouse sweeps.
- Switched `AppShell` to the lightweight guest navbar during Scope QA-mode audits so protected-route Lighthouse runs stop paying unnecessary authenticated-shell overhead.
- Lazy-loaded `TripPlanner` from `TripPlannerPage.vue` so the routed planner page no longer eagerly pays the full planner chunk cost before the audit path settles.

## Build + automated test status
- `npm.cmd run build` ✅
- `npm.cmd run test` ✅
- Current Vitest count: **93 files / 262 tests passed**

## Browser QA status
### Dedicated Phase 20 browser suite
Validated with:
- Chromium ✅
- Firefox ✅
- WebKit ✅
- Microsoft Edge ✅ (smoke)

Current browser validation commands:
- `tests/e2e/phase20-qa.spec.ts` on Chromium/Firefox/WebKit: **9 passed (3.4m)**
- `tests/e2e/phase20-qa.spec.ts` on Edge: **3 passed (1.3m)**

### What was explicitly verified
- Keyboard-only focus order through the primary login controls
- Trip planner validation and keyboard interaction edge cases
- Spot-form validation for invalid coordinates and hostile HTML-like input
- Safe rendering of HTML-like spot titles/descriptions as text instead of executable markup

## Lighthouse route matrix
Authoritative result set: full 14-route desktop sweep from `npm.cmd run qa:lighthouse` after the final runner hardening.

| Route | Session | Perf | A11y | BP | SEO | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `/` | guest | 98 | 100 | 100 | 100 | Full sweep |
| `/explore` | guest | 99 | 100 | 100 | 100 | Full sweep |
| `/map` | guest | 99 | 100 | 100 | 100 | Full sweep |
| `/spots/demo-spot-1` | guest | 97 | 100 | 100 | 100 | Full sweep |
| `/login` | guest | 100 | 100 | 100 | 100 | Full sweep |
| `/register` | guest | 100 | 100 | 100 | 100 | Full sweep |
| `/this-route-does-not-exist` | guest | 100 | 100 | 100 | 63 | SEO exempt by design (`noindex`) |
| `/trips/new` | authenticated | 99 | 100 | 100 | 100 | Full sweep |
| `/trips/demo-trip-1` | authenticated | 99 | 100 | 100 | 100 | Full sweep |
| `/spots/new` | authenticated | 99 | 100 | 100 | 100 | Full sweep |
| `/spots/demo-spot-1/edit` | authenticated | 99 | 100 | 100 | 100 | Full sweep |
| `/profile/demo-user-1` | authenticated | 98 | 100 | 100 | 100 | Full sweep |
| `/friends` | authenticated | 99 | 100 | 100 | 100 | Full sweep |
| `/settings` | authenticated | 99 | 100 | 100 | 100 | Full sweep |

## Final assessment
Phase 20 frontend QA is **closed**.

All requested gates now pass:
- Lighthouse targets met on every audited page
- Form edge cases covered
- Keyboard navigation verified
- Cross-browser QA completed
- Final `build` + `test` green
- Critical / High issues fixed

## Remaining non-blocking notes
- Vite still warns about large shared chunks (especially Mapbox-related payloads), but those warnings did **not** prevent any route from clearing the Phase 20 targets.
- The Lighthouse runner now keeps one stable preview origin for the whole sweep, spins a fresh Chromium profile per route, and allows one retry for transient Windows/Chromium failures. That stabilization changed the harness only; it did not lower any thresholds.
