# Scope Trips Production Certification - Phase 6 Evidence

Date: 2026-06-12

## Phase 6 Goal

Validate the highest-risk anonymous and authenticated user journeys locally and in production where safe: onboarding, auth/session restore, settings autosave, profiles/avatars, location verification, spots, Explore, map, saves, likes, reviews, comments, friends, notifications/preferences, trips, public trips, planner, AI-assisted flows, sharing, privacy, theme, tour replay, and error/empty/loading states. Verify persistence across navigation, refresh, and session boundaries. Fix only validated P0/P1 user-facing defects.

## Outcome

Phase 6 is complete. Local targeted UX/state tests, local Docker smoke, local Docker live-data write journeys, production smoke, and the full production authenticated live-data sweep all passed after the validated P0/P1 production defects were fixed and deployed.

The final production app served by `https://scopetrips.com` is the ec2-compose deployment from GitHub Actions run `27438564830`, based on app commit `3046f66`. The reproducible production-sweep harness was then pushed as test-only commit `6b86bd3`; it does not change the deployed runtime. A follow-up workflow-only cleanup, `9cef655`, opted CI/deploy JavaScript actions into Node 24 and supplied explicit throwaway AWS placeholders for compose preflight interpolation; it also does not change the deployed runtime. The final full production live sweep passed 8/8 in 5.3 minutes.

## P0/P1 Fixes Shipped

| Commit | Fix | Validation |
| --- | --- | --- |
| `846fac7` | Allowed compose host outbound TCP/80 so production deploy builds can install apt packages. | `terraform fmt -check terraform\ec2-compose.tf`; deploy run `27431234002` passed. |
| `2281f72` | Preferred compose host IAM role for photo S3 storage instead of stale Lightsail explicit keys. | `python -m pytest scope_content/photos/tests/test_s3_service_storage.py -q` passed 6/6; SSM S3 store/delete probe returned `store-ok`; deploy run `27432750078` passed. |
| `9040e06` | Prevented stale provider matches from overwriting manual spot title/location in the spot composer. | `npx vitest run tests/unit/spot-form-interactive.spec.ts tests/unit/spot-form.spec.ts --pool forks --maxWorkers=1 --configLoader runner` passed 17/17; deploy run `27433742692` passed. |
| `97854b9` | Preserved active settings drafts during profile refresh/autosave. | `npx vitest run tests/unit/settings-form.spec.ts --pool forks --maxWorkers=1 --configLoader runner` passed; deploy run `27434716641` passed. |
| `32f7dcd` | Preserved spot create/edit drafts during location refresh and stale typed-place lookups. | `npx vitest run tests/unit/spot-form-interactive.spec.ts tests/unit/spot-form.spec.ts --pool forks --maxWorkers=1 --configLoader runner` passed 19/19; `npm run build` passed; deploy run `27435612450` passed. |
| `d7a9262` | Routed `scopetrips.com/*` through the current app origin so apex no longer served stale frontend assets. | `npx wrangler deploy` published Worker version `8de5875b-fce0-42fd-bdb6-97915a4e6658`; apex served the current bundle. |
| `3046f66` | Refreshed trip planner defaults from the authoritative current profile instead of trusting stale non-empty session interests. | `npx vitest run tests/unit/trip-planner-page.spec.ts --pool forks --maxWorkers=1 --configLoader runner` passed 85/85; `npm run build` passed; deploy run `27438564830` passed. |

## Local Evidence

| Area | Command | Result |
| --- | --- | --- |
| Local browser journey sweep, Chromium | `$env:PLAYWRIGHT_WORKERS='1'; npx playwright test --project=chromium tests/e2e/auth-flow.spec.ts tests/e2e/spot-crud-flow.spec.ts tests/e2e/social-flow.spec.ts tests/e2e/notifications-flow.spec.ts tests/e2e/theme-flow.spec.ts tests/e2e/trip-flow.spec.ts tests/e2e/navigation-flow.spec.ts tests/e2e/production-data-flow.spec.ts` | Passed: 17/17 |
| Targeted UX/state unit sweep | `npx vitest run tests/unit/settings-page.spec.ts tests/unit/settings-page-qa.spec.ts tests/unit/settings-form.spec.ts tests/unit/profile-page.spec.ts tests/unit/profile-page-auth-sync.spec.ts tests/unit/profile-header.spec.ts tests/unit/onboarding-store.spec.ts tests/unit/onboarding-preferences.spec.ts tests/unit/onboarding-overlay.spec.ts tests/unit/notifications-page.spec.ts tests/unit/map-page-qa.spec.ts tests/unit/spot-detail-page-qa.spec.ts tests/unit/trip-planner-page-qa.spec.ts tests/unit/not-found-page.spec.ts tests/unit/loading-spinner.spec.ts tests/unit/skeleton-block.spec.ts --pool forks --maxWorkers=1 --configLoader runner` | Passed: 16 files, 99 tests |
| Core user route/controller contract | `dotnet test .\Scope.Core.Tests\Scope.Core.Tests.csproj --configuration Release -m:1 --filter "FullyQualifiedName~UsersControllerTests|FullyQualifiedName~CoreRouteContractTests"` | Passed: 12/12 |
| Local Docker Compose launch | `$env:OLLAMA_PORT='11435'; docker compose up -d ollama intel intel-worker rag core content-celery scope-metrics frontend admin nginx` | Stack started; port remapped because native Ollama owned `127.0.0.1:11434`. |
| Local Docker smoke | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -TimeoutSeconds 20` | Passed: 7/7 |
| Local Docker live-data write sweep | `$env:PLAYWRIGHT_BASE_URL='http://localhost:8088'; $env:PLAYWRIGHT_SKIP_WEBSERVER='true'; $env:PLAYWRIGHT_WORKERS='1'; npx playwright test --project=chromium tests/e2e/live-production-sweep.spec.ts` | Passed: 8/8 |

Local coverage included auth/session restore, onboarding, settings/profile/avatar sync, location verification, theme/tour persistence, spots, Explore/search/map/detail, saves, likes, reviews, comments, friends, notifications/preferences/push subscription paths, trips, public trips, sharing, planner, AI-assisted planner flows, and error/empty/loading states.

## Production Evidence

| Area | Command or Run | Result |
| --- | --- | --- |
| Final production deploy | GitHub Actions `Scope Deploy` run `27438564830`, `production / ec2-compose`, `publish_images=false` | Passed; compose host deploy completed. |
| Current apex bundle | `Invoke-WebRequest https://scopetrips.com/` | Served fresh bundle `assets/index-AriXpib5.js` through the Worker/app origin. |
| Production smoke after final deploy | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl https://scopetrips.com -MetricsHealthUrl https://scopetrips.com/api/metrics/health -SkipMetricsScrape -TimeoutSeconds 20` | Passed: 6/6. |
| Full production live authenticated write sweep | `$env:PLAYWRIGHT_BASE_URL='https://scopetrips.com'; $env:PLAYWRIGHT_SKIP_WEBSERVER='true'; $env:PLAYWRIGHT_WORKERS='1'; npx playwright test --project=chromium tests/e2e/live-production-sweep.spec.ts` | Passed: 8/8 in 5.3 minutes. |
| Production S3 photo storage probe | SSM into compose host content container; store/delete probe using runtime env | Passed: `store-ok`. |
| Production spot composer probe | One-off Playwright form probe after Worker route fix | Manual address/title/coordinates stayed intact through typed-place lookups and cleanup ran. |

