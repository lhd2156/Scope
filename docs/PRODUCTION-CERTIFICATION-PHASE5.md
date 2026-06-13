# Scope Trips Production Certification - Phase 5 Evidence

Date: 2026-06-11

## Phase 5 Goal

Run the existing build/unit/integration/contract checks for each testable Scope Trips codebase with CPU-conscious settings. Record pass/fail evidence and coverage numbers, identify gaps against the 95% target, and fix only validated P0/P1 build or test blockers. Add behavior-focused tests only where they cover real production risk. End with exact evidence, remaining coverage gaps, blockers, and the bounded Phase 6 objective.

## Outcome

Phase 5 is not release-complete because `scope-frontend` merged branch coverage remains below the 95% target and one long Scope AI fuzz E2E case still times out under coverage instrumentation. All other runnable build/unit/integration/contract gates completed without a release-blocking build or test failure. No Docker stack was started and no production deploy was performed.

Behavior-focused tests were added only around validated production-risk paths: RAG startup/vectorstore/routes, Geo native/Python binding edge handling, Content/Intel service and API edges, CLI SQL/env/deploy validation branches, and frontend map/planner/itinerary/Scope AI fallback behavior.

Branch-counter follow-up was completed for the codebases where the local tooling can emit branch counters:

- Core: branch counters emitted by Coverlet and above 95%.
- Content: rerun with `coverage run --branch`; branch coverage above 95%.
- Intel: rerun with `coverage run --branch`; branch coverage above 95%.
- RAG: rerun with `coverage run --branch`; branch coverage above 95%.
- Geo: branch counters emitted by LLVM coverage and above 95%.
- CLI/Rust: stable branch coverage is unavailable; rerun with nightly `cargo llvm-cov --branch`; branch coverage above 95%.
- Frontend/Site/Admin: Vitest/Istanbul branch counters emitted. Site/Admin are above 95%; frontend merged branches remain below 95%.
- Metrics: Go `cover` emits statement coverage, not branch coverage.

CPU-conscious choices:

- Ran suites sequentially instead of in broad parallel.
- Used .NET `RunConfiguration.MaxCpuCount=1` and MSBuild `-m:1`.
- Used frontend/site/admin Vitest `--pool forks --maxWorkers=1`.
- Used Go `go test -p 1`.
- Used Cargo `CARGO_BUILD_JOBS=1` and `cargo llvm-cov --jobs 1`.
- Did not start Docker runtime services or full local container integration suites.

Generated local artifacts:

- `artifacts/phase5/core`
- `artifacts/phase5/core-filtered`
- `artifacts/phase5/content/coverage-production.xml`
- `artifacts/phase5/intel/coverage-branch.xml`
- `artifacts/phase5/rag/coverage-branch.xml`
- `artifacts/phase5/rag/coverage-current.json`
- `artifacts/phase5/geo`
- `artifacts/phase5/metrics`
- `artifacts/phase5/cli/coverage-branch.json`
- frontend/site/admin coverage outputs under each package `coverage` directory

## Exact Gate Evidence

