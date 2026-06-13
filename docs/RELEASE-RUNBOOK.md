# Scope Release & Rollback Runbook

This runbook describes how to prepare, deploy, verify, and roll back an Scope release.

Use it alongside:

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION-HARDENING.md`
- `docs/API-REFERENCE.md`
- `terraform/README.md`

## Scope

This is the operational release guide for the repository as it exists today.

It assumes:

- app services are already buildable/testable
- CI and deploy workflows exist
- Kubernetes manifests and Terraform baseline are in repo
- deployment bundle artifacts can be produced

It does **not** assume that Terraform has already been executed against a real AWS account from this workstation.

---

## 1. Release prerequisites

Before a release candidate is approved:

- [ ] `main` contains the intended release commits only
- [ ] CI is green (`.github/workflows/ci.yml`)
- [ ] deploy automation is green or ready to run (`.github/workflows/deploy.yml`)
- [ ] Docker Compose config still renders successfully
- [ ] frontend critical-flow Playwright smoke is green
- [ ] SQL schema + seed assets match the current code expectations
- [ ] Terraform baseline has been reviewed for the target environment
- [ ] required secrets/config values exist in the target environment

### Required validation commands

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
npm run test:e2e -- --project=chromium
```

---

## 2. Versioning and release preparation

### Tagging strategy

Use a semantic version tag for release candidates and final releases.

Examples:

- `v0.9.0-rc.1`
- `v1.0.0`

### Recommended pre-tag checklist

- [ ] update any release notes / milestone summary
- [ ] confirm README/deployment docs still match the repo
- [ ] confirm no temporary debug logging or fallback secrets exist
- [ ] confirm all release-critical commits are pushed

### Create a tag

```powershell
git tag v1.0.0
git push origin v1.0.0
```

If you prefer annotated tags:

```powershell
git tag -a v1.0.0 -m "Scope v1.0.0"
git push origin v1.0.0
```

---

## 3. Deployment path

### Option A — current repository automation path

1. merge the release candidate to `main`
2. allow `.github/workflows/deploy.yml` to run on `main`
3. verify that:
   - preflight passes
   - GHCR images publish successfully
   - deployment bundle artifact uploads successfully
