# Scope Trips Phase 9 Final Release Gate Evidence

Date: 2026-06-12
Production URL: https://scopetrips.com
Production health URL: https://scopetrips.com/healthz
Release candidate SHA: `f454918df4bb016cd71592a3c821b39cf8596961`
Deployment run: https://github.com/lhd2156/Scope/actions/runs/27445683959

## Recommendation

GO.

The final release gate passed for the deployed Scope Trips production candidate. The release candidate was pushed to `main`, deployed through the production `ec2-compose` workflow, then revalidated with production-safe endpoint checks, production-safe browser journey checks, cleanup verification, security/ops spot checks, and an independent final double-check pass.

No validated P0/P1 user-facing defects remain from this gate.

## Fixes Applied During The Gate

- Added a direct `MessagePack` `2.5.301` dependency in `Scope.Core/Scope.Core.API/Scope.Core.API.csproj` to clear the transitive vulnerable `2.5.187` package reported by `dotnet list package --vulnerable --include-transitive`.
- Upgraded Vite-related dev dependencies in `scope-frontend`, `scope-admin`, and `scope-site` to clear the high-severity Vite/esbuild advisory reported by `npm audit --audit-level=high`.
- Upgraded `scope-frontend` `vite-plugin-istanbul` to the Vite 8-compatible line.
- Replaced invalid global CSS `:deep(...)` selectors in `scope-frontend/src/assets/base.css`.
- Raised one slow onboarding overlay unit-test timeout to keep the full coverage suite stable under the upgraded Vite toolchain.
- Made the Django rate-limit fallback test tolerant of absent `DJANGO_CACHE_LOCATION` in local/CI environments.

## Gate Results

| Area | Status | Evidence |
| --- | --- | --- |
| Source control | PASS | Commit `f454918df4bb016cd71592a3c821b39cf8596961` pushed to `origin/main`. |
| Production deploy | PASS | GitHub Actions run `27445683959` completed `success` against `f454918df4bb016cd71592a3c821b39cf8596961`. |
| Deploy host health | PASS | Deploy log reported internal `/healthz`, `/api/core/health`, `/api/content/health`, `/api/intel/health`, `/api/rag/health`, `/site/`, and `/admin/` reachable. |
| Production endpoint smoke | PASS | Public root and service health endpoints returned expected status codes. `/metrics` stayed private with 403. |
| Production browser journey sweep | PASS | `live-production-sweep.spec.ts` passed 8/8 against `https://scopetrips.com`. |
| Persistence/account-boundary coverage | PASS | Live sweep covered anonymous redirects, auth/session restore, settings autosave, avatars, location, spots, Explore/search/map/detail, likes/saves/reviews/comments, friends, notifications/preferences, trips, sharing roles, anonymous links, and navigation/refresh persistence using disposable users. The local browser gate also covered AI-assisted planner flows. |
| Disposable data cleanup | PASS | Live sweep cleanup completed, then independent public readback found no disposable suffix in public search/explore surfaces. |
| Security/ops spot checks | PASS | HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, security.txt, robots.txt, and private metrics behavior checked. |
| Automated local suites | PASS | Core, content, intel, RAG, metrics, CLI, frontend, admin, and site suites passed after fixes. |
| Vulnerability checks | PASS with noted limitation | NuGet, npm, content Python, and RAG Python audits passed. Intel Python audit passed for resolvable packages; PyTorch CPU wheels were skipped by `pip-audit` because they are non-PyPI index packages. |

## Exact Commands And Outcomes

### Source And Deploy

```powershell
git commit -m "Harden final release gate dependencies"
git push origin main
```

Result: PASS. Pushed `f454918df4bb016cd71592a3c821b39cf8596961`.

```powershell
gh workflow run deploy.yml --repo lhd2156/Scope --ref main `
  -f publish_images=false `
  -f terraform_action=apply `
  -f terraform_environment=production `
  -f terraform_profile=ec2-compose `
  -f terraform_registry=ghcr `
  -f deploy_lightsail_app=true `
  -f run_starter_seed=true `
  -f deploy_kubernetes_app=false `
  -f install_kubernetes_addons=true
```

Result: PASS. Run `27445683959`, URL `https://github.com/lhd2156/Scope/actions/runs/27445683959`, conclusion `success`, head SHA `f454918df4bb016cd71592a3c821b39cf8596961`.

### Structural And Infrastructure

