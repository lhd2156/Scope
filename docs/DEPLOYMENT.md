# Scope Deployment Runbook

This document captures the **current deployable shape** of Scope after the Phase 4 integration milestones that are already in the repository.

## What is deployable today

Scope can currently be launched as a **single-machine Docker Compose stack** with:

- SQL Server
- Zookeeper
- Kafka
- Core API (`Scope.Core`)
- Content API (`scope_content`)
- Intel API (`scope_intel`)
- Metrics agent (`scope-metrics`)
- Frontend (`scope-frontend`)
- Nginx reverse proxy

An **optional ops profile** is also wired for the Rust CLI toolkit (`scope-cli`) so release and smoke flows can run from the same container network.

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
- `scope-frontend/playwright.config.ts`
- `scope-frontend/tests/e2e/critical-flows.spec.ts`

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
- `GRPC_INTERNAL_TOKEN`
- `KAFKA_BOOTSTRAP_SERVERS`
- `NGINX_PORT`
- `SCOPE_METRICS_PORT`

### Observability

- `SENTRY_DSN`
- `CONTENT_SENTRY_DSN` when Content should report to a separate Sentry project
- `VITE_SENTRY_DSN`

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

When the Content service is running without S3 credentials, nginx also proxies `/media/*` back to Django so locally persisted uploads remain reachable.

- `/api/core` → Core API
- `/api/content` → Content API
- `/api/intel` → Intel API
- `/` → Frontend

### Current internal container ports

- Core: `8080`
- Content: `8000`
- Intel: `5000`
- Scope Metrics: `9090`
- Frontend: `80`
- SQL Server: `1433`
- Kafka: `9092`
- Zookeeper: `2181`

### Health endpoint available today

- Nginx: `/healthz`
- Core metrics: `http://core:8080/metrics` (in-container / in-cluster scrape target)
- Content metrics: `http://content:8000/metrics` (in-container / in-cluster scrape target)
- Intel metrics: `http://intel:5000/metrics` (in-container / in-cluster scrape target)
- Scope Metrics: `http://localhost:${SCOPE_METRICS_PORT}/healthz`
- Scope Metrics scrape: `http://localhost:${SCOPE_METRICS_PORT}/metrics`

### Optional ops CLI

Run the CLI toolkit inside the Compose network when you want a containerized health check:

```powershell
docker compose --profile ops run --rm scope-cli health --verbose
```

---

## 5. Validation steps after deployment

### Compose validation

```powershell
docker compose config
```

### Edge + metrics smoke test

Run the PowerShell smoke test against the deployment target after the stack is up.
It verifies:

- frontend root HTML
- edge `/healthz`
- `/api/core/health`
- `/api/content/health`
- `/api/intel/health`
- Scope Metrics `/healthz`
- Scope Metrics `/metrics`
- Core / Content / Intel `/metrics` when those internal endpoints are reachable from the validation network

Local example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

Remote example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -PublicBaseUrl "https://scope.example.com" `
  -MetricsBaseUrl "https://metrics.scope.example.com"
```

The script exits non-zero if any check fails, so it is safe to use in deployment verification steps.

### Seed demo data

The repository now includes idempotent SQL seed scripts under `scripts/sql/`.

Execution order and an example `sqlcmd` invocation are documented in:

- `scripts/sql/README.md`

### Frontend critical browser smoke

From `scope-frontend/`:

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
cd Scope.Core
dotnet build Scope.Core.sln
dotnet test Scope.Core.sln
```

#### Content

```powershell
cd scope_content
python manage.py check
python -m pytest
```

#### Intel

```powershell
cd scope_intel
python -m pytest tests
```

#### Frontend

```powershell
cd scope-frontend
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
- `07-edge.yaml` exposes Scope at host `scope.local` through an nginx ingress.
- `06-applications.yaml` now includes the `scope-metrics` Deployment/Service and a suspended `scope-cli-health` CronJob template that can be launched manually with `kubectl create job --from=cronjob/scope-cli-health scope-cli-health-manual -n scope`.

## 7. Terraform baseline

The repository now includes a profile-driven Terraform baseline under `terraform/`.

Default `credit-saver` profile:

- VPC + public/private subnets
- internet gateway
- S3 photo bucket
- Cognito user pool/client/domain

Optional `lightsail` profile:

- everything from `credit-saver`
- 1 Lightsail instance using the configured bundle/blueprint
- 1 static public IP
- automatic daily snapshots
- public port rules for SSH/HTTP/HTTPS
- bootstrap user data that installs Docker + Compose on the host

Optional `ec2-compose` profile:

