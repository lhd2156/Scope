# Scope Release And Rollback Runbook

Use this when promoting changes from `main` to production and when deciding whether to roll back.

Related files:

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION-HARDENING.md`
- `docs/API-REFERENCE.md`
- `terraform/README.md`

## 1. Release Preconditions

Before a production deploy:

- `main` contains only the intended release commits.
- The working tree is clean.
- Relevant tests/builds passed for changed services.
- Required GitHub environment variables and secrets are present.
- Any schema, env, migration, or rollback notes are documented.

Recommended local checks by surface:

```powershell
cd Scope.Core; dotnet build Scope.Core.sln; dotnet test Scope.Core.sln
cd ..\scope_content; python manage.py check; python -m pytest
cd ..\scope_intel; python -m pytest tests
cd ..\scope-frontend; npm run build; npm run test
```

Run additional checks for changed services as needed: `scope-rag`, `scope-admin`, `scope-site`, `scope-metrics`, `scope-cli`, `scope_geo`, or `scope_media`.

## 2. Production Deploy

Production is deployed from `main` through `.github/workflows/deploy.yml`.

Current production profile:

- `terraform_environment=production`
- `terraform_profile=ec2-compose`
- canonical host: `https://scopetrips.com`

Dispatch:

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

`deploy_lightsail_app` is a legacy input name. With `terraform_profile=ec2-compose`, the workflow deploys the release bundle to the EC2 Compose host.

## 3. Post-Deploy Verification

Minimum public checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl "https://scopetrips.com" `
  -MetricsHealthUrl "https://scopetrips.com/api/metrics/health" `
  -SkipMetricsScrape
```

Also verify the release-specific user path in a browser. For frontend/UI changes, use Playwright against `https://scopetrips.com`.

Expected public health routes:

- `https://scopetrips.com/healthz`
- `https://scopetrips.com/api/core/health`
- `https://scopetrips.com/api/content/health`
- `https://scopetrips.com/api/intel/health`
- `https://scopetrips.com/api/metrics/health`

Raw `/metrics` is intentionally private from the public edge.

## 4. Rollback

Prefer the smallest safe rollback:

1. Identify whether the failure is code, config, data, or infrastructure.
2. If code caused the failure, redeploy the last known-good commit or image set.
3. If config caused the failure, restore the last known-good environment values and redeploy affected services.
4. Re-run public smoke checks and the affected browser/API path.

Database rollback requires backups and explicit restore validation. Do not manually reverse schema-affecting changes without a backup plan.

## 5. Incident Checklist

If production breaks after deploy:

- Freeze additional deploys.
- Capture failing URLs, timestamps, deploy run URL, and service logs.
- Decide between rollback and forward-fix.
- Communicate affected surface area.
- Re-run smoke checks after mitigation.
- Record the root cause and follow-up work.

## 6. Maintenance Follow-Ups

Keep these outside the emergency release path:

- Review remaining Dependabot PRs in small, tested batches.
- Rotate placeholder or temporary observability values to final production projects.
- Validate the Kubernetes profile before using it for production traffic.
- Tag releases once the release cadence is stable.
