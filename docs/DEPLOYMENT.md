# Atlas Deployment Runbook

This document captures the **current deployable shape** of Atlas after the Phase 4 integration milestones that are already in the repository.

## What is deployable today

Atlas can currently be launched as a **single-machine Docker Compose stack** with:

- SQL Server
- Zookeeper
- Kafka
- Core API (`Atlas.Core`)
- Content API (`atlas_content`)
- Intel API (`atlas_intel`)
- Frontend (`atlas-frontend`)
- Nginx reverse proxy

GitHub Actions CI is also in place to validate the codebase on pushes and pull requests.

## What is not finished yet

The following items are still pending lead-owned integration/infrastructure work:

- Kubernetes manifests beyond placeholders
- Terraform infrastructure beyond placeholders
- full production environment guide for managed cloud services

Treat this runbook as the **current local/staging deployment guide**, not the final production playbook.

---

## 1. Prerequisites

### Local machine

Install:

- Docker Desktop / Docker Engine with Compose v2
- Node.js 24+
- .NET SDK 8+
- Python 3.14+

### Required repository files already present

- `docker-compose.yml`
- `nginx/nginx.conf`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `atlas-frontend/playwright.config.ts`
- `atlas-frontend/tests/e2e/critical-flows.spec.ts`

---

## 2. Environment setup

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Minimum variables that should be reviewed before launch:

### Core / shared auth

- `CORE_JWT_SECRET`
- `CORE_JWT_ISSUER`
- `CORE_JWT_AUDIENCE`
- `CORE_DB_CONNECTION`

### Django content service

- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`

### Flask intel service

- `FLASK_SECRET_KEY`
- `FLASK_DATABASE_URL`
- `CONTENT_SERVICE_URL`

### Frontend

- `VITE_API_BASE_URL`
- `VITE_MAPBOX_TOKEN`
- `VITE_CSRF_ENDPOINT`
- `VITE_ENABLE_AUTH_MOCK_FALLBACK`

### Infrastructure

- `SA_PASSWORD`
- `KAFKA_BOOTSTRAP_SERVERS`
- `NGINX_PORT`

> For local development, `.env.example` already contains safe-ish development defaults. These **must be replaced** for any shared or production-like environment.

---

## 3. Local stack launch

From the repository root:

```powershell
docker compose up --build -d
```

Check service state:

```powershell
docker compose ps
```

Check merged config:

```powershell
docker compose config
```

Stream logs if something fails:

```powershell
docker compose logs -f
```

Stop the stack:

```powershell
docker compose down
```

Stop and remove volumes too:

```powershell
docker compose down -v
```

---

## 4. Service topology

### Public entrypoint

Nginx is the public edge service.

Default public URL:

- `http://localhost:${NGINX_PORT}`

### Reverse-proxied API routes

- `/api/core` → Core API
- `/api/content` → Content API
- `/api/intel` → Intel API
- `/` → Frontend

### Current internal container ports

- Core: `8080`
- Content: `8000`
- Intel: `5000`
- Frontend: `80`
- SQL Server: `1433`
- Kafka: `9092`
- Zookeeper: `2181`

### Health endpoint available today

- Nginx: `/healthz`

---

## 5. Validation steps after deployment

### Compose validation

```powershell
docker compose config
```

### Seed demo data

The repository now includes idempotent SQL seed scripts under `scripts/sql/`.

Execution order and an example `sqlcmd` invocation are documented in:

- `scripts/sql/README.md`

### Frontend critical browser smoke

From `atlas-frontend/`:

```powershell
npm run test:e2e -- --project=chromium
```

This currently validates the critical flow:

1. register
2. login
3. create spot
4. view map
5. plan trip

### Service-level validation

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
```

---

## 6. CI pipeline

The repository now includes:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

Current automation coverage:

- Core restore/build/test
- Content install/check/test
- Intel install/test
- Frontend install/build/test
- GHCR image publishing for Core, Content, Intel, and Frontend on `main` / manual deploy runs
- deployment bundle artifact publishing (`docker-compose.yml`, docs, nginx config, SQL seed scripts)
- workflow syntax and environment-driven build validation via GitHub Actions job setup

Dependabot is also configured for:

- GitHub Actions
- npm
- pip
- NuGet
- Docker

---

## 7. Operational notes

### Auth in browser E2E

The Playwright critical-flow spec mocks `/api/core/auth/*` routes so the browser journey stays deterministic even when the real backend auth flow is unavailable.

### Mapbox

The frontend will build without a real Mapbox production token, but real map rendering requires `VITE_MAPBOX_TOKEN`.

### Kafka

Kafka is part of the stack and should be considered required for realistic integration testing.

### SQL Server

SQL Server persists data through the `sqlserver-data` Docker volume.

---

## 8. Recommended release checklist

Before calling a deployment candidate ready:

- [ ] `docker compose up --build -d` succeeds from a clean checkout
- [ ] `docker compose ps` shows healthy infra services
- [ ] Core build/test passes
- [ ] Content check/test passes
- [ ] Intel test suite passes
- [ ] Frontend build/test passes
- [ ] Playwright critical-flow smoke passes
- [ ] production secrets replace all development defaults
- [ ] seed data scripts are added and documented
- [ ] deploy workflow is added and reviewed
- [ ] k8s / terraform placeholders are replaced with real manifests

---

## 9. Current next integration milestones

The next lead-owned milestones after this runbook are:

1. seed data scripts
2. production/deploy workflow
3. Kubernetes manifests
4. Terraform infrastructure
5. broader deployment documentation and release automation