4. when infrastructure changes are included, dispatch `Scope Deploy` manually with `terraform_action = plan`, review the uploaded plan artifact, then rerun with `terraform_action = apply` after approval
5. for the single-box AWS path, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-preflight.ps1 -Environment production -TerraformProfile ec2-compose -DeployComposeHost` or the matching `lightsail` profile check, then use `deploy_lightsail_app = true` so the workflow uploads the runtime bundle and starts Scope on the selected Compose host. Use `terraform_action = apply` when infrastructure must change, or `terraform_action = skip` for an app-only redeploy from the existing Terraform state. Keep dynamic runner SSH enabled so SSH opens only to the active runner during deployment, or configure exact SSH allowlists (`LIGHTSAIL_ADMIN_*` / `EC2_COMPOSE_ADMIN_IPV4_CIDRS`) if dynamic SSH is disabled; production also requires a 32+ character `SCOPE_GRPC_INTERNAL_TOKEN`
6. when `scopetrips.com/api/*` is served by the Cloudflare API proxy Worker, deploy `cloudflare/api-proxy` with a Wrangler token that can edit Worker scripts and routes:

```powershell
npx wrangler deploy --config .\cloudflare\api-proxy\wrangler.toml
```

7. promote/deploy from the generated image set and bundle

### Option B — manual deployment path

Use when automation is unavailable or when performing a controlled staging rollout.

1. generate/collect the deployment bundle
2. deploy the desired images/config to the target environment
3. apply or update infra where required
4. run post-deploy verification checks

---

## 4. Post-deploy verification

### Minimum checks

- [ ] public app loads through the edge route
- [ ] Core auth endpoints respond as expected
- [ ] Content read paths work
- [ ] Intel recommendation/health endpoints respond
- [ ] Scope Metrics `/healthz` and `/metrics` respond when a metrics endpoint is directly exposed to the validation network
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl "https://scope.example.com" -MetricsBaseUrl "https://metrics.scope.example.com"` passes for full-stack deployments
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -EdgeBaseUrl "https://scopetrips.com" -MetricsHealthUrl "https://scopetrips.com/api/metrics/health" -SkipMetricsScrape` passes for the current same-domain `scopetrips.com` production shape
- [ ] Playwright critical-flow smoke passes against the deployed target if feasible
- [ ] Sentry receives release-tagged events for server and browser projects, with `SENTRY_RELEASE` / `VITE_SENTRY_RELEASE` matching the deployed commit; if `SENTRY_DSN_MODE=temporary-placeholder`, this is a known temporary gap and must be rotated before relying on monitoring
- [ ] logs show no immediate crash loops or startup failures

### Recommended smoke command

Use the repository smoke-test script as the fast post-deploy gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl "https://scope.example.com" `
  -MetricsBaseUrl "https://metrics.scope.example.com"
```

This covers the frontend root, edge `/healthz`, Core/Content/Intel health routes, and Scope Metrics `/healthz` + `/metrics`, and exits non-zero whenever any smoke check fails.

For the current `https://scopetrips.com` production shape, metrics health is reachable through the app API proxy while raw Prometheus scrape output is not publicly exposed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl "https://scopetrips.com" `
  -MetricsHealthUrl "https://scopetrips.com/api/metrics/health" `
  -SkipMetricsScrape
```

If this smoke fails with duplicate security headers on Core, Content, or Intel health routes, confirm both layers have been deployed: the origin Nginx config must hide upstream security headers before adding the edge policy, and the Cloudflare API proxy Worker must normalize the proxied API response headers before returning them to browsers.

### Recommended spot checks

- register / login
- map loads and route shell renders
- create/view a spot
- plan a trip
- check notifications/friends surfaces
- verify Intel health route returns the expected bare health JSON shape
- trigger `scope-cli` inside Compose or Kubernetes and confirm the health-check command resolves all four service endpoints

---

## 5. Rollback strategy

### Image rollback

If a deployment fails after new images are released:

1. identify the last known-good image tags
2. redeploy Core, Content, Intel, Frontend, and/or Scope Metrics / Scope CLI to those tags
3. re-run post-deploy verification

### Config rollback

If the issue is configuration-based:

1. restore the last known-good env/secret set
2. restore any related edge/ingress config
3. redeploy the affected service(s)
4. verify the health/smoke checks again

### Database caution

Do **not** treat DB rollback casually.

Before any schema-affecting release:

- ensure backups exist
- confirm restore procedure is documented
- avoid destructive/manual rollback steps without backup validation

---

## 6. Incident response starter checklist

If production breaks immediately after release:

- [ ] freeze further deploys
- [ ] identify whether the failure is code, config, infra, or data
- [ ] capture failing logs and exact timestamps
- [ ] decide between fast rollback and forward-fix
- [ ] communicate affected surface area (Core / Content / Intel / Frontend)
- [ ] re-run smoke checks after mitigation
- [ ] document root cause and follow-up work

---

## 7. Current release blockers still outside this runbook

These are the major remaining runtime gaps for Scope:

1. execute the Terraform workflow against a real AWS account
2. validate the Kubernetes/Terraform stack in a live cloud target
3. finalize environment-specific production secrets, Sentry DSNs, SSH allowlists, and IAM/OIDC setup
4. complete final release polish around live cloud verification

---

## 8. Recommended next steps

1. run the deploy workflow's Terraform plan/apply path against a real AWS account using the target GitHub environment vars/secrets
2. verify deploy workflow secrets/vars and environment approvals for the target GitHub environment
3. perform a real staging deployment using either the Lightsail workflow path or the published images plus deployment bundle
4. tag the first release candidate only after that staging verification succeeds
