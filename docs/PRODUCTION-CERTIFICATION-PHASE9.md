# Scope Trips Production Certification - Phase 9

Run timestamp: 2026-06-12T22:53:03-05:00 / 2026-06-13T03:53:03Z

Repository state:

- Branch: `App/coverage-complete`
- HEAD: `ea6a97c7011d2deeee28decfacc48a1f00cbd990`
- Worktree: dirty before this phase; no unrelated changes were reverted.

## Objective

Final Release Gate for the current Scope Trips production shape: rerun builds, automated suites, smoke tests, production-safe browser checks, security and ops spot checks, persistence/account-boundary checks, and disposable data cleanup verification. Produce a go/no-go call with residual risks.

## Production Scope

Current release scope is the EC2 Compose production runtime behind Cloudflare:

- Public app: `https://scopetrips.com`
- Browser API: `https://scopetrips.com/api/*`
- AWS account observed by CLI: `277876299862`
- Region: `us-east-1`
- Production host: `scope-production-ec2-compose`, instance `i-0602954c0d0551376`

EKS is not active in this AWS account for this release scope. `aws eks list-clusters --region us-east-1` returned no clusters, and the configured production host is the SSM-online EC2 Compose instance.

## Gate Results

### Public Production Smoke

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl "https://scopetrips.com" -MetricsHealthUrl "https://scopetrips.com/api/metrics/health" -SkipMetricsScrape -TimeoutSeconds 20
```

Result: PASS, 6/6. Edge health, frontend route, Core health, Content health, Intel health, and Scope Metrics health passed. Security header checks passed.

### AWS Host Health

Commands:

```powershell
aws ec2 describe-instance-status --region us-east-1 --instance-ids i-0602954c0d0551376 --include-all-instances
aws ssm describe-instance-information --region us-east-1 --filters "Key=InstanceIds,Values=i-0602954c0d0551376"
aws ssm send-command --region us-east-1 --document-name AWS-RunShellScript --comment "Scope Phase 9 read-only host snapshot" --instance-ids i-0602954c0d0551376 --parameters file://<temporary-local-json>
```

Result: PASS. EC2 instance state was `running`, system status `ok`, instance status `ok`, and SSM ping status `Online`.

Read-only host snapshot:

- Host time: `Sat Jun 13 03:28:52 UTC 2026`
- Uptime: 8 days, 20 hours
- Root volume: 62 GiB used of 80 GiB, 78 percent used
- Memory: 774 MiB available
- Swap: 3830 MiB available
- Docker: active
- Running expected containers: Nginx, Frontend, Site, Admin, Core, Content, Content Celery, Content Worker, Intel, Intel Worker, RAG, Scope Metrics, Prometheus, Grafana, SQL Server, Kafka, Zookeeper, RabbitMQ, Redis, Elasticsearch, and Ollama.

### Redirect And Header Spot Checks

Commands:

```powershell
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/.well-known/security.txt
curl.exe -sS -D - -o NUL --max-time 20 "https://app.scopetrips.com/trips/new?source=phase9"
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/core/health
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/content/health
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/intel/health
```

Result: PASS. `security.txt` returned 200. `app.scopetrips.com` redirected to the apex with security headers. Core, Content, and Intel health routes returned 200 with single canonical security headers.

### Automated Build And Test Gates

Commands and results:

```powershell
cd Scope.Core
dotnet build Scope.Core.sln
dotnet test Scope.Core.sln --no-build
```

Result: PASS. Build succeeded with 0 warnings and 0 errors. Tests passed: 216/216.

```powershell
cd scope_content
$env:DJANGO_SETTINGS_MODULE='scope_content.test_settings'
python manage.py check
python -m pytest -q
```

Result: PASS. Django check found no issues. Tests passed: 301/301.

Note: the production-shaped `python manage.py check` command without a settings override correctly refuses to boot without production environment variables. The certification test run used the repository test settings.

```powershell
cd scope_intel
python -m pytest -q tests
```

Result: PASS. Tests passed: 372/372.

```powershell
cd scope-rag
python -m pytest -q
```

Result: PASS. Tests passed: 87/87.

```powershell
cd scope-metrics
go test ./...
```

Result: PASS. All Go packages passed.

```powershell
cd scope-cli
cargo test
```

Result: PASS. Tests passed: 28/28.

```powershell
cd scope-frontend
npm run build
npm run test
```

Result: PASS. Production build completed. Unit tests passed: 1995/1995 across 172 files.

```powershell
cd scope-site
npm run build
npm run test
```

Result: PASS. Production build completed. Tests passed: 4/4 across 2 files. Coverage reported 100 percent statements, branches, functions, and lines.

```powershell
cd scope-admin
npm run build
npm run test
```

Result: PASS. Production build completed. Tests passed: 34/34 across 7 files.

### Local Runtime And Compose Gates

Commands:

```powershell
docker compose config
docker compose ps
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl http://localhost:8088 -MetricsBaseUrl http://localhost:9090 -TimeoutSeconds 20
$env:OLLAMA_PORT='11435'
docker compose --profile ops run --rm --no-deps scope-cli health --verbose
```

Result: PASS. Compose config rendered, the local stack showed expected containers up and healthy where healthchecks are defined, local smoke passed 7/7, and `scope-cli health --verbose` reported Core, Content, Intel, and Scope Metrics healthy from inside the Compose network.

### Terraform And Config Validation

Commands:

```powershell
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform init -backend=false -input=false
terraform -chdir=terraform validate
terraform -chdir=terraform\bootstrap fmt -check -recursive
terraform -chdir=terraform\bootstrap init -backend=false -input=false
terraform -chdir=terraform\bootstrap validate
```

Result: PASS. Main and bootstrap Terraform formatted and validated. The main stack validate used an isolated temporary `TF_DATA_DIR` to avoid a cached S3 backend credential lookup and performed local configuration validation only.

No live Terraform plan or apply was run during Phase 9.

### Security Config Spot Checks

Commands:

```powershell
trivy config --severity CRITICAL,HIGH k8s
trivy config --severity CRITICAL,HIGH <temporary-deploy-config-copy>
```

Result: PASS. Kubernetes manifests reported 0 HIGH/CRITICAL misconfigurations. Deploy Dockerfiles scanned from the temporary deploy-config copy reported 0 HIGH/CRITICAL misconfigurations.

### Production Browser And Persistence Sweep

Command:

```powershell
cd scope-frontend
$env:PLAYWRIGHT_BASE_URL='https://scopetrips.com'
$env:PLAYWRIGHT_SKIP_WEBSERVER='true'
$env:PLAYWRIGHT_WORKERS='1'
npx playwright test tests/e2e/live-production-sweep.spec.ts --project=chromium --reporter=list
```

Result: PASS. 8/8 production browser tests passed in Chromium.

Coverage included:

- Auth/session redirects, refresh persistence, logout, settings, and profile preferences.
- Settings autosave, avatar behavior, theme state, and tour state.
- Public spot creation through the UI, verification, explore/search/map/detail visibility across users.
- Eight verified metro spot seeds across multiple cities.
- Reviews, pinned profile, wishlist profile, and quick navigation using live data.
- Friends, online status, user profiles, and notifications across live multi-user state.
- Trip creation, share invite validation, role behavior, anonymous share links, and back navigation.

The sweep created disposable live users, spots, trips, comments, friendships, and notifications, then completed its cleanup path in `afterAll`.

## External Observability

Sentry was previously checked read-only in Phase 8 using local access:

- Org: `atlas-tj`
- Projects checked: `scope-frontend-production`, `scope-server-production`, `atlas-content`
- `prod` environment: no unresolved issues found in the checked projects.
- `production` environment for `scope-server-production`: unresolved historical issues remain, including SQL login timeout, old S3 KMS access, Kafka/Redis connection errors, and DisallowedHost noise.

Current production smoke, host health, and live browser sweep all passed after those issue timestamps. These are documented as observability cleanup and triage, not validated current P0/P1 blockers.

## Residual Risks

- The local worktree is dirty. Do not treat a new deployment from this workstation as controlled until release scope is reviewed, committed, and deployed through the intended path.
- Live Terraform plan/apply was not executed during Phase 9. Terraform was validated locally only.
- EKS/Kubernetes is not active in the configured AWS account. Kubernetes remains an optional future `full` profile target, not the validated production runtime.
- Sentry still has historical unresolved `production` environment issues in `scope-server-production`; current production evidence does not reproduce them as active release blockers.
- The production host root volume is at 78 percent used. This is not an immediate blocker, but should stay on the ops watchlist.

## Go / No-Go

Recommendation: GO for the current EC2 Compose production release scope.

Reasoning: all Phase 9 release gates that apply to the current production shape passed: public smoke, AWS host health, local automated suites, local Compose smoke, Terraform validation, security config spot checks, and the live production browser persistence/account-boundary sweep with disposable-data cleanup.

Condition: HOLD any additional production deployment from the current local dirty worktree until the intended release changes are reviewed, committed, and pushed through the normal deployment path.