Final production smoke:

```text
[PASS] Edge health
[PASS] Frontend route
[PASS] Core health
[PASS] Content health
[PASS] Intel health
[PASS] Scope Metrics health
Passed: 6/6
All Scope smoke checks passed.
```

Final production live sweep:

```text
8 passed (5.3m)
```

The final production sweep validated disposable UI registration and session restore, settings autosave with location/avatar readback, theme/tour replay, verified public spot creation with photo upload, Explore/search/map/detail visibility, eight verified metro spots, saves/likes/reviews/comments/profile collections, friends/presence/notifications/preferences, trip draft creation, public/private visibility, share links, anonymous shared trip access, member invites/roles, planner defaults from profile, and cleanup across Content/Core users.

## Harness-Only Adjustments

Two production-sweep harness changes were made after observing provider/runtime variability. They were not application P0/P1 fixes:

- Registration retry recovery: if the browser times out but the server created the disposable user, a retry may return `409 User already exists`; the harness now logs in with the generated disposable credentials and tracks the user for cleanup.
- Location label assertion: Mapbox may return `1502 Commerce Street, Downtown Fort Worth, USA` instead of including `TX`; the harness now accepts Fort Worth with a US/Texas region token.
- Cleanup safety preflight: the harness verifies deployed Core user deletion does not return `405` before creating disposable production accounts.

These harness updates are committed on `main` as `6b86bd3`.

## Workflow-Only Cleanup

- `9cef655` opts the CI and deploy workflows into `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- `9cef655` adds explicit throwaway `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` values for compose config preflight validation only; runtime storage credentials remain injected separately.
- Validation after this cleanup: `npx --yes yaml@2 valid .github/workflows/ci.yml .github/workflows/deploy.yml`, `git diff --check`, `Invoke-WebRequest https://scopetrips.com/`, and `Invoke-WebRequest https://scopetrips.com/healthz` all passed.

## Skipped Unsafe Cases

- The Lightsail production profile switch was not applied. GitHub Actions run `27430342258` hit the cost/destructive-plan guard: 12 add, 3 change, 11 destroy, estimated `$190.22`, so it was skipped.
- Direct production mutation through local AWS/SSH was not used. All production deploys went through the supported GitHub Actions ec2-compose path.
- Production metrics scrape was skipped in smoke tests with `-SkipMetricsScrape`; metrics health was still checked through `https://scopetrips.com/api/metrics/health`.

## Residual Risks

- The earlier content 500 for S3 upload did not appear in Sentry, which leaves an observability gap for some content-service exceptions.
- Live production E2E still depends on external providers such as Mapbox and place verification APIs; provider label/ranking changes can require harness tolerance updates.
- Cloudflare analytics beacon CSP noise was seen during read-only route checks; user-facing routes were unaffected, but analytics completeness may be reduced.
- `scopetrips.com/*` now intentionally routes through the Worker to the current app origin. This solved stale apex assets, but Phase 7 should codify the Cloudflare route/cache behavior.
- The JSON/JSONL-to-SQLite/Rust event-store idea was not part of Phase 6 because no validated P0/P1 UX failure traced to repeated log parsing. Treat it as a measured performance follow-up, not a Phase 6 completion blocker.
- The original working tree still contains earlier dirty phase changes outside this clean production chain. Production fixes above were committed and pushed from `C:\Users\every\Downloads\Scope-phase6-main`.

## Phase 6 Decision

Mark Phase 6 complete as of 2026-06-12 after final production deploy `27438564830` and final production live sweep `8 passed (5.3m)`.

## Bounded Phase 7 Objective

Harden deploy and observability reliability without broad feature work: codify Cloudflare route/cache ownership, add production freshness checks to deploys, keep GitHub Actions pins/runtime compatibility current, improve content-service Sentry/error capture, make provider-dependent production E2E fixtures more stable, preserve billing/cost guardrails, and only pursue the JSONL-to-SQLite/Rust event-store rewrite if profiling shows event-log parsing is materially affecting user-facing performance.
