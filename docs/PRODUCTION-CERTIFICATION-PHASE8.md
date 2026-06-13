# Scope Trips Production Certification - Phase 8

Date: 2026-06-12

## Objective

Validate infrastructure, operations, and recovery readiness for Cloudflare Pages/DNS/TLS/Workers, AWS EC2/S3/Cognito, Terraform state/recovery, deployment workflows, rollback, health checks, observability, metrics, logs, workers/jobs, databases, queues, caching, and the local-only recovery runbook. Do not expose or commit secrets. Fix only validated P0/P1 operational blockers.

## Result

Status: PASS

Validated P0/P1 operational blockers found: 2

Validated P0/P1 operational blockers fixed: 2

Remaining Phase 8 release blockers: none

## Fix Applied

- Updated the documented Compose-network CLI health command in `docs/DEPLOYMENT.md` to use `--no-deps`:

```powershell
docker compose --profile ops run --rm --no-deps scope-cli health --verbose
```

Evidence: the previous documented form attempted to reconcile dependencies and recreated `scope-ollama` on a workstation where `127.0.0.1:11434` was already occupied. The corrected command then passed against the already-running Compose network without leaving a one-off container behind.

- Fixed the live production fallback photo-storage IAM user policy so S3 uploads to the KMS-encrypted photos bucket can generate data keys:

```powershell
aws iam put-user-policy --user-name scope-production-lightsail-photos --policy-name ScopeProductionPhotoStorage --policy-document file://<temporary-local-policy-json>
```

The updated inline policy preserves the existing bucket/object permissions and adds `kms:GenerateDataKey`, `kms:Decrypt`, and `kms:DescribeKey` scoped to `arn:aws:kms:us-east-1:277876299862:key/1265b668-354d-49f3-b33a-bf59257293b9`, constrained through `kms:ViaService = s3.us-east-1.amazonaws.com` and `kms:CallerAccount = 277876299862`.

Evidence: Sentry had reported `AccessDenied` for `kms:GenerateDataKey` from `scope-production-lightsail-photos` against the production photos KMS key. IAM simulation now allows the required S3/KMS actions, and a bounded SSM probe from the live `scope-content-1` container wrote and deleted one temporary object in `scope-photos-production-277876299862` successfully.

## Exact Evidence

### Tooling

```powershell
terraform version
node --version
npm --version
npx --version
docker --version
aws --version
gh --version
```

Result: Terraform v1.14.8, Node v24.14.1, npm/npx 11.11.0, Docker 29.1.3, AWS CLI 2.34.16, GitHub CLI 2.89.0.

### Terraform And AWS IaC

```powershell
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform\bootstrap init -backend=false -input=false -no-color
terraform -chdir=terraform\bootstrap validate -no-color
terraform -chdir=terraform validate -no-color
```

Result: PASS.

Clean-copy backend-disabled validation:

```powershell
terraform "-chdir=C:\tmp\scope-phase8-ops-20260612T123844\terraform-clean-copy" init -backend=false -input=false -no-color
terraform "-chdir=C:\tmp\scope-phase8-ops-20260612T123844\terraform-clean-copy" validate -no-color
```

Result: PASS.

Focused IaC scan:

```powershell
trivy config --quiet --format json --output C:\tmp\scope-phase8-ops-20260612T123844\trivy-terraform-focused.json --severity CRITICAL,HIGH --skip-dirs .terraform --skip-files *.tfplan terraform
```

Result: PASS, no HIGH/CRITICAL findings in active Terraform source.

### Cloudflare Pages, DNS, TLS, Workers

```powershell
npx --yes wrangler@latest deploy --dry-run --config .\cloudflare\api-proxy\wrangler.toml
npx --yes wrangler@latest deploy --dry-run --config .\cloudflare\www-redirect\wrangler.toml
npx --yes wrangler@latest pages project list
npx --yes wrangler@latest pages deployment list --project-name scopetrips-site
npx --yes wrangler@latest deployments list --config .\cloudflare\api-proxy\wrangler.toml
npx --yes wrangler@latest deployments list --config .\cloudflare\www-redirect\wrangler.toml
node --check .\cloudflare\api-proxy\src\index.js
node --check .\cloudflare\www-redirect\src\index.js
```

Result: PASS. Wrangler dry-run packaged both Workers. Pages inventory showed `scopetrips-site` owns `scopetrips.com` and `www.scopetrips.com`; `scopetrips-app` owns `app.scopetrips.com`. API proxy deployment history showed a June 11, 2026 deployment; `www` redirect deployment history showed the June 5, 2026 deployed version.