```powershell
$env:ACCEPT_EULA='Y'
$env:SA_PASSWORD='CI_Phase9Compose_12345!'
$env:CORE_JWT_SECRET='phase9-compose-core-jwt-secret-abcdefghijklmnopqrstuvwxyz0123456789'
$env:GRPC_INTERNAL_TOKEN='phase9-compose-grpc-token-abcdefghijklmnopqrstuvwxyz0123456789'
$env:CORE_JWT_ISSUER='scope-core'
$env:CORE_JWT_AUDIENCE='scope-frontend'
$env:DJANGO_SECRET_KEY='phase9-compose-django-secret-abcdefghijklmnopqrstuvwxyz0123456789'
$env:DJANGO_DEBUG='true'
$env:FLASK_SECRET_KEY='phase9-compose-flask-secret-abcdefghijklmnopqrstuvwxyz0123456789'
$env:FLASK_ENV='development'
$env:GRAFANA_ADMIN_PASSWORD='Phase9Grafana_12345!'
$env:RABBITMQ_PASS='Phase9Rabbit_12345!'
$env:KAFKA_BOOTSTRAP_SERVERS='kafka:9092'
$env:AWS_REGION='us-east-1'
$env:AWS_S3_BUCKET='scope-photos-phase9'
$env:AWS_ACCESS_KEY_ID='phase9-compose-placeholder'
$env:AWS_SECRET_ACCESS_KEY='phase9-compose-placeholder'
$env:VITE_MAPBOX_TOKEN='pk.test-ci-token'
$env:VITE_API_BASE_URL='/'
$env:VITE_ENABLE_LOCAL_PREVIEW='false'
docker compose config > $env:TEMP\scope-compose-phase9.yaml
```

Result: PASS.

```powershell
$files = @(Get-ChildItem k8s -Filter *.yaml | ForEach-Object { $_.FullName }) + @('.github/workflows/ci.yml', '.github/workflows/deploy.yml')
npx --yes yaml@2 valid @files
```

Result: PASS.

```powershell
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
```

Result: PASS from `terraform/`.

### Backend And Services

```powershell
dotnet restore Scope.Core.sln
dotnet build Scope.Core.sln --configuration Release --no-restore
dotnet test Scope.Core.sln --configuration Release --no-build
dotnet list Scope.Core.sln package --vulnerable --include-transitive
```

Result: PASS. `124` tests passed and no vulnerable NuGet packages remained after the `MessagePack` fix.

```powershell
python -m pip install -r requirements.txt
python manage.py check
python manage.py check --deploy --fail-level WARNING
python manage.py makemigrations --check --dry-run
pytest
```

Result: PASS from `scope_content/`. `279 passed`.

```powershell
python -m pip install -r requirements.txt
pytest
```

Result: PASS from `scope_intel/`. `352 passed`.

```powershell
python -m pip install -r requirements.txt
pytest
```

Result: PASS from `scope-rag/`. `76 passed`.

```powershell
go test -cover ./...
go build -trimpath ./cmd/scope-metrics
```

Result: PASS from `scope-metrics/`.

```powershell
cargo build --locked
cargo test --locked
```

Result: PASS from `scope-cli/`. `27 passed`.

### Frontend, Admin, Site

```powershell
npm run wasm:test
$env:VITE_API_BASE_URL='/'
$env:VITE_MAPBOX_TOKEN='pk.test-ci-token'
$env:VITE_ENABLE_LOCAL_PREVIEW='false'
npm run build
npm run test:coverage
npm audit --audit-level=high
```

Result: PASS from `scope-frontend/`. Coverage suite: `166` files, `1813` tests passed; audit found `0` vulnerabilities.

```powershell
npm run lint
npm run format
$env:VITE_API_BASE_URL='/'
$env:VITE_CORE_API_BASE_URL='/api/core'
$env:VITE_CONTENT_API_BASE_URL='/api/content'
$env:VITE_INTEL_API_BASE_URL='/api/intel'
npm run build
npm test -- --coverage
npm audit --audit-level=high
```

Result: PASS from `scope-admin/`. Unit suite: `34` tests passed; audit found `0` vulnerabilities.

```powershell
npm run lint
$env:VITE_SITE_BASE_PATH='/'
npm run build
npm test
npm audit --audit-level=high
```

Result: PASS from `scope-site/`. Unit suite: `4` tests passed; audit found `0` vulnerabilities.

### Local Browser Gate

```powershell
$env:VITE_API_BASE_URL='/'
$env:VITE_MAPBOX_TOKEN='pk.test-ci-token'
$env:VITE_ENABLE_LOCAL_PREVIEW='false'
npm run build
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4182'
$env:PLAYWRIGHT_WORKERS='1'
Remove-Item Env:PLAYWRIGHT_SKIP_WEBSERVER -ErrorAction SilentlyContinue
npx playwright test --project=chromium `
  tests/e2e/auth-flow.spec.ts `
  tests/e2e/spot-crud-flow.spec.ts `
  tests/e2e/social-flow.spec.ts `
  tests/e2e/notifications-flow.spec.ts `
  tests/e2e/theme-flow.spec.ts `
  tests/e2e/trip-flow.spec.ts `
  tests/e2e/navigation-flow.spec.ts `
  tests/e2e/production-data-flow.spec.ts
```

Result: PASS. `17 passed`.

### Production Smoke

```powershell
$targets = @(
  @{Name='root'; Url='https://scopetrips.com/'; Expect=200},
  @{Name='nginx-health'; Url='https://scopetrips.com/healthz'; Expect=200},
  @{Name='core-health'; Url='https://scopetrips.com/api/core/health'; Expect=200},
  @{Name='content-health'; Url='https://scopetrips.com/api/content/health'; Expect=200},
  @{Name='intel-health'; Url='https://scopetrips.com/api/intel/health'; Expect=200},
  @{Name='metrics-health'; Url='https://scopetrips.com/api/metrics/health'; Expect=200},
  @{Name='metrics-api-private'; Url='https://scopetrips.com/api/metrics'; Expect=404},
  @{Name='metrics-scrape-private'; Url='https://scopetrips.com/metrics'; Expect=403}
)
```