- everything from `credit-saver`
- 1 EC2 instance using Amazon Linux 2023 by default
- encrypted gp3 root storage
- optional Elastic IP, disabled by default
- public port rules for SSH/HTTP/HTTPS
- bootstrap user data that installs Docker + Compose on the host

Optional `full` profile:

- NAT gateway
- IAM roles for EKS
- EKS cluster + default node group
- RDS SQL Server
- optional ECR repositories when `container_registry=ecr`

Reference files:

- `terraform/README.md`
- `docs/PRODUCTION-HARDENING.md`
- `docs/RELEASE-RUNBOOK.md`

> CI continues to enforce Terraform `fmt`, `init -backend=false`, and `validate`. On this workstation, `terraform fmt` was rerun for the updated config, while provider-level local `terraform validate` still depends on successful AWS provider installation plus real backend and credential wiring.

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
- optional manual single-host runtime deployment after `terraform_profile=lightsail` or `ec2-compose` + `terraform_action=apply`
- GHCR image publishing for Core, Content, Intel, Frontend, Scope Metrics, and Scope CLI on `main` / manual deploy runs
- deployment bundle artifact publishing (`docker-compose.yml`, `k8s/`, `terraform/`, docs, nginx config, SQL seed scripts, Lightsail helper scripts)
- workflow syntax and environment-driven build validation via GitHub Actions job setup
- Terraform baseline is now shipped inside the deployment artifact even though it still needs real-account `terraform plan` execution against an actual AWS target
- Prometheus scrape config for Scope Metrics plus the Core, Content, and Intel `/metrics` endpoints in Kubernetes

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
- Variable: `TF_STATE_LOCK_TABLE` (legacy only; current workflow uses S3 `use_lockfile`)
- Variable: `TF_STATE_KEY` (optional, defaults to `foundation/<environment>/terraform.tfstate`)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Variables: `CREDIT_GUARD_ADDON_MONTHLY_USD` and `CREDIT_GUARD_ADDON_NAME` when reserving budget for reviewed add-ons such as edge/CDN/sweeper work
- Secret: `TF_SQLSERVER_MASTER_PASSWORD` only when `terraform_profile = full`
- Variable: `ALLOW_FULL_PRODUCTION_INFRA=true` only when intentionally allowing the high-cost `full` profile in production
- Variable: `LIGHTSAIL_KEY_PAIR_NAME` when `terraform_profile = lightsail`
- Variable: `LIGHTSAIL_SSH_PUBLIC_KEY` when `terraform_profile = lightsail`
- Variable: `LIGHTSAIL_DYNAMIC_RUNNER_SSH` (optional; defaults to `true`) for GitHub-hosted deploys. The deploy job opens SSH only to the current runner `/32` and closes it after the upload/deploy steps.
- Variable: `LIGHTSAIL_ADMIN_IPV4_CIDRS` or `LIGHTSAIL_ADMIN_IPV6_CIDRS` when `terraform_profile = lightsail` and `deploy_lightsail_app = true` only if dynamic runner SSH is disabled
- Variable: `LIGHTSAIL_BUNDLE_ID` (optional; defaults to `medium_3_0`)
- Variable: `LIGHTSAIL_MONTHLY_ESTIMATE_USD` (optional; defaults to `24`)
- Variable: `LIGHTSAIL_DATA_DISK_SIZE_GIB` (optional; defaults to `160`; set `0` to disable the attached data disk)
- Variables: `SQLSERVER_MEMORY_LIMIT_MB`, `OLLAMA_MEM_LIMIT`, `INTEL_MEM_LIMIT`, and `RAG_MEM_LIMIT` for the medium-host runtime profile. Keep `SQLSERVER_MEMORY_LIMIT_MB` at `2048` or higher; SQL Server on Linux needs at least 2 GB to start.
- Variable: `EC2_COMPOSE_KEY_PAIR_NAME` when `terraform_profile = ec2-compose` (falls back to `LIGHTSAIL_KEY_PAIR_NAME`)
- Variable: `EC2_COMPOSE_SSH_PUBLIC_KEY` when `terraform_profile = ec2-compose` (falls back to `LIGHTSAIL_SSH_PUBLIC_KEY`)
- Variable: `EC2_COMPOSE_ADMIN_IPV4_CIDRS` when `terraform_profile = ec2-compose` and `deploy_lightsail_app = true`
- Secret: `LIGHTSAIL_SSH_PRIVATE_KEY` when `deploy_lightsail_app = true`
- Secret: `COMPOSE_HOST_SSH_PRIVATE_KEY` when `deploy_lightsail_app = true` (falls back to `LIGHTSAIL_SSH_PRIVATE_KEY`)
- Secret: `SCOPE_SA_PASSWORD` when `deploy_lightsail_app = true`
- Secret: `SCOPE_CORE_JWT_SECRET` when `deploy_lightsail_app = true`
- Secret: `SCOPE_GRPC_INTERNAL_TOKEN` or `GRPC_INTERNAL_TOKEN` when `deploy_lightsail_app = true` in production; use at least 32 random characters
- Secret: `SCOPE_DJANGO_SECRET_KEY` when `deploy_lightsail_app = true`
- Secret: `SCOPE_FLASK_SECRET_KEY` when `deploy_lightsail_app = true`
- Secrets: `SCOPE_AWS_ACCESS_KEY_ID` and `SCOPE_AWS_SECRET_ACCESS_KEY` when `terraform_profile = lightsail` and `deploy_lightsail_app = true`; use a scoped IAM user limited to the photos bucket because Lightsail cannot attach the EC2 instance profile used by `ec2-compose`
- Secret: `SCOPE_SENTRY_DSN` or `SENTRY_DSN` for production server-side Sentry coverage
- Secret: `SCOPE_CONTENT_SENTRY_DSN` or `CONTENT_SENTRY_DSN` when Content should use a separate Sentry project
- Variable: `VITE_MAPBOX_TOKEN` when `deploy_lightsail_app = true`
- Variable or secret: `VITE_SENTRY_DSN` for production browser-side Sentry coverage
- Variable: `SENTRY_DSN_MODE=temporary-placeholder` only when intentionally using temporary placeholder DSNs before rotating to real free Sentry project DSNs
- Variable: `SCOPE_PUBLIC_BASE_URL` (optional)
- Variable: `SCOPE_TLS_HOSTNAME` (optional)

