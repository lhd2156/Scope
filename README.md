# Atlas

Atlas is a real-world adventure platform where people document, discover, and plan experiences on an interactive map.

Think:

- **Instagram for real places**
- **trip planning from community data**
- **map-first social discovery**
- **AI itinerary generation layered over user-created content**

## Repository status

This repository now includes:

- the full multi-service codebase
- Docker Compose integration for local full-stack runs
- GitHub Actions CI
- GitHub Actions deploy automation for image publishing + deployment bundle artifacts
- Playwright critical-flow smoke coverage
- Kubernetes manifests
- Terraform baseline
- SQL schema + seed data assets
- deployment runbook documentation

## Architecture

Atlas is a polyglot microservice system with four app surfaces:

| Service | Stack | Directory | Responsibility |
|---|---|---|---|
| Core API | ASP.NET Core 8 / C# | `Atlas.Core/` | auth, users, friendships, notifications, live sessions |
| Content API | Django 5 / Python | `atlas_content/` | spots, trips, photos, reviews, social feed |
| Intel API | Flask 3 / Python | `atlas_intel/` | itinerary generation, recommendations, vibe matching |
| Frontend | Vue 3 / TypeScript | `atlas-frontend/` | map UX, social/product UI, trip planning flows |

Supporting infrastructure in-repo:

- SQL Server
- Kafka + Zookeeper
- Nginx reverse proxy
- Kubernetes manifests under `k8s/`
- Terraform baseline under `terraform/`

## Repository layout

```text
Atlas.Core/          Core backend (.NET)
atlas_content/       Content backend (Django)
atlas_intel/         Intelligence backend (Flask)
atlas-frontend/      Frontend (Vue + Vite)
atlas-assets/        Design tokens, icons, mockups
scripts/sql/         SQL schema + seed scripts
docs/                Deployment/integration documentation
k8s/                 Kubernetes manifests
terraform/           Terraform baseline
```

## Prerequisites

For local development:

- Docker Desktop / Docker Engine with Compose v2
- .NET SDK 8+
- Python 3.14+
- Node.js 24+
- npm 11+

## Quick start

### 1. Create local environment file

```powershell
Copy-Item .env.example .env
```

Review and replace development defaults before running anything shared.

### 2. Start the full stack

```powershell
docker compose up --build -d
```

Useful follow-up commands:

```powershell
docker compose ps
docker compose logs -f
docker compose config
```

### 3. Seed demo data

Execution order is documented in:

- `scripts/sql/README.md`

### 4. Run validation commands

#### Core

```powershell
cd Atlas.Core
dotnet build Atlas.Core.sln
dotnet test Atlas.Core.sln
```

#### Content

```powershell
cd atlas_content
python manage.py check
python -m pytest
```

#### Intel

```powershell
cd atlas_intel
python -m pytest tests
```

#### Frontend

```powershell
cd atlas-frontend
npm run build
npm run test
npm run test:e2e -- --project=chromium
```

## Browser smoke coverage

The repository includes a Playwright critical-flow smoke test covering:

1. register
2. login
3. create spot
4. view map
5. plan trip

Files:

- `atlas-frontend/playwright.config.ts`
- `atlas-frontend/tests/e2e/critical-flows.spec.ts`

## Deployment + infrastructure docs

See:

- `docs/API-REFERENCE.md` — current API route reference across Core, Content, and Intel
- `docs/DEPLOYMENT.md` — current local/staging deployment runbook
- `docs/PRODUCTION-HARDENING.md` — production hardening and readiness guidance
- `docs/RELEASE-RUNBOOK.md` — release, verification, and rollback procedure
- `scripts/smoke-test.ps1` — post-deploy edge + service + metrics smoke validation
- `scripts/sql/README.md` — schema + seed execution order
- `terraform/README.md` — Terraform baseline usage notes

## Automation in repo

### CI

- `.github/workflows/ci.yml`

Runs build/test validation for Core, Content, Intel, Frontend, and Docker Compose config.

### Deploy automation

- `.github/workflows/deploy.yml`

Publishes service images to GHCR and uploads a deployment bundle artifact on `main` or manual runs.

## Current known gaps

The repository has strong integration scaffolding, but some production-hardening work still remains:

- runtime validation of the Terraform baseline on a machine with Terraform installed
- broader production environment hardening/tuning
- final cloud-environment guidance beyond the current local/staging deployment runbook

## Working style for this repo

- PowerShell is the default shell on the primary workstation
- use semicolons (`;`) instead of `&&` for chained commands in PowerShell
- prefer small, milestone-scoped commits
- use Conventional Commits
- validate builds/tests after each meaningful change

## Related docs

- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `docs/DEPLOYMENT.md`
- `scripts/sql/README.md`

## License

No license has been declared in this repository yet.