| Area | Command | Result |
| --- | --- | --- |
| Core build/unit/contract/coverage | `dotnet test .\Scope.Core.sln --configuration Release -m:1 --settings .\coverlet.runsettings --collect:"XPlat Code Coverage" --logger "trx;LogFileName=phase5-core-filtered.trx" --results-directory ..\artifacts\phase5\core-filtered -- RunConfiguration.MaxCpuCount=1` in `Scope.Core` | Passed: 211 tests, 0 failed |
| Content unit/integration/contract/branch coverage | `python -m coverage run --branch --source=scope_content,common,spots,trips,photos,reviews,feed -m pytest -q; python -m coverage json -o coverage-production-current.json --omit="*/tests/*,*/migrations/*,*/proto/*"; python -m coverage xml -o coverage-production.xml --omit="*/tests/*,*/migrations/*,*/proto/*"; python -m coverage report --omit="*/tests/*,*/migrations/*,*/proto/*"` in `scope_content` | Passed: 291 tests, 0 failed, 161 warnings |
| Content local system check | `$env:DJANGO_SETTINGS_MODULE='scope_content.test_settings'; python manage.py check` in `scope_content` | Passed: no issues |
| Intel unit/integration/contract/branch coverage | `python -m coverage erase; python -m coverage run --branch --source=app -m pytest -q; python -m coverage json -o coverage-current.json; python -m coverage xml -o coverage.xml; python -m coverage report` in `scope_intel` | Passed: 372 tests, 0 failed, 4 warnings |
| RAG unit/integration/contract/branch coverage | `python -m coverage erase; python -m coverage run --branch --source=app -m pytest -q; python -m coverage json -o coverage-current.json; python -m coverage xml -o coverage.xml; python -m coverage report` in `scope-rag` | Passed: 85 tests, 0 failed, 7 warnings |
| Geo native/Python binding/coverage | `.\build-cov\tests\scope_geo_unit_tests.exe --gtest_output="xml:..\artifacts\phase5\geo\gtest.xml"` plus `python -m pytest -q --junitxml="..\artifacts\phase5\geo\pytest.xml"` with `SCOPE_GEO_BUILD_DIR=.\build-cov`, then `llvm-profdata merge` and `llvm-cov report` | Passed: 25 GoogleTest tests and 8 pytest tests, 0 failed |
| Metrics unit/coverage | `go test -p 1 -coverprofile ..\artifacts\phase5\metrics\coverage.out ./...` | Passed: all packages |
| CLI/Rust tests | `cargo test --locked --jobs 1` in `scope-cli` | Passed: 28 tests, 0 failed |
| CLI/Rust branch coverage | `CARGO_BUILD_JOBS=1 cargo +nightly llvm-cov --locked --branch --json --output-path ..\artifacts\phase5\cli\coverage-branch.json --jobs 1` in `scope-cli` | Passed: 28 tests, 0 failed; branch JSON emitted |
| Frontend production build | `npm run build` in `scope-frontend` | Passed |
| Frontend targeted MapView guard tests | `npx vitest run tests/unit/map-view.spec.ts --pool forks --maxWorkers=1 --configLoader runner` in `scope-frontend` | Passed: 40 tests, 0 failed |
| Frontend targeted Scope AI + Itinerary guard tests | `npx vitest run tests/unit/trip-planner-ai-assist.spec.ts tests/unit/itinerary-view.spec.ts --pool forks --maxWorkers=1 --configLoader runner` in `scope-frontend` | Passed: 244 tests, 0 failed |
| Frontend unit coverage | `npm run test:coverage` in `scope-frontend` | Passed: 168 files, 1892 tests, 0 failed |
| Frontend E2E coverage, Trips New map | `$env:PLAYWRIGHT_COVERAGE_PRESERVE='true'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4174'; npm run test:e2e:coverage -- tests/e2e/trips-new-map.spec.ts --reporter=dot` in `scope-frontend` | Passed: 13 tests, 0 failed, 6.4m; production build inside runner passed |
| Frontend E2E coverage, production button audit | `$env:PLAYWRIGHT_COVERAGE_PRESERVE='true'; npm run test:e2e:coverage -- tests/e2e/production-button-audit.spec.ts --reporter=dot` in `scope-frontend` | Passed: 2 tests, 0 failed, 17.1m; production build inside runner passed |
| Frontend E2E coverage, Scope AI matrix | `$env:PLAYWRIGHT_COVERAGE_PRESERVE='true'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4175'; npm run test:e2e:coverage -- tests/e2e/scope-ai-chat-matrix.spec.ts --reporter=dot` in `scope-frontend` | Failed: 9 passed, 1 timed out after 840000 ms (`keeps replies safe and performant across deterministic unknown-edge fuzz prompts`); production build inside runner passed |
| Frontend coverage merge | `npm run test:coverage:merge` in `scope-frontend` | Completed merge; failed threshold on frontend branch coverage only: 93.09% |
| Site production build | `npm run build` in `scope-site` | Passed |
| Site unit coverage | `npx vitest run --coverage --pool forks --maxWorkers=1` in `scope-site` | Passed: 2 files, 4 tests, 0 failed |
| Admin production build | `npm run build` in `scope-admin` | Passed |
| Admin unit coverage | `npx vitest run --coverage --pool forks --maxWorkers=1` in `scope-admin` | Passed: 7 files, 34 tests, 0 failed |
| Compose config | `docker compose config --quiet` | Passed; did not start containers |
| API Worker dry-run | `npx wrangler deploy --dry-run --config .\cloudflare\api-proxy\wrangler.toml` | Passed; upload dry-run only |
| WWW redirect Worker dry-run | `npx wrangler deploy --dry-run --config .\cloudflare\www-redirect\wrangler.toml` | Passed; upload dry-run only |
| Terraform format | `terraform -chdir=terraform fmt -check -recursive` | Passed |
| Terraform validate | `terraform -chdir=terraform validate` | Passed |
| Kubernetes YAML parse | Python YAML parse over `k8s/*.yaml` | Passed: 66 YAML documents from 11 files |
| Kubernetes client dry-run | `kubectl apply --dry-run=client -f .\k8s` | Blocked by no configured API server/OpenAPI at local `localhost:8080` |
| Production smoke | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl https://scopetrips.com -MetricsHealthUrl https://scopetrips.com/api/metrics/health -SkipMetricsScrape -TimeoutSeconds 20` | Passed: 6/6 |