Before dispatching a production single-host plan/apply, run the local GitHub readiness gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-preflight.ps1 -Environment production -TerraformProfile lightsail -DeployComposeHost
```

Use `-TerraformProfile ec2-compose -DeployComposeHost` for the EC2 fallback, or omit `-DeployComposeHost` when checking a Terraform-only foundation plan.

Then run the `Scope Deploy` workflow manually with:

- `publish_images = false` or `true` as needed
- `terraform_action = plan` to generate and upload a reviewed plan artifact, or `terraform_action = apply` to plan and then apply
- `terraform_environment = staging` or `production`
- `terraform_profile = credit-saver` for the low-cost default, `lightsail` for the preferred always-on single-box runtime, `ec2-compose` for the Terraform-managed AWS fallback while Lightsail approval is pending, or `full` for the original EKS/RDS stack
- `terraform_registry = ghcr` to skip ECR, or `ecr` if AWS-hosted repositories are required
- `deploy_lightsail_app = true` to upload the Scope runtime bundle over SSH and start the Compose stack on the freshly applied single host

The workflow renders `terraform/backend.hcl` from the configured state variables, uploads a profile-specific Terraform plan artifact, can use GitHub environment approvals to gate the apply job, and can deploy the source bundle to the selected Compose host with `scripts/lightsail/deploy-remote.sh`. Production applies and Compose-host deploys must run from `main`. Production Lightsail deploys should keep Terraform SSH ingress empty and use `LIGHTSAIL_DYNAMIC_RUNNER_SSH=true`; if that is disabled, use exact runner, VPN, or admin `/32` CIDRs. Terraform refuses world-open SSH for `production`, and the high-cost `full` profile is blocked in production unless `ALLOW_FULL_PRODUCTION_INFRA=true`.

The current production environment uses temporary Sentry placeholder DSNs so the deployment path can be exercised before the real free Sentry projects are created. Keep `SENTRY_TRACES_SAMPLE_RATE=0` and `SENTRY_PROFILES_SAMPLE_RATE=0` while placeholders are active, then rotate `SCOPE_SENTRY_DSN` and `VITE_SENTRY_DSN` to real Sentry DSNs and restore the desired sample rates.

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
- [ ] `scripts/smoke-test.ps1` passes against the deployed target
- [ ] Scope Metrics responds on `/healthz` and `/metrics`
- [ ] production secrets replace all development defaults
- [x] seed data scripts are added and documented
- [x] deploy workflow is added and reviewed
- [ ] Terraform plan/apply workflow is executed successfully against a real AWS target account with actual GitHub vars/secrets/OIDC role configuration
- [ ] Kubernetes manifests are reviewed against the target cluster and real image namespace/secrets

---

## 11. Current next integration milestones

The next lead-owned milestones after this runbook are:

1. Execute the Terraform plan workflow against a real AWS target account and tune any failing resources/quotas
2. broader production deploy workflow expansion beyond the current Lightsail + bundle rollout path
3. broader deployment documentation and release automation
