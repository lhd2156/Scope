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
- Metrics agent (`atlas-metrics`)
- Frontend (`atlas-frontend`)
- Nginx reverse proxy

An **optional ops profile** is also wired for the Rust CLI toolkit (`atlas-cli`) so release and smoke flows can run from the same container network.

GitHub Actions CI is also in place to validate the codebase on pushes and pull requests.

## What is not finished yet

The following items are still pending lead-owned integration/infrastructure work:

- executing the Terraform plan/apply path against a real AWS target account and tuning the resulting resources
- full production environment guide for managed cloud services and environment-specific tuning

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
- `k8s/01-namespace.yaml` through `k8s/08-monitoring.yaml`
- `terraform/main.tf`, `variables.tf`, `outputs.tf`, `vpc.tf`, `iam.tf`
- GitHub environment or repository Terraform variables/secrets (for optional real-account plan/apply runs via GitHub OIDC)
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
- `ATLAS_METRICS_PORT`

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
- Atlas Metrics: `9090`
- Frontend: `80`
- SQL Server: `1433`
- Kafka: `9092`
- Zookeeper: `2181`

### Health endpoint available today

- Nginx: `/healthz`
- Atlas Metrics: `http://localhost:${ATLAS_METRICS_PORT}/healthz`
- Atlas Metrics scrape: `http://localhost:${ATLAS_METRICS_PORT}/metrics`

### Optional ops CLI

Run the CLI toolkit inside the Compose network when you want a containerized health check:

```powershell
docker compose --profile ops run --rm atlas-cli health --verbose
```

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

## 6. Kubernetes staging manifests

The repository now includes a Kubernetes manifest set under `k8s/`:

1. `01-namespace.yaml`
2. `02-configmap.yaml`
3. `03-secret.example.yaml`
4. `04-sqlserver.yaml`
5. `05-kafka.yaml`
6. `06-applications.yaml`
7. `07-edge.yaml`
8. `08-monitoring.yaml`

Suggested apply order:

```powershell
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-secret.example.yaml
kubectl apply -f k8s/04-sqlserver.yaml
kubectl apply -f k8s/05-kafka.yaml
kubectl apply -f k8s/06-applications.yaml
kubectl apply -f k8s/07-edge.yaml
kubectl apply -f k8s/08-monitoring.yaml
```

Notes:

- The manifests assume images are published to GHCR using the deploy workflow.
- Replace the placeholder image namespace `ghcr.io/replace-me/...` before applying.
- Replace all secret values from `03-secret.example.yaml` before any shared deployment.
- `07-edge.yaml` exposes Atlas at host `atlas.local` through an nginx ingress.
- `06-applications.yaml` now includes the `atlas-metrics` Deployment/Service and a suspended `atlas-cli-health` CronJob template that can be launched manually with `kubectl create job --from=cronjob/atlas-cli-health atlas-cli-health-manual -n atlas`.

## 7. Terraform baseline

The repository now includes a first-pass Terraform baseline under `terraform/` for:

- VPC + public/private subnets + NAT
- IAM roles for EKS
- EKS cluster + default node group
- RDS SQL Server
- S3 photo bucket
- Cognito user pool/client/domain
- ECR repositories for Core, Content, Intel, and Frontend

Reference files:

- `terraform/README.md`
- `docs/PRODUCTION-HARDENING.md`
- `docs/RELEASE-RUNBOOK.md`

> Terraform v1.14.8 is installed on this workstation. `terraform init -backend=false` and `terraform validate` have been run locally for both `terraform/` and `terraform/bootstrap/`, while real `terraform plan` / `terraform apply` still require the remote-state bootstrap resources, a populated backend config, and AWS credentials.

## 8. CI / deployment automation

The repository now includes:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

Current automation coverage:

- Core restore/build/test
- Content install/check/test
- Intel install/test
- Frontend install/build/test
- Kubernetes YAML syntax checks in CI
- Terraform `fmt` / `init -backend=false` / `validate` checks in CI
- optional manual Terraform plan/apply via `.github/workflows/deploy.yml` when AWS OIDC + Terraform vars/secrets are configured
- GHCR image publishing for Core, Content, Intel, Frontend, Atlas Metrics, and Atlas CLI on `main` / manual deploy runs
- deployment bundle artifact publishing (`docker-compose.yml`, `k8s/`, `terraform/`, docs, nginx config, SQL seed scripts)
- workflow syntax and environment-driven build validation via GitHub Actions job setup
- Terraform baseline is now shipped inside the deployment artifact even though it still needs real-account `terraform plan` execution against an actual AWS target

Dependabot is also configured for:

- GitHub Actions
- npm
- pip
- NuGet
- Docker

---

### Optional real-account Terraform plan / apply

The deploy workflow now supports **optional** manual Terraform plan and apply jobs backed by GitHub OIDC.

Required GitHub configuration (repository-level or environment-level for `staging` / `production`):

- Variable: `AWS_ROLE_TO_ASSUME`
- Variable: `TF_AWS_REGION` (optional, defaults to `us-east-1`)
- Variable: `TF_STATE_BUCKET`
- Variable: `TF_STATE_LOCK_TABLE`
- Variable: `TF_STATE_KEY` (optional, defaults to `foundation/<environment>/terraform.tfstate`)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Secret: `TF_SQLSERVER_MASTER_PASSWORD`

Then run the `Atlas Deploy` workflow manually with:

- `publish_images = false` or `true` as needed
- `terraform_action = plan` to generate and upload a reviewed plan artifact, or `terraform_action = apply` to plan and then apply
- `terraform_environment = staging` or `production`

The workflow renders `terraform/backend.hcl` from the configured state variables, uploads `atlas-terraform-<environment>-plan`, and can use GitHub environment approvals to gate the apply job.

## 9. Operational notes

### Auth in browser E2E

The Playwright critical-flow spec mocks `/api/core/auth/*` routes so the browser journey stays deterministic even when the real backend auth flow is unavailable.

### Mapbox

The frontend will build without a real Mapbox production token, but real map rendering requires `VITE_MAPBOX_TOKEN`.

### Kafka

Kafka is part of the stack and should be considered required for realistic integration testing.

### SQL Server

SQL Server persists data through the `sqlserver-data` Docker volume.

---

## 10. Recommended release checklist

Before calling a deployment candidate ready:

- [ ] `docker compose up --build -d` succeeds from a clean checkout
- [ ] `docker compose ps` shows healthy infra services
- [ ] Core build/test passes
- [ ] Content check/test passes
- [ ] Intel test suite passes
- [ ] Frontend build/test passes
- [ ] Playwright critical-flow smoke passes
- [ ] Atlas Metrics responds on `/healthz` and `/metrics`
- [ ] production secrets replace all development defaults
- [x] seed data scripts are added and documented
- [x] deploy workflow is added and reviewed
- [ ] Terraform plan/apply workflow is executed successfully against a real AWS target account with actual GitHub vars/secrets/OIDC role configuration
- [ ] Kubernetes manifests are reviewed against the target cluster and real image namespace/secrets

---

## 11. Current next integration milestones

The next lead-owned milestones after this runbook are:

1. Execute the Terraform plan workflow against a real AWS target account and tune any failing resources/quotas
2. production deploy workflow expansion beyond artifact/image publication and optional planning
3. broader deployment documentation and release automation