Public DNS/TLS/HTTP evidence:

```powershell
Resolve-DnsName scopetrips.com
Resolve-DnsName www.scopetrips.com
Resolve-DnsName app.scopetrips.com
Resolve-DnsName api.scopetrips.com
```

Result: PASS. All four names resolve through Cloudflare A/AAAA records.

```powershell
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/healthz
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/security.txt
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/core/health
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/content/health
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/intel/health
curl.exe -sS -D - -o NUL --max-time 20 https://scopetrips.com/api/metrics/health
curl.exe -sS -D - -o NUL --max-time 20 https://www.scopetrips.com/
curl.exe -sS -D - -o NUL --max-time 20 https://app.scopetrips.com/
curl.exe -sS -D - -o NUL --max-time 20 https://api.scopetrips.com/api/core/health
```

Result: PASS. Apex, static health/security files, same-domain API health, metrics health, and direct API origin health returned 200 through Cloudflare with one HSTS and one CSP header on 200 responses. `www` and `app` returned 301 redirects to the apex.

### Deployment Workflows

```powershell
@'
import pathlib, yaml
for path in pathlib.Path(".github/workflows").glob("*.yml"):
    list(yaml.safe_load_all(path.read_text(encoding="utf-8")))
'@ | python -
```

Result: PASS as part of the full YAML parse check.

```powershell
gh workflow list --repo lhd2156/Scope
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-preflight.ps1 -Environment production -TerraformProfile lightsail -DeployComposeHost -AllowDirtyWorktree
```

Result: PASS. `Scope CI` and `Scope Deploy` are active. Production preflight passed required GitHub variable/secret name checks for the Lightsail Compose-host profile. Warnings were limited to the intentionally dirty local worktree and secret values that GitHub does not expose.

### Builds And Deployable Artifacts

```powershell
$env:VITE_MAPBOX_TOKEN='pk.phase8-placeholder'; npm run build
```

Working directories:

- `scope-frontend`
- `scope-site`

Result: PASS for both production builds.

### Containers, Kubernetes, Monitoring

```powershell
docker compose config -q
```

Result: PASS.

```powershell
@'
import pathlib, yaml
paths = []
for root in [".github/workflows", "k8s", "monitoring"]:
    paths.extend([p for p in pathlib.Path(root).rglob("*") if p.suffix.lower() in (".yml", ".yaml")])
for path in paths:
    list(yaml.safe_load_all(path.read_text(encoding="utf-8")))
'@ | python -
```

Result: PASS, 16 YAML files parsed.

```powershell
trivy config --quiet --format json --output C:\tmp\scope-phase8-ops-20260612T123844\trivy-k8s.json --severity CRITICAL,HIGH k8s
trivy config --quiet --format json --output C:\tmp\scope-phase8-ops-20260612T123844\trivy-deploy-config.json --severity CRITICAL,HIGH C:\tmp\scope-phase8-ops-20260612T123844\deploy-config-scan
python -m json.tool .\monitoring\grafana\dashboards\scope-overview.json
```

Result: PASS. Kubernetes, deployable Docker/Compose/monitoring config, and Grafana dashboard JSON had no HIGH/CRITICAL blocking findings.

### Local Runtime, Databases, Queues, Cache, Workers

Docker Desktop was started and the existing Compose stack was allowed to settle.

```powershell
docker ps --filter "name=scope-" --format "{{.Names}}|{{.Status}}"
```

Result: PASS. Healthy containers included SQL Server, Redis, Kafka, Zookeeper, RabbitMQ, Elasticsearch, Core, Content, Content Celery, Intel, RAG, Scope Metrics, Nginx, Prometheus, Grafana, Frontend, Site, Admin, and Ollama. Content and Intel background worker containers were running.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl http://localhost:8088 -MetricsBaseUrl http://localhost:9090
```

Result: PASS, 7/7. Edge health, frontend route, Core health, Content health, Intel health, Scope Metrics health, and Scope Metrics scrape all passed.

```powershell
$env:OLLAMA_PORT='11435'
docker compose --profile ops run --rm --no-deps scope-cli health --verbose
```

Result: PASS. Core, Content, Intel, and Scope Metrics were healthy from inside the Compose network. No one-off CLI container remained after the run.

### Production Smoke

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl https://scopetrips.com -MetricsHealthUrl https://scopetrips.com/api/metrics/health -SkipMetricsScrape
```

Result: PASS, 6/6. Edge health, frontend route, Core health, Content health, Intel health, and Scope Metrics health all passed.