Production smoke result:

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

## Coverage Evidence

| Codebase | Statements | Lines | Branches | Functions | 95% status |
| --- | ---: | ---: | ---: | ---: | --- |
| Core | n/a | 96.96% (3918/4041) | 95.40% (1493/1565) | n/a | Target met |
| Content | 98.54% (3969/4028) | n/a | 95.08% (869/914) | n/a | Target met |
| Intel | 97.92% (6406/6542) | n/a | 95.07% (1753/1844) | n/a | Target met |
| RAG | 99.46% (918/923) | n/a | 98.79% (245/248) | n/a | Target met |
| Geo | n/a | 99.09% (653/659) | 95.51% (170/178) | 100.00% (51/51) | Target met |
| Metrics | 97.20% | n/a | Not emitted by Go cover | n/a | Statement target met |
| CLI/Rust | n/a | 95.65% (1846/1930) | 98.13% (157/160) | 95.86% (162/169) | Target met |
| Frontend merged unit/E2E artifacts | 97.49% (26575/27259) | 97.62% (25536/26156) | 93.09% (21362/22947) | 97.84% (5958/6089) | Branch target below |
| Frontend unit-only | 97.01% (26446/27259) | 97.23% (25434/26156) | 92.43% (21210/22947) | 97.20% (5919/6089) | Branch target below |
| Site | 100% (71/71) | 100% (64/64) | 100% (72/72) | 100% (26/26) | Target met for instrumented files |
| Admin | 98.74% (314/318) | 98.68% (300/304) | 96.61% (228/236) | 98.91% (91/92) | Target met |

Python combined coverage after branch weighting:

- Content: 97.90% combined coverage.
- Intel: 97.29% combined coverage.
- RAG: 99.32% combined coverage.

CLI/Rust region coverage is 94.94% (2853/3005). The requested branch metric is above 95%; region coverage is recorded separately because LLVM reports it as a distinct metric.

## Coverage Gaps Against 95%

- Frontend merged branch coverage is 93.09% (21362/22947). It needs 438 additional covered branch counters to reach 95% at the current denominator.
- Largest remaining frontend branch gaps by merged artifact are:
  - `scope-frontend/src/components/map/MapView.vue`: 92.85%, 2558/2755 branches, 197 missing.
  - `scope-frontend/src/components/trips/TripPlannerAiAssist.vue`: 93.20%, 2522/2706 branches, 184 missing.
  - `scope-frontend/src/components/trips/ItineraryView.vue`: 94.34%, 1733/1837 branches, 104 missing.
  - `scope-frontend/src/views/TripPlannerPage.vue`: 92.78%, 1234/1330 branches, 96 missing.
  - `scope-frontend/src/components/trips/TripPlanner.vue`: 93.21%, 727/780 branches, 53 missing.
  - `scope-frontend/src/services/scopeAiService.ts`: 96.39%, 989/1026 branches, 37 missing.
  - `scope-frontend/src/views/MapPage.vue`: 92.43%, 415/449 branches, 34 missing.
  - `scope-frontend/src/components/common/Navbar.vue`: 94.00%, 501/533 branches, 32 missing.