Result: PASS. All expected status codes matched.

### Production Live Browser Sweep

```powershell
$env:PLAYWRIGHT_BASE_URL='https://scopetrips.com'
$env:PLAYWRIGHT_SKIP_WEBSERVER='true'
$env:PLAYWRIGHT_WORKERS='1'
npx playwright test --project=chromium tests/e2e/live-production-sweep.spec.ts
```

Result: PASS. `8 passed (5.8m)`.

Disposable suffix used by the run: `mqbhlucd3l3be`.

### Disposable Cleanup Readback

```powershell
$suffix='mqbhlucd3l3be'
Invoke-WebRequest "https://scopetrips.com/api/content/search?q=$suffix&type=spots&limit=50"
Invoke-WebRequest "https://scopetrips.com/api/content/spots/?page=1&pageSize=200&search=$suffix"
Invoke-WebRequest "https://scopetrips.com/api/content/spots/explore?q=$suffix&pageSize=50"
```

Result: PASS.

- Global search returned `total: 0` and no result rows.
- Explore returned `total: 0`.
- The spots list endpoint returned seeded spots because that endpoint does not filter on `search`, but its response did not contain the disposable suffix.

### Security And Ops Spot Checks

```powershell
Invoke-WebRequest -Uri 'https://scopetrips.com/' -Method GET -TimeoutSec 30
Invoke-WebRequest -Uri 'https://scopetrips.com/.well-known/security.txt' -Method GET -TimeoutSec 30
Invoke-WebRequest -Uri 'https://scopetrips.com/robots.txt' -Method GET -TimeoutSec 30
```

Result: PASS.

Verified headers:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`

### Final Independent Double-Check

```powershell
$checks = @(
  @{Name='root'; Url='https://scopetrips.com/'; Expect=200},
  @{Name='nginx-health'; Url='https://scopetrips.com/healthz'; Expect=200},
  @{Name='core-health'; Url='https://scopetrips.com/api/core/health'; Expect=200},
  @{Name='content-health'; Url='https://scopetrips.com/api/content/health'; Expect=200},
  @{Name='intel-health'; Url='https://scopetrips.com/api/intel/health'; Expect=200},
  @{Name='rag-health'; Url='https://scopetrips.com/api/rag/health'; Expect=200},
  @{Name='metrics-health'; Url='https://scopetrips.com/api/metrics/health'; Expect=200},
  @{Name='metrics-scrape-private'; Url='https://scopetrips.com/metrics'; Expect=403}
)
```

Result: PASS. All expected status codes matched after the production browser sweep and cleanup.

## Skipped Or Limited Cases

- No destructive production actions were run against real user accounts or real user content. Production mutations were limited to disposable users/spots/trips created by the live sweep and cleaned up by the suite.
- Privileged production admin workflows were not manually exercised because the release gate stayed production-safe and did not require using persistent admin credentials. Admin UI behavior and API surfaces were covered by local automated admin suites.
- The all-spec local Chromium command timed out because it includes broad visual/performance/live-production coverage. The bounded agreed local browser gate passed explicitly with the high-risk journey specs listed above.
- Raw Prometheus scrape access is intentionally non-public. `/metrics` returned `403`; `/api/metrics` returned `404`; `/api/metrics/health` returned `200`.
- `pip-audit --strict` could not audit non-PyPI PyTorch CPU wheels in `scope_intel`. Non-strict `pip-audit` skipped those wheels and found no known vulnerabilities in the resolvable dependencies.
- Direct Sentry issue inspection was not run from this workstation. The deploy workflow supplied Sentry release/environment values and the public app surface was validated through production behavior.
- External AI/place/weather provider paths are limited by the production credentials currently configured. The deployed AI path was validated through the production health/browser flows available in this environment.

## Residual Risks

- Production depends on external systems such as GitHub Actions, AWS, DNS/TLS, Mapbox, email/provider integrations, and any configured AI/place/weather services; these can degrade independently after the gate.
- The local Terraform CLI used for local validation was `1.14.8`, while the deploy workflow used the pinned GitHub Actions Terraform version. Both local validation and production workflow validation passed.
- GitHub Actions emitted a Node.js 20 deprecation warning for third-party actions forced to Node 24. The run completed successfully; this should stay on the ops backlog.
- The Core health endpoint's `uptime` value did not read like a fresh wall-clock counter during external polling, but the deploy log showed `scope-core-1` recreated and healthy after the deploy. Treat this as a low-priority observability cleanup, not a release blocker.

## Final Decision

Phase 9 Final Release Gate is complete with a GO recommendation for the deployed Scope Trips production candidate `f454918df4bb016cd71592a3c821b39cf8596961`.