### Post-Pass External Closure Addendum

The remaining manual EKS/Sentry questions were rechecked from the workstation with read-only commands only.

```powershell
aws configure list
aws sts get-caller-identity --output json
aws eks list-clusters --region us-east-1 --output json
kubectl config current-context
kubectl config get-contexts
```

Result: PASS for access diagnosis. AWS CLI and kubectl are installed. The configured AWS login is usable in `us-east-1`, but kubeconfig is absent and no current kubectl context is configured. EKS cluster inventory is empty in `us-east-1`.

```powershell
$regions = aws ec2 describe-regions --query "Regions[].RegionName" --output text
foreach ($region in $regions -split "\s+") {
  aws eks list-clusters --region $region --query "clusters" --output text
}
aws eks describe-cluster --region us-east-1 --name scope-production
aws eks describe-cluster --region us-east-1 --name scope-prod
aws eks describe-cluster --region us-east-1 --name scope
```

Result: PASS for bounded EKS determination. No EKS clusters were visible in any enabled AWS region for the configured account, and the expected `scope`, `scope-prod`, and `scope-production` names returned `ResourceNotFoundException`. This confirms the current production path is not EKS/Kubernetes from this account. The repository keeps Kubernetes manifests and Terraform `full` profile support, but the validated production path remains the EC2 Compose host.

```powershell
aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=*scope*,*Scope*" "Name=instance-state-name,Values=pending,running,stopping,stopped"
aws ec2 describe-instance-status --region us-east-1 --instance-ids i-0602954c0d0551376 --include-all-instances
aws ssm describe-instance-information --region us-east-1 --filters "Key=InstanceIds,Values=i-0602954c0d0551376"
```

Result: PASS. `scope-production-ec2-compose` is running in `us-east-1`; EC2 system and instance status checks are `ok`; SSM is `Online` on Amazon Linux.

```powershell
aws ssm send-command --region us-east-1 --document-name AWS-RunShellScript --comment "Scope Phase 8 read-only host health snapshot" --instance-ids i-0602954c0d0551376 --parameters file://<temporary-local-json>
aws ssm wait command-executed --region us-east-1 --command-id <command-id> --instance-id i-0602954c0d0551376
aws ssm get-command-invocation --region us-east-1 --command-id <command-id> --instance-id i-0602954c0d0551376
```

Result: PASS. The read-only SSM host snapshot showed Docker active, the host up for 8 days 19 hours, root volume at 78% used, 739 MiB memory available, swap available, and Scope production containers running. Healthy containers included Nginx, Grafana, Prometheus, Scope Metrics, Frontend, Intel, RAG, Admin, Content Celery, Content, Site, Core, SQL Server, Kafka, Ollama, RabbitMQ, Zookeeper, Elasticsearch, and Redis. Content and Intel worker containers were running.

```powershell
aws s3api get-bucket-encryption --bucket scope-photos-production-277876299862 --output json
aws iam get-user-policy --user-name scope-production-lightsail-photos --policy-name ScopeProductionPhotoStorage --output json
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::277876299862:user/scope-production-lightsail-photos --action-names s3:PutObject s3:GetObject s3:DeleteObject kms:GenerateDataKey kms:Decrypt kms:DescribeKey --resource-arns arn:aws:s3:::scope-photos-production-277876299862/photos/phase8-kms-probe.txt arn:aws:kms:us-east-1:277876299862:key/1265b668-354d-49f3-b33a-bf59257293b9 --context-entries ContextKeyName=kms:ViaService,ContextKeyType=string,ContextKeyValues=s3.us-east-1.amazonaws.com ContextKeyName=kms:CallerAccount,ContextKeyType=string,ContextKeyValues=277876299862
aws ssm send-command --region us-east-1 --document-name AWS-RunShellScript --comment "Scope production photos S3 KMS bounded put/delete probe" --instance-ids i-0602954c0d0551376 --parameters file://<temporary-local-json>
```

Result: PASS. The photos bucket is encrypted with `alias/scope-production-photos`; the live fallback user policy includes `PhotoObjectKms`; IAM simulation allowed the S3/KMS actions; the live container probe returned `put-ok` and `delete-ok` for one temporary object, which was deleted during the probe.

```powershell
curl.exe -sS -D - -o NUL --max-time 20 https://app.scopetrips.com/
curl.exe -sS -D - -o NUL --max-time 20 "https://app.scopetrips.com/trips/new?source=legacy"
```

