# Scope

Scope is a production-deployed, map-first travel and social app for saving real places, exploring community spots, and planning trips with AI-assisted route context.

- Production app: https://scopetrips.com
- Default branch: `main`
- Production deploy path: `.github/workflows/deploy.yml` with `terraform_environment=production` and `terraform_profile=ec2-compose`

## Repository Map

| Area | Directory | Stack | Purpose |
| --- | --- | --- | --- |
| Core API | `Scope.Core/` | ASP.NET Core 8 | Auth, users, friends, notifications, live sessions |
| Content API | `scope_content/` | Django 5 | Spots, trips, photos, reviews, feed data |
| Intel API | `scope_intel/` | Flask 3 | Planning, recommendations, itinerary intelligence |
| RAG API | `scope-rag/` | Python | Chat grounding and retrieval context |
| Frontend | `scope-frontend/` | Vue 3, Vite | Public app, map, trip planning, social UI |
| Admin | `scope-admin/` | Vue 3, Vite | Operational admin UI |
| Site | `scope-site/` | Vue 3, Vite | Public web surface |
| Metrics | `scope-metrics/` | Go | Prometheus/exporter health probes |
| CLI | `scope-cli/` | Rust | Health checks, seeding, deploy validation |
| Geo/Media | `scope_geo/`, `scope_media/` | C/C++, Python | Native helpers and bindings |
| Infra | `docker-compose.yml`, `nginx/`, `k8s/`, `terraform/` | Compose, Kubernetes, Terraform | Runtime and cloud infrastructure |

## Local Quick Start

Prerequisites:

- Docker Desktop or Docker Engine with Compose v2
- .NET SDK 8+
- Python 3.14+
- Node.js 24+ and npm
- Go 1.26+ and Rust stable for metrics/CLI work

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Review `.env` before running shared or production-like environments. Never commit real secrets.

Useful local commands:

```powershell
docker compose logs -f
docker compose config
docker compose down
```

## Validation

Run the checks for the surface you changed:

| Surface | Commands |
| --- | --- |
| Core | `cd Scope.Core; dotnet build Scope.Core.sln; dotnet test Scope.Core.sln` |
| Content | `cd scope_content; python manage.py check; python -m pytest` |
| Intel | `cd scope_intel; python -m pytest tests` |
| RAG | `cd scope-rag; python -m pytest tests` |
| Frontend | `cd scope-frontend; npm run build; npm run test` |
| Frontend e2e | `cd scope-frontend; npm run test:e2e -- --project=chromium` |
| Admin | `cd scope-admin; npm run build; npm run test` |
| Site | `cd scope-site; npm run build; npm run test` |
| Metrics | `cd scope-metrics; go test ./...; go build ./cmd/scope-metrics` |
| CLI | `cd scope-cli; cargo test` |

Post-deploy smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl "https://scopetrips.com" `
  -MetricsHealthUrl "https://scopetrips.com/api/metrics/health" `
  -SkipMetricsScrape
```

## Deployment

Production releases go through GitHub Actions from `main`:

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

The deploy workflow builds the release bundle, verifies production DNS, opens temporary runner SSH to the Compose host, uploads the bundle, restarts services, and runs health checks.

## GitHub Automation

- `.github/workflows/ci.yml` runs build, test, security, infrastructure, and config checks.
- `.github/workflows/deploy.yml` handles image publishing, Terraform plan/apply, and Compose-host deployment.
- `.github/dependabot.yml` tracks current Scope services only.
- `.github/CODEOWNERS` routes security-sensitive and production config changes to the repo owner.

## Documentation

- `docs/API-REFERENCE.md` - API route reference
- `docs/DEPLOYMENT.md` - local, staging, and production deployment notes
- `docs/RELEASE-RUNBOOK.md` - release, verification, and rollback flow
- `docs/PRODUCTION-HARDENING.md` - production hardening checklist
- `docs/EDGE-ROUTE-CACHE-OWNERSHIP.md` - canonical host, cache, and CSP ownership
- `docs/SDLC.md` and `docs/SDLC-CONTROLS.md` - SDLC policy and validation matrix
- `SECURITY.md` - vulnerability reporting and security posture
- `CONTRIBUTING.md` - contribution expectations

## Working Conventions

- Keep `main` deployable.
- Use small, focused commits.
- Stage only the files in scope.
- Run the relevant validation before pushing.
- Keep generated caches, screenshots, test output, local state, and credentials out of git.

## License

No license has been declared.