- Metrics branch coverage is not available from the Go coverage tool used in this phase. Statement coverage is above target.
- Site reports 100% against its current instrumented-file set; because the suite is intentionally small, Phase 6 browser evidence should still verify real public routes and responsive behavior.

## Blockers and Non-Blockers

Validated P0/P1 build or test blockers fixed in Phase 5:

- Frontend E2E coverage harness: increased managed preview child timeout from 20 minutes to 45 minutes after the full coverage suite exceeded the parent process cap while tests were still progressing.
- Frontend production button audit harness: bounded the heavy `/trips/new` control walk under coverage instrumentation while preserving route-load/control evidence, fixing the authenticated audit timeout without hiding route crashes.
- Frontend Trip Planner render branch: removed a validated unreachable audit-preview branch nested under the non-audit right pane path.

External or configuration blockers:

- Frontend full coverage threshold remains blocked by branch coverage at 93.09%. The refreshed Trips New Map and production button audit E2E coverage evidence passed, but the merged branch counter target is still short by 438 branch counters.
- Frontend Scope AI matrix remains a test blocker under coverage instrumentation: 9/10 cases passed, but `keeps replies safe and performant across deterministic unknown-edge fuzz prompts` timed out after 840000 ms.
- Kubernetes schema/client dry-run cannot complete without a configured Kubernetes API server/OpenAPI endpoint. YAML syntax parsing passed, but schema validation remains blocked locally.
- `python manage.py check` with production Content settings correctly fails without `DJANGO_SECRET_KEY`; the no-secret local check passed with `scope_content.test_settings`.
- `cmake`, `ctest`, and `ninja` are not on PATH in this shell, so `scope_geo` was validated using the already-built instrumented `build-cov` binaries and the built pybind11 module rather than a fresh configure/build cycle.
- Stable Rust could not emit branch coverage because `cargo llvm-cov --branch` requires nightly `-Z coverage-options=branch`; nightly branch coverage succeeded.
- Windows performance counters did not expose the usual aggregate CPU counter in this shell. Process snapshots were still taken, and gates were kept sequential.

Non-blocking warnings observed:

- Content tests reported staticfiles and database override warnings.
- Intel tests reported PyTorch/Swig deprecation warnings during a training test.
- RAG tests reported FastAPI `on_event` deprecation warnings and a multipart import deprecation warning.
- Python test runs reported a pytest-asyncio default fixture loop scope deprecation warning.

## Phase 5 Decision

Phase 5 cannot be marked complete under the requested 95% everywhere standard. Strict branch coverage is above 95% for every checked codebase that can emit branch counters except `scope-frontend`; frontend merged branch coverage is 93.09%, and one Scope AI matrix E2E case still times out under coverage instrumentation.

Do not proceed to Phase 6 unless either frontend branch coverage is brought to 95% with behavior-focused tests tied to real production risk, or the 95% frontend branch gate is explicitly waived/accepted as a documented release blocker.

## Bounded Phase 6 Objective

Blocked until Phase 5 is accepted or completed. When unblocked, Phase 6 should validate the highest-risk anonymous and authenticated journeys locally and production-safe: onboarding, auth/session restore, settings autosave, profiles/avatars, location verification, spots, Explore, map, saves, likes, reviews, comments, friends, notifications/preferences, trips, public trips, planner, AI-assisted flows, sharing, privacy, theme, tour replay, and error/empty/loading states. Verify persistence across navigation, refresh, and session boundaries. Fix only validated P0/P1 user-facing defects.