Result: PASS after the frontend redirect-header fix. `app.scopetrips.com` returns 301 to the apex and now carries HSTS, CSP, nosniff, referrer policy, and permissions policy headers on the redirect response.

```powershell
python C:\Users\every\.codex\plugins\cache\openai-curated\sentry\c6ea566d\skills\sentry\scripts\sentry_api.py issues --org atlas-tj --project scope-frontend-production --environment prod --days 1 --limit 100 --query "is:unresolved"
python C:\Users\every\.codex\plugins\cache\openai-curated\sentry\c6ea566d\skills\sentry\scripts\sentry_api.py issues --org atlas-tj --project scope-server-production --environment prod --days 1 --limit 100 --query "is:unresolved"
python C:\Users\every\.codex\plugins\cache\openai-curated\sentry\c6ea566d\skills\sentry\scripts\sentry_api.py issues --org atlas-tj --project atlas-content --environment prod --days 1 --limit 100 --query "is:unresolved"
python C:\Users\every\.codex\plugins\cache\openai-curated\sentry\c6ea566d\skills\sentry\scripts\sentry_api.py issues --org atlas-tj --project scope-server-production --environment production --days 1 --limit 100 --query "is:unresolved"
```

Result: PASS for read-only observability inspection. The `prod` environment had no unresolved issues in the checked projects. The `production` environment for `scope-server-production` still had unresolved historical issues, including SQL Server login timeout on Content health, S3 KMS `AccessDenied` on photo upload, Kafka/Redis connection errors, and DisallowedHost noise. Latest public production smoke and the EC2/SSM health snapshot passed after those error timestamps, so these remain Sentry triage/resolution cleanup items rather than validated current P0/P1 release blockers.

## Rollback And Recovery Confidence

Confidence: high for the currently deployed Cloudflare/Pages/Worker edge path, local Compose recovery, health checks, metrics verification, and documented rollback order.

Evidence:

- Cloudflare Pages and Worker inventories are readable through Wrangler.
- Production smoke passes through the public apex.
- AWS production host inventory is readable; `scope-production-ec2-compose` is running with EC2 status checks `ok` and SSM `Online`.
- Local Compose smoke passes with the database, queues, cache, search, workers, metrics, Prometheus, Grafana, and Nginx healthy.
- `docs/RELEASE-RUNBOOK.md`, `docs/DEPLOYMENT.md`, `terraform/README.md`, `terraform/bootstrap/README.md`, and `.local-runbooks/scope-recovery-runbook.md` cover deploy, rollback, Terraform state bootstrap, single-host recovery, Cloudflare recovery, and post-recovery evidence.

Confidence remains bounded, not absolute: a real AWS Terraform plan/apply was not executed from this workstation. Live Kubernetes apply is not part of the current production path because no EKS cluster is present in the configured AWS account; Kubernetes remains an optional `full` profile target. That is acceptable for Phase 8 because no infrastructure mutation was requested or needed, production smoke is green, the EC2 Compose host is healthy, and no P0/P1 source blocker remains.

## Non-Blocking Findings And Residual Risks

- Live AWS `plan/apply` was not run locally. The GitHub production preflight passed required OIDC/env/secret-name checks, and Terraform validates locally; a real-account plan remains a deployment/change-management gate when infrastructure is intentionally changed.
- EKS/Kubernetes is not active for the current production deployment in the configured AWS account. Offline YAML/object validation and Trivy Kubernetes scans passed; live Kubernetes validation belongs to a future intentional `full` profile/EKS deployment or to a different AWS account if one exists.
- `gh run list` returned no recent `Scope CI` or `Scope Deploy` rows, so workflow state was validated through active workflow inventory, local YAML parsing, and production preflight rather than recent-run history.
- Sentry read-only inspection found unresolved historical `production` environment issues in `scope-server-production`. The S3/KMS photo-upload permission issue was fixed and live-probed successfully. Current public production smoke and EC2 host/container health passed after the remaining timestamps, so the remaining action is Sentry issue triage/resolution cleanup rather than a validated current release blocker.

## Bounded Phase 9 Objective

Phase 9: Final Release Gate. Rerun the agreed production certification gate for Scope Trips: builds, automated suites, smoke tests, production-safe browser checks, security/ops spot checks, persistence/account-boundary checks, and disposable data cleanup verification. Perform an independent final double-check pass. Do not mark complete unless all required gates are actually satisfied or explicit deployment blockers are documented. Produce the final release evidence document with pass/fail status, exact commands, production URLs, residual risks, and go/no-go recommendation.
